/* ReadFlow: ligação ao servidor (Supabase) para o sistema de amigos. Sem bibliotecas: só fetch. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic, S = RF.store, SOC = RF.social;
  const t = RF.i18n.t;

  const cfg = () => RF.config || {};
  const configured = () => { const c = cfg(); return !!(c.supabaseUrl && c.supabaseKey && /^https?:\/\//.test(c.supabaseUrl)); };
  const emailOf = (name, number) => `${name}${number}@${cfg().emailDomain || 'readflow.app'}`;

  class RemoteError extends Error {
    constructor(code, status, message) { super(message || code); this.code = code; this.status = status; }
  }
  let session = null;                                   // { access_token, refresh_token, expires_at, uid }
  const state = { user: null, lastSync: 0, syncing: false, offline: false };
  const cache = { following: [], followers: [], shared: {}, byHandle: {} };
  let known = null, lastHash = '', pushTimer = null, timers = [], hooks = { change() {}, notify() {} };
  let serverCovers = null, coversOff = false;           // capas já enviadas / tabela de capas indisponível
  const thumbCache = new Map();                          // id da capa -> miniatura (data URL)
  const coversByUid = {};                                // uid -> { ck: data URL | null }

  /* ---------- HTTP ---------- */
  async function http(method, path, o = {}) {
    const c = cfg(), url = c.supabaseUrl.replace(/\/+$/, '') + path + (o.query ? '?' + o.query : '');
    const headers = { apikey: c.supabaseKey, 'Content-Type': 'application/json' };
    if (o.auth !== false && session) headers.Authorization = 'Bearer ' + session.access_token;
    if (o.prefer) headers.Prefer = o.prefer;
    let res;
    try { res = await fetch(url, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }); }
    catch (e) { throw new RemoteError('network', 0, String((e && e.message) || e)); }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (res.status === 401 && o.auth !== false && session && !o.retried) { await refresh(); return http(method, path, { ...o, retried: true }); }
    if (!res.ok) {
      const d = data && typeof data === 'object' ? data : {};
      const code = d.code === 'P0001' ? d.message : (d.error_code || d.code || d.error || 'http_' + res.status);
      throw new RemoteError(String(code), res.status, d.msg || d.message || d.error_description || String(code));
    }
    return data;
  }
  const rest = (method, table, query, body, prefer) => http(method, '/rest/v1/' + table, { query, body, prefer });
  const rpc = (fn, args) => http('POST', '/rest/v1/rpc/' + fn, { body: args || {} });

  /* ---------- Sessão ---------- */
  async function setSession(s) {
    session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), uid: (s.user && s.user.id) || (session && session.uid) };
    await S.putKV({ id: 'auth', ...session });
  }
  async function refresh() {
    if (!session || !session.refresh_token) throw new RemoteError('no_session', 401);
    try {
      const r = await http('POST', '/auth/v1/token', { query: 'grant_type=refresh_token', body: { refresh_token: session.refresh_token }, auth: false });
      await setSession(r);
    } catch (e) {
      if (e.status && e.status >= 400 && e.status < 500) { await localSignOut(); }
      throw e;
    }
  }
  async function localSignOut() {
    session = null; state.user = null; cache.following = []; cache.followers = []; cache.shared = {}; cache.byHandle = {}; known = null; lastHash = ''; serverCovers = null; coversOff = false;
    await S.deleteKV('auth');
  }
  const loadProfile = async () => {
    const rows = await rest('GET', 'profiles', `id=eq.${session.uid}&select=id,handle_name,handle_number,display_name`);
    const p = rows && rows[0];
    if (!p) throw new RemoteError('no_profile', 404);
    state.user = { uid: p.id, handle: `${p.handle_name}#${p.handle_number}`, name: p.display_name || p.handle_name };
    const st = S.state.settings; st.handleName = p.handle_name; st.handleNumber = p.handle_number;
    await S.saveSettings();
  };

  async function signUp(username, password, displayName, invite) {
    const name = SOC.clean(username);
    if (name.length < 3) throw new RemoteError('bad_name', 0);
    if (String(password || '').length < 8) throw new RemoteError('weak_password', 0);
    let r = null, number = 0;
    for (let i = 0; i < 6 && !(r && r.access_token); i++) {
      number = 100000 + Math.floor(Math.random() * 900000);
      try { r = await http('POST', '/auth/v1/signup', { body: { email: emailOf(name, number), password }, auth: false }); }
      catch (e) { if (e.status === 422 || /already/i.test(e.message)) { r = null; continue; } throw e; }
    }
    if (!r || !r.access_token) throw new RemoteError(r ? 'confirm_email' : 'handle_taken', 0);
    await setSession(r);
    if (displayName && !S.state.settings.name) { S.state.settings.name = displayName; await S.saveSettings(); }   // o nome escolhido passa a ser o nome a mostrar
    try { await rpc('claim_profile', { p_name: name, p_number: number, p_display: (displayName || name).slice(0, 40), p_invite: String(invite || '').trim() }); }
    catch (e) { await localSignOut(); throw e; }
    await loadProfile(); await pushNow(true); await pull(true); startPolling();
    return state.user;
  }
  async function signIn(idText, password) {
    const id = SOC.parseId(idText);
    if (!id) throw new RemoteError('bad_id', 0);
    const r = await http('POST', '/auth/v1/token', { query: 'grant_type=password', body: { email: emailOf(id.name, id.number), password }, auth: false });
    await setSession(r);
    await loadProfile(); await pushNow(true); await pull(true); startPolling();
    return state.user;
  }
  async function signOut() {
    try { if (session) await http('POST', '/auth/v1/logout', {}); } catch (e) { /* sem rede: sai na mesma */ }
    await localSignOut();
  }
  async function deleteAccount() { await rpc('delete_my_account'); await localSignOut(); }

  async function restore() {
    if (!configured()) return;
    const saved = await S.getKV('auth');
    if (!saved || !saved.access_token) return;
    session = { access_token: saved.access_token, refresh_token: saved.refresh_token, expires_at: saved.expires_at, uid: saved.uid };
    const st = S.state.settings;
    state.user = { uid: saved.uid, handle: st.handleName ? `${st.handleName}#${st.handleNumber}` : '', name: st.name || st.handleName || '' };
    try {
      if (session.expires_at - Date.now() / 1000 < 90) await refresh();
      await loadProfile();
      await pull(true);
    } catch (e) { if (e.code === 'network') state.offline = true; }
    startPolling();
  }

  /* ---------- Enviar o meu perfil (só o que está ativo) ---------- */
  function avatarThumb() {
    return new Promise((resolve) => {
      try {
        const url = S.imgUrl(S.state.settings.photoId);
        if (!url || typeof Image === 'undefined') return resolve(null);
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas'); c.width = 128; c.height = 128;
            const x = c.getContext('2d'), k = Math.max(128 / img.width, 128 / img.height);
            x.drawImage(img, (128 - img.width * k) / 2, (128 - img.height * k) / 2, img.width * k, img.height * k);
            resolve(c.toDataURL('image/jpeg', 0.72));
          } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      } catch (e) { resolve(null); }
    });
  }
  /** Miniatura 96x144 de uma capa (substituível nos testes). */
  function defaultThumb(coverId) {
    return new Promise((resolve) => {
      try {
        const url = S.imgUrl(coverId);
        if (!url || typeof Image === 'undefined') return resolve(null);
        const img = new Image();
        img.onload = () => {
          try {
            const w = 96, h = 144, c = document.createElement('canvas'); c.width = w; c.height = h;
            const x = c.getContext('2d'), k = Math.max(w / img.width, h / img.height);
            x.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k);
            let q = 0.62, d = c.toDataURL('image/jpeg', q);
            while (d.length > 30000 && q > 0.3) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
            resolve(d.length <= 38000 ? d : null);
          } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      } catch (e) { resolve(null); }
    });
  }
  const api = { thumbProvider: defaultThumb };
  /** Capas dos livros que vão ser partilhados (só das listas ligadas em Privacidade). */
  async function coverThumbs() {
    const p = S.state.settings.privacy, out = new Map();
    const want = S.state.books.filter((b) => b.coverId && ((p.reading && b.status === 'reading') || (p.finished && b.status === 'finished') || (p.favorites && b.favorite) || (p.recommendations && b.recommend)));
    for (const b of want.slice(0, 400)) {
      if (!thumbCache.has(b.coverId)) thumbCache.set(b.coverId, await api.thumbProvider(b.coverId));
      if (thumbCache.get(b.coverId)) out.set(b.coverId, thumbCache.get(b.coverId));
    }
    return out;
  }
  async function syncCovers(thumbs) {
    if (coversOff) return;
    try {
      if (!serverCovers) serverCovers = new Set(((await rest('GET', 'covers', `select=ck&user_id=eq.${session.uid}`)) || []).map((r) => r.ck));
      const missing = [...thumbs.keys()].filter((k) => !serverCovers.has(k));
      for (let i = 0; i < missing.length; i += 8) {
        const chunk = missing.slice(i, i + 8);
        await rest('POST', 'covers', 'on_conflict=user_id,ck', chunk.map((k) => ({ user_id: session.uid, ck: k, data: thumbs.get(k) })), 'resolution=merge-duplicates');
        chunk.forEach((k) => serverCovers.add(k));
      }
      const stale = [...serverCovers].filter((k) => !thumbs.has(k));
      for (let i = 0; i < stale.length; i += 25) {
        const chunk = stale.slice(i, i + 25);
        await rest('DELETE', 'covers', `user_id=eq.${session.uid}&ck=in.(${chunk.join(',')})`);
        chunk.forEach((k) => serverCovers.delete(k));
      }
    } catch (e) {
      if (e.code === 'network') throw e;
      coversOff = true;           // a tabela ainda não existe no servidor: o perfil continua a funcionar, só sem capas
    }
  }

  let avatarCache = { id: null, data: null };
  async function pushNow(force) {
    if (!session || !state.user) return;
    const thumbs = await coverThumbs();
    const st = S.state.settings, sections = SOC.publicSections(S, new Set(thumbs.keys()));
    if (avatarCache.id !== st.photoId) avatarCache = { id: st.photoId, data: st.photoId ? await avatarThumb() : null };
    const profile = { display_name: (st.name || st.handleName || '').slice(0, 40), avatar: avatarCache.data, privacy: st.privacy };
    const hash = JSON.stringify({ profile, sections });
    if (!force && hash === lastHash) return;
    await rest('PATCH', 'profiles', `id=eq.${session.uid}`, { ...profile, updated_at: new Date().toISOString() });
    const rows = Object.entries(sections).map(([section, payload]) => ({ user_id: session.uid, section, payload, updated_at: new Date().toISOString() }));
    if (rows.length) await rest('POST', 'shared', 'on_conflict=user_id,section', rows, 'resolution=merge-duplicates');
    const off = SOC.ALL_SECTIONS.filter((s) => !(s in sections));
    if (off.length) await rest('DELETE', 'shared', `user_id=eq.${session.uid}&section=in.(${off.join(',')})`);
    await syncCovers(thumbs);
    lastHash = hash;
  }
  /** Agenda o envio (junta várias alterações seguidas). */
  function schedulePush(ms) {
    if (!session) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, ms === undefined ? 2500 : ms);
  }

  /* ---------- Receber: pedidos, amigos e o que partilham comigo ---------- */
  const personOf = (p) => ({ uid: p.id, id: `${p.handle_name}#${p.handle_number}`, name: p.display_name || p.handle_name, avatar: p.avatar || null, color: SOC.hue(p.handle_name + p.handle_number) });
  async function pull(silent) {
    if (!session || state.syncing) return;
    state.syncing = true;
    try {
      const me = session.uid;
      const rel = await rest('GET', 'follows', `select=follower_id,followee_id,status&or=(follower_id.eq.${me},followee_id.eq.${me})`) || [];
      const ids = [...new Set(rel.map((r) => (r.follower_id === me ? r.followee_id : r.follower_id)))];
      const people = {};
      if (ids.length) for (const p of await rest('GET', 'profiles', `select=id,handle_name,handle_number,display_name,avatar&id=in.(${ids.join(',')})`) || []) people[p.id] = personOf(p);
      const following = [], followers = [];
      for (const r of rel) {
        if (r.follower_id === me && people[r.followee_id]) following.push({ ...people[r.followee_id], status: r.status });
        if (r.followee_id === me && people[r.follower_id]) followers.push({ ...people[r.follower_id], status: r.status });
      }
      const accepted = following.filter((f) => f.status === 'accepted').map((f) => f.uid);
      const shared = {};
      if (accepted.length) for (const row of await rest('GET', 'shared', `select=user_id,section,payload&user_id=in.(${accepted.join(',')})`) || []) (shared[row.user_id] = shared[row.user_id] || {})[row.section] = row.payload;
      cache.following = following; cache.followers = followers; cache.shared = shared;
      cache.byHandle = {}; for (const p of [...following, ...followers]) cache.byHandle[p.id] = p;

      const snapshot = { inc: new Set(followers.filter((f) => f.status === 'pending').map((f) => f.uid)), acc: new Set(following.filter((f) => f.status === 'accepted').map((f) => f.uid)) };
      if (known && !silent) {
        for (const f of followers) if (f.status === 'pending' && !known.inc.has(f.uid)) hooks.notify('request', f);
        for (const f of following) if (f.status === 'accepted' && !known.acc.has(f.uid)) hooks.notify('accepted', f);
      }
      known = snapshot; state.lastSync = Date.now(); state.offline = false;
      prefetchCovers();
    } catch (e) { if (e.code === 'network') state.offline = true; else throw e; }
    finally { state.syncing = false; hooks.change(); }
  }

  /* ---------- Capas dos amigos (descarregadas à medida que são precisas) ---------- */
  const LISTS = ['reading', 'finished', 'favorites', 'recommendations'];
  function keysOf(uid, sections, limit) {
    const sh = cache.shared[uid] || {}, out = [];
    for (const s of sections) for (const it of (sh[s] || []).slice(0, limit || 1e9)) if (it.ck) out.push(it.ck);
    return out;
  }
  async function fetchCovers(uid, keys) {
    const have = (coversByUid[uid] = coversByUid[uid] || {});
    const need = [...new Set(keys)].filter((k) => k && !(k in have));
    let got = 0;
    for (let i = 0; i < need.length; i += 25) {
      const chunk = need.slice(i, i + 25);
      try {
        for (const r of (await rest('GET', 'covers', `select=ck,data&user_id=eq.${uid}&ck=in.(${chunk.join(',')})`)) || []) { have[r.ck] = r.data; got++; }
        for (const k of chunk) if (!(k in have)) have[k] = null;
      } catch (e) { break; }
    }
    return got;
  }
  /** Descarrega as capas das primeiras 12 entradas de cada lista (rápido) e avisa o ecrã. */
  async function prefetchCovers() {
    let total = 0;
    for (const f of cache.following) if (f.status === 'accepted') total += await fetchCovers(f.uid, keysOf(f.uid, LISTS, 12));
    if (total) hooks.change();
  }
  /** Descarrega todas as capas de uma pessoa (para a lista completa). Devolve quantas chegaram. */
  async function loadCovers(handle, sections) {
    const p = byHandle(handle);
    return p ? fetchCovers(p.uid, keysOf(p.uid, sections || LISTS)) : 0;
  }

  /* ---------- Ações sobre pessoas ---------- */
  async function follow(idText) {
    const id = SOC.parseId(idText);
    if (!id) throw new RemoteError('bad_id', 0);
    if (state.user && id.id === state.user.handle) throw new RemoteError('self', 0);
    const found = await rpc('find_profile', { p_name: id.name, p_number: id.number });
    if (!found || !found.length) throw new RemoteError('not_found', 404);
    await rpc('request_follow', { target: found[0].id });
    await pull(true);
  }
  const byHandle = (h) => cache.byHandle[h] || null;
  async function unfollow(handle) { const p = byHandle(handle); if (!p) return; await rest('DELETE', 'follows', `follower_id=eq.${session.uid}&followee_id=eq.${p.uid}`); await pull(true); }
  async function removeFollower(handle) { const p = byHandle(handle); if (!p) return; await rest('DELETE', 'follows', `follower_id=eq.${p.uid}&followee_id=eq.${session.uid}`); await pull(true); }
  async function respond(handle, accept) { const p = byHandle(handle); if (!p) return; await rpc('respond_follow', { p_follower: p.uid, p_accept: !!accept }); await pull(true); }

  /* ---------- Leitura para os ecrãs ---------- */
  const relation = (handle) => {
    const a = cache.following.find((f) => f.id === handle), b = cache.followers.find((f) => f.id === handle);
    return { iFollow: a ? a.status : 'none', followsMe: b ? b.status : 'none' };
  };
  const sectionsOf = (handle) => { const p = byHandle(handle); return p ? SOC.fromServer(cache.shared[p.uid] || {}, coversByUid[p.uid]) : null; };
  function feed() {
    const out = [];
    for (const f of cache.following) if (f.status === 'accepted') for (const a of (cache.shared[f.uid] || {}).activity || []) out.push({ u: f, p: a, when: a.when });
    return out.sort((x, y) => y.when - x.when);
  }
  function recommendations() {
    const out = [];
    for (const f of cache.following) if (f.status === 'accepted') for (const r of (cache.shared[f.uid] || {}).recommendations || []) out.push({ u: f, title: r.title, author: r.author, note: r.note, rating: r.rating || 0, review: r.review || '', ck: r.ck || '', coverData: (coversByUid[f.uid] || {})[r.ck] || null });
    return out;
  }

  /** Pessoas que conto nos rankings: quem sigo (aprovado). As minhas entram na vista. */
  function rankingPeople() {
    return cache.following.filter((f) => f.status === 'accepted').map((f) => ({ id: f.id, name: f.name, color: f.color, avatar: f.avatar, me: false, stats: (cache.shared[f.uid] || {}).stats || null }));
  }

  /** Verifica a configuração (URL, chave, registos novos, confirmação por e-mail) sem criar nada. */
  async function diagnose() {
    if (!configured()) return { ok: false, problem: 'not_configured' };
    try {
      const r = await http('GET', '/auth/v1/settings', { auth: false });
      if (r && r.disable_signup) return { ok: false, problem: 'signup_disabled' };
      if (r && r.mailer_autoconfirm === false) return { ok: false, problem: 'confirm_email' };
      return { ok: true };
    } catch (e) { return { ok: false, problem: e.code === 'network' ? 'network' : (e.status === 401 || e.status === 403 ? 'bad_key' : 'unknown'), error: e }; }
  }

  /* ---------- Ciclo automático ---------- */
  function startPolling() {
    stopPolling();
    if (typeof setInterval === 'undefined') return;
    timers = [setInterval(() => { if (session) pull().catch(() => {}); }, 45000), setInterval(() => { if (session) pushNow().catch(() => {}); }, 20000)];
    for (const tm of timers) if (tm && tm.unref && typeof process !== 'undefined' && process.versions && process.versions.node && !root.document) tm.unref();
  }
  function stopPolling() { timers.forEach(clearInterval); timers = []; }

  /** Traduz um erro técnico numa frase para a pessoa. */
  function explain(e) {
    const c = e && (e.code || e.message) || '';
    const map = {
      network: 'Não foi possível ligar. Verifica a internet.', invalid_credentials: 'ID ou palavra-passe incorretos.', bad_id: 'ID inválido. Usa o formato nome#123456.',
      bad_name: 'O nome deve ter entre 3 e 16 letras ou números.', weak_password: 'A palavra-passe deve ter pelo menos 8 caracteres.', handle_taken: 'Esse nome já está a ser usado. Tenta outro.',
      confirm_email: 'A confirmação por e-mail está ligada no Supabase. Desliga «Confirm email» (ver o guia).', not_found: 'Não encontrámos ninguém com esse ID.',
      self: 'Esse é o teu próprio ID.', invite_invalid: 'Código de convite inválido ou em falta. Pede-o a quem te convidou.', rate_limited: 'Enviaste muitos pedidos. Tenta daqui a uma hora.', email_not_confirmed: 'A confirmação por e-mail está ligada no Supabase. Desliga «Confirm email» (ver o guia).'
    };
    if (map[c]) return t(map[c]);
    if (e && e.status === 400 && /invalid login/i.test(e.message || '')) return t(map.invalid_credentials);
    if (e && /rate limit/i.test(e.message || '')) return t('Demasiados pedidos ao servidor. Espera um pouco e tenta outra vez.');
    return t('Algo correu mal. Tenta outra vez.') + (e && e.message ? ` (${e.message})` : '');
  }

  RF.remote = {
    configured, signedIn: () => !!(session && state.user), state, cache, RemoteError, explain,
    signUp, signIn, signOut, deleteAccount, diagnose, restore, pull, pushNow, schedulePush, follow, unfollow, removeFollower, respond,
    relation, sectionsOf, feed, recommendations, rankingPeople, loadCovers, person: byHandle, api, startPolling, stopPolling,
    setHooks: (h) => { hooks = { ...hooks, ...h }; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
