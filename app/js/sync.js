
/* ReadFlow — cópia na nuvem (Google Drive).
   Guarda tudo (livros, leituras, estantes, conquistas, definições e imagens) na pasta privada da app no Google Drive de cada pessoa
   e junta as alterações feitas em vários computadores, sem perder nada. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const S = RF.store, UI = RF.ui, t = RF.i18n.t;
  const h = UI.h;
  const DOC = 'readflow-data.json';
  const imgName = (id) => 'img-' + id;

  /* ========== Funções puras (fusão de dados) ========== */
  const stamp = (x) => x.updatedAt || 0;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function buildDoc() {
    const st = S.state;
    return {
      app: 'ReadFlow', v: 1, books: clone(st.books), sessions: clone(st.sessions), shelves: clone(st.shelves),
      unlocked: [...st.unlocked].map(([id, at]) => ({ id, at })),
      settings: { ...clone(S.syncableSettings(st.settings)), updatedAt: st.settings.updatedAt || 0 },
      tombstones: clone(st.tombstones)
    };
  }

  /** Junta duas listas pelo id: ganha a versão mais recente; o que foi apagado depois da última alteração fica apagado. */
  function mergeList(a, b, tomb) {
    const map = new Map();
    for (const x of a) map.set(x.id, x);
    for (const x of b) { const cur = map.get(x.id); if (!cur || stamp(x) >= stamp(cur)) map.set(x.id, x); }
    return [...map.values()].filter((x) => { const d = tomb[x.id]; return !(d && d.at >= stamp(x)); });
  }

  function mergeSettingsDocs(a, b) {
    const newer = stamp(b) > stamp(a) ? b : a, older = newer === b ? a : b;
    const m = { ...older, ...newer };
    const led = {};
    for (const src of [a.xpLedger || {}, b.xpLedger || {}]) for (const [k, v] of Object.entries(src)) led[k] = Math.max(led[k] || 0, Number(v) || 0);
    m.xpLedger = led;
    if (Array.isArray(a.seenCosmetics) || Array.isArray(b.seenCosmetics)) m.seenCosmetics = [...new Set([...(a.seenCosmetics || []), ...(b.seenCosmetics || [])])];
    m.updatedAt = Math.max(stamp(a), stamp(b));
    return m;
  }

  function mergeDocs(local, remote) {
    const tomb = { ...(local.tombstones || {}) };
    for (const [id, d] of Object.entries(remote.tombstones || {})) if (!tomb[id] || d.at > tomb[id].at) tomb[id] = d;
    const books = mergeList(local.books, remote.books || [], tomb), sessions = mergeList(local.sessions, remote.sessions || [], tomb), shelves = mergeList(local.shelves, remote.shelves || [], tomb);
    for (const x of [...books, ...sessions, ...shelves]) if (tomb[x.id]) delete tomb[x.id];
    const un = new Map();
    for (const u of [...local.unlocked, ...(remote.unlocked || [])]) un.set(u.id, Math.min(un.get(u.id) || Infinity, u.at));
    return { app: 'ReadFlow', v: 1, books, sessions, shelves, unlocked: [...un].map(([id, at]) => ({ id, at })), settings: mergeSettingsDocs(local.settings, remote.settings || {}), tombstones: tomb };
  }

  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const canon = (doc) => S.stable({ ...doc, books: [...doc.books].sort(byId), sessions: [...doc.sessions].sort(byId), shelves: [...doc.shelves].sort(byId), unlocked: [...doc.unlocked].sort(byId) });

  function imageIdsOf(doc) {
    const ids = new Set();
    for (const b of doc.books) { if (b.coverId) ids.add(b.coverId); if (b.spineId) ids.add(b.spineId); }
    for (const s of doc.sessions) if (s.photoId) ids.add(s.photoId);
    if (doc.settings.photoId) ids.add(doc.settings.photoId);
    if (doc.settings.shelfBgImageId) ids.add(doc.settings.shelfBgImageId);
    return [...ids];
  }

  /* ========== Estado e ligação ao Google ========== */
  const state = { status: 'off', connected: false, email: '', lastSync: 0, error: '', progress: null, configured: false };
  let hooks = { change() {}, applied() {} }, uid = null, running = false, again = false, counter = 0, pushTimer = null, pollTimer = null, lastRemote = '', declined = false, progressModal = null;
  const D = () => (root.readflowApp && root.readflowApp.drive) || null;
  const supported = () => !!D();
  const cfg = () => RF.config || {};

  // Um OAuth Client ID de aplicação desktop é público e não precisa de client secret no código.
  const configured = () => !!cfg().googleClientId;

  const notify = () => { try { hooks.change(); } catch (e) { /* ecrã */ } };
  const setHooks = (h_) => { hooks = { ...hooks, ...h_ }; };
  function setStatus(status, error) { state.status = status; state.error = error || ''; notify(); }

  function explain(e) {
    const m = {
      network: 'Sem ligação à internet. A cópia continua quando voltares a ter rede.',
      auth: 'A ligação ao Google caiu. Liga o Google Drive outra vez.',
      not_connected: 'O Google Drive não está ligado.',
      api_disabled: 'A API do Google Drive não está ativada no projeto Google (ver o guia).',
      quota: 'O teu Google Drive está cheio.',
      rate: 'O Google pediu para abrandar. A app tenta mais tarde.',
      bad_client: 'O Client ID do Google não está correto ou a configuração OAuth não é válida.',
      denied: 'Não deste autorização no Google.',
      timeout: 'A autorização no Google demorou demasiado.',
      no_refresh: 'O Google não deu a ligação permanente. Remove o ReadFlow em myaccount.google.com/permissions e tenta outra vez.',
      not_configured: 'O Google ainda não está configurado (ver o guia).',
      server: 'O Google está com problemas. Tenta mais tarde.'
    };
    return t(m[e && e.code] || 'Algo correu mal na cópia na nuvem. Tenta outra vez.');
  }

  async function prepare() {
    if (!supported()) return null;

    // Não enviar nem depender de clientSecret no processo principal.
    await D().configure({
      clientId: cfg().googleClientId || ''
    });

    state.configured = configured();
    return D();
  }

  /* ========== Sincronização ========== */
  const sniff = (b) => (b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 ? 'image/webp' : 'image/jpeg');

  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
  }

  function setProgress(label, done, total) {
    state.progress = label ? { label, done, total } : null;
    if (progressModal) progressModal.update();
    notify();
  }

  const localHasData = () => !!(S.state.books.length || S.state.sessions.length || S.state.shelves.length);

  /** Pergunta o que fazer quando este computador tem dados que não são desta conta. */
  async function ask(remoteExists, otherAccount) {
    return new Promise((resolve) => {
      UI.openModal((api) => {
        const pick = (v) => () => { resolve(v); api.close(); };
        return h('div', { class: 'dialog' }, UI.modalHeader(t('Dados neste computador'), api),
          h('p', null, otherAccount ? t('Este computador tem dados de outra conta do ReadFlow.') : t('Este computador já tem livros e leituras.')),
          h('p', { class: 'muted small' }, remoteExists ? t('Esta conta também tem uma cópia na nuvem. O que queres fazer?') : t('Esta conta ainda não tem cópia na nuvem. O que queres fazer?')),
          h('div', { class: 'stack' },
            h('button', { class: 'btn primary', onClick: pick('merge') }, remoteExists ? t('Juntar os dois (recomendado)') : t('Enviar os dados deste computador para a nuvem')),
            h('button', { class: 'btn', onClick: pick('replace') }, remoteExists ? t('Usar só os da nuvem (apaga os deste computador)') : t('Começar de novo neste computador (apaga os dados)')),
            h('button', { class: 'btn ghost', onClick: pick('cancel') }, t('Agora não'))));
      }, { onClose: () => resolve('cancel') });
    });
  }

  function openProgress() {
    if (progressModal) return;
    const label = h('div', { class: 'strong' }), fill = h('i', { style: { width: '0%' } }), bar = h('div', { class: 'bar' }, fill);
    const el = h('div', { class: 'dialog' }, h('h3', null, t('A sincronizar com o Google Drive…')), label, bar, h('p', { class: 'muted small' }, t('Isto só demora assim na primeira vez.')));
    let api = null;
    UI.openModal((a) => { api = a; return el; }, { sticky: true });
    progressModal = {
      close: () => { if (api) api.close(); progressModal = null; },
      update: () => {
        const p = state.progress;
        label.textContent = p ? `${p.label}${p.total ? ` (${p.done}/${p.total})` : ''}` : t('A preparar…');
        fill.style.width = p && p.total ? Math.round(100 * p.done / p.total) + '%' : '0%';
      }
    };
    progressModal.update();
  }

  /** Um ciclo completo: ler a nuvem, juntar com o que está aqui, atualizar os dois lados. */
  async function syncNow(opts) {
    opts = opts || {};
    if (!uid || !state.connected || !D()) return false;
    if (declined && !opts.manual) return false;
    if (running) { again = true; return false; }

    running = true;
    clearTimeout(pushTimer);
    const first = !!opts.first;

    try {
      setStatus('syncing');
      const drive = D();
      let files = await drive.list(), byName = new Map(files.map((f) => [f.name, f])), result = false;

      declined = false;
      const other = S.state.settings.cloudUid;

      if (other !== uid && localHasData() && (other || byName.has(DOC))) {
        const choice = await RF.sync.ask(byName.has(DOC), other || '');
        if (choice === 'cancel') { declined = true; setStatus('idle'); return false; }
        if (choice === 'replace') await S.resetLocal();
      }

      S.state.settings.cloudUid = uid;
      await S.saveSettings();

      if (first || opts.blocking) openProgress();

      for (let attempt = 0; attempt < 3; attempt++) {
        const mark = counter, meta = byName.get(DOC);
        let remote = null;

        if (meta) {
          setProgress(t('A ler a cópia da nuvem'), 0, 0);
          const bytes = await drive.read(DOC);
          if (bytes) remote = JSON.parse(Buffer_toString(bytes));
        }

        const local = buildDoc(), merged = remote ? mergeDocs(local, remote) : local;

        if (canon(merged) !== canon(local)) {
          if (counter !== mark) continue;
          await S.applyDoc(merged);
          try { hooks.applied(); } catch (e) { /* ecrã */ }
        }

        const need = imageIdsOf(merged);
        const down = need.filter((id) => !S.hasImage(id) && byName.has(imgName(id)));
        const up = need.filter((id) => S.hasImage(id) && !byName.has(imgName(id)));

        let n = 0;
        setProgress(t('A receber imagens'), 0, down.length);

        await pool(down, 3, async (id) => {
          const bytes = await drive.read(imgName(id));
          if (bytes) await S.restoreImage(id, new Blob([bytes], { type: sniff(bytes) }));
          setProgress(t('A receber imagens'), ++n, down.length);
        });

        n = 0;
        setProgress(t('A enviar imagens'), 0, up.length);

        await pool(up, 3, async (id) => {
          const blob = await S.getImageBlob(id);
          if (blob) {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            await drive.write(imgName(id), bytes, blob.type || 'image/jpeg');
          }
          setProgress(t('A enviar imagens'), ++n, up.length);
        });

        if (down.length) {
          try { hooks.applied(); } catch (e) { /* ecrã */ }
        }

        const rh = remote ? canon(remote) : '';

        if (!remote || canon(merged) !== rh) {
          const now_ = await drive.stat(DOC);

          if (meta && now_ && now_.modifiedTime !== meta.modifiedTime) {
            files = await drive.list();
            byName = new Map(files.map((f) => [f.name, f]));
            continue;
          }

          setProgress(t('A guardar'), 0, 0);
          const w = await drive.write(DOC, Buffer_from(JSON.stringify(merged)), 'application/json');
          lastRemote = (w && w.modifiedTime) || '';
        } else {
          lastRemote = (meta && meta.modifiedTime) || '';
        }

        result = true;

        const used = new Set(need.map(imgName));
        const old = Date.now() - 2 * 86400000;
        const orphans = files.filter((f) => /^img-/.test(f.name) && !used.has(f.name) && Date.parse(f.modifiedTime || 0) < old).slice(0, 40);

        for (const f of orphans) {
          try { await drive.remove(f.name); } catch (e) { break; }
        }

        break;
      }

      state.lastSync = Date.now();
      setProgress(null);
      setStatus('idle');
      return result;

    } catch (e) {
      if (root.process && root.process.env && root.process.env.RF_DEBUG) console.log('SYNC ERRO', e && e.stack || e);

      if (e.code === 'auth' || e.code === 'not_connected') {
        state.connected = false;
        setStatus('idle', explain(e));
      } else if (e.code === 'network') {
        setStatus('offline', explain(e));
      } else {
        setStatus('error', explain(e));
      }

      setProgress(null);
      return false;

    } finally {
      running = false;
      if (progressModal) progressModal.close();
      if (again) { again = false; schedule(1500); }
    }
  }

  // Buffer só existe no processo principal; aqui usamos TextEncoder/Decoder.
  function Buffer_toString(bytes) { return new TextDecoder('utf-8').decode(bytes); }
  function Buffer_from(text) { return new TextEncoder().encode(text); }

  function schedule(ms) {
    clearTimeout(pushTimer);
    if (!state.connected) return;
    pushTimer = setTimeout(() => syncNow(), ms === undefined ? 8000 : ms);
  }

  async function poll() {
    if (!uid || !state.connected || running || !D()) return;
    try {
      const m = await D().stat(DOC);
      if (m && m.modifiedTime !== lastRemote) await syncNow();
    } catch (e) {
      if (e.code === 'network') setStatus('offline', explain(e));
    }
  }

  function startTimers() {
    stopTimers();
    pollTimer = setInterval(poll, 60000);
    if (root.addEventListener) root.addEventListener('focus', poll);
  }

  function stopTimers() {
    clearInterval(pollTimer);
    clearTimeout(pushTimer);
    if (root.removeEventListener) root.removeEventListener('focus', poll);
  }

  S.onChange(() => {
    counter++;
    if (state.connected && uid) schedule();
  });

  /* ========== Ações (chamadas pelo ecrã e pelo início de sessão) ========== */
  async function onSignIn(newUid, password) {
    try {
      if (!(await prepare())) return;

      uid = newUid;
      declined = false;

      const st = await D().setUser(uid);
      state.connected = !!st.connected;
      state.email = st.email || '';
      state.configured = st.configured;

      if (!state.connected && st.configured && password) {
        const blob = await RF.remote.vaultGet();
        if (blob) {
          try {
            const s2 = await D().vaultImport(blob, password);
            state.connected = !!s2.connected;
            state.email = s2.email || '';
          } catch (e) { /* palavra-passe diferente: fica por ligar */ }
        }
      }

      setStatus(state.connected ? 'idle' : 'off');

      if (state.connected) {
        startTimers();
        await syncNow({ first: true });
      }
    } catch (e) {
      setStatus('error', explain(e));
    }
  }

  function onSignOut() {
    stopTimers();
    uid = null;
    state.connected = false;
    state.email = '';
    state.status = 'off';
    lastRemote = '';
    if (D()) D().setUser(null).catch(() => {});
    notify();
  }

  /** «Ligar ao Google Drive»: abre o browser; depois guarda a ligação cifrada no servidor e sincroniza. */
  async function connect(password) {
    try {
      if (!(await prepare())) throw Object.assign(new Error('x'), { code: 'not_configured' });
      if (!state.configured) throw Object.assign(new Error('x'), { code: 'not_configured' });

      setStatus('syncing');
      state.progress = { label: t('À espera da autorização no browser…'), done: 0, total: 0 };
      notify();

      const st = await D().connect();
      state.connected = !!st.connected;
      state.email = st.email || '';
      state.progress = null;

      if (state.connected && password) {
        try {
          const blob = await D().vaultExport(password);
          await RF.remote.vaultPut(blob);
        } catch (e) { /* sem cofre: o Google terá de ser ligado em cada computador */ }
      }

      startTimers();
      await syncNow({ first: true });
      return true;

    } catch (e) {
      state.progress = null;
      setStatus('error', explain(e));
      return false;
    }
  }

  async function disconnect() {
    try { if (D()) await D().disconnect(); } catch (e) { /* ok */ }
    try { await RF.remote.vaultDelete(); } catch (e) { /* ok */ }
    stopTimers();
    state.connected = false;
    state.email = '';
    setStatus('off');
  }

  async function deleteCloud() {
    try {
      setStatus('syncing');
      await D().wipe();
      S.state.settings.cloudUid = '';
      await S.saveSettings();
      lastRemote = '';
      setStatus('idle');
      return true;
    } catch (e) {
      setStatus('error', explain(e));
      return false;
    }
  }

  function statusText() {
    if (!supported()) return t('Disponível na versão instalada.');
    if (state.progress) return state.progress.label + (state.progress.total ? ` (${state.progress.done}/${state.progress.total})` : '');
    if (state.status === 'syncing') return t('A sincronizar…');
    if (state.status === 'offline' || state.status === 'error') return state.error;
    if (state.lastSync) {
      const m = Math.max(0, Math.round((Date.now() - state.lastSync) / 60000));
      return t('Sincronizado') + ' ' + (m < 1 ? t('agora mesmo') : t('há {n} min', { n: m }));
    }
    return state.error || t('Ligado');
  }

  RF.sync = {
    state, supported, configured, setHooks, syncNow, schedule, onSignIn, onSignOut,
    connect, disconnect, deleteCloud, statusText, explain, ask,
    buildDoc, mergeDocs, imageIdsOf, canon,
    _reset() {
      uid = null;
      running = false;
      counter = 0;
      lastRemote = '';
      declined = false;
      state.connected = false;
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
