// Servidor Supabase simulado (só para testes): responde aos mesmos pedidos que a app faz e aplica as
// mesmas regras de privacidade do esquema SQL (docs/supabase-schema.sql). Não substitui testar com contas reais.
const crypto = require('crypto');
const uuid = () => crypto.randomUUID();

function createMock(opts = {}) {
  const key = opts.key || 'test-key';
  const db = { users: new Map(), tokens: new Map(), refresh: new Map(), profiles: new Map(), follows: [], shared: new Map(), covers: new Map() };
  const flags = { confirmEmails: !!opts.confirmEmails, down: false, invite: opts.invite || '', noCovers: false };
  const log = [];

  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined || body === null ? '' : JSON.stringify(body)) });
  const err = (status, code, msg) => res(status, { error_code: code, code, msg, message: msg });
  const p0001 = (msg) => res(400, { code: 'P0001', message: msg });

  const issue = (user) => {
    const access = 'at-' + uuid(), refresh = 'rt-' + uuid();
    db.tokens.set(access, user.id); db.refresh.set(refresh, user.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user.id } };
  };
  const rel = (a, b) => db.follows.find((f) => f.follower_id === a && f.followee_id === b);
  const connected = (a, b) => !!(rel(a, b) || rel(b, a));
  const canView = (viewer, target, section) => {
    const f = rel(viewer, target), p = db.profiles.get(target);
    return !!(f && f.status === 'accepted' && p && p.privacy && p.privacy[section] === true);
  };
  const canViewAny = (viewer, target, secs) => {
    const f = rel(viewer, target), p = db.profiles.get(target);
    return !!(f && f.status === 'accepted' && p && p.privacy && secs.some((x) => p.privacy[x] === true));
  };
  const eq = (v) => (v && v.startsWith('eq.') ? v.slice(3) : null);
  const inList = (v) => (v && v.startsWith('in.(') ? v.slice(4, -1).split(',') : null);

  async function fetchMock(url, init = {}) {
    if (flags.down) throw new TypeError('fetch failed');
    const u = new URL(url), path = u.pathname, q = u.searchParams, method = init.method || 'GET';
    const headers = init.headers || {};
    const body = init.body ? JSON.parse(init.body) : undefined;
    log.push(`${method} ${path}${u.search}`);
    if (headers.apikey !== key) return err(401, 'invalid_api_key', 'Invalid API key');

    /* ---- Auth ---- */
    if (path === '/auth/v1/signup' && method === 'POST') {
      if (db.users.has(body.email)) return err(422, 'user_already_exists', 'User already registered');
      if (String(body.password || '').length < 6) return err(422, 'weak_password', 'Password should be at least 6 characters');
      const user = { id: uuid(), email: body.email, password: body.password };
      db.users.set(body.email, user);
      return res(200, flags.confirmEmails ? { id: user.id, email: user.email } : issue(user));
    }
    if (path === '/auth/v1/token' && method === 'POST') {
      if (q.get('grant_type') === 'password') {
        const user = db.users.get(body.email);
        if (!user || user.password !== body.password) return err(400, 'invalid_credentials', 'Invalid login credentials');
        return res(200, issue(user));
      }
      if (q.get('grant_type') === 'refresh_token') {
        const id = db.refresh.get(body.refresh_token);
        if (!id) return err(400, 'refresh_token_not_found', 'Invalid Refresh Token');
        return res(200, issue({ id }));
      }
    }
    if (path === '/auth/v1/logout') return res(204);
    if (path === '/auth/v1/settings') return res(200, { disable_signup: false, mailer_autoconfirm: !flags.confirmEmails, external: { email: true } });

    /* ---- REST: precisa de utilizador ---- */
    const bearer = (headers.Authorization || '').replace('Bearer ', '');
    const me = db.tokens.get(bearer);
    if (!me) return err(401, 'PGRST301', 'JWT expired');

    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop();
      if (fn === 'claim_profile') {
        const n = String(body.p_name || '').toLowerCase();
        if (!/^[a-z0-9_]{3,16}$/.test(n) || body.p_number < 100000 || body.p_number > 999999) return err(400, '23514', 'check violation');
        for (const p of db.profiles.values()) if (p.id !== me && p.handle_name === n && p.handle_number === body.p_number) return p0001('handle_taken');
        if (flags.invite && (body.p_invite || '') !== flags.invite && !db.profiles.has(me)) return p0001('invite_invalid');
        const old = db.profiles.get(me);
        const row = old ? { ...old, display_name: String(body.p_display || '').slice(0, 40) } : { id: me, handle_name: n, handle_number: body.p_number, display_name: String(body.p_display || '').slice(0, 40), avatar: null, privacy: { bio: true, reading: true, finished: true, favorites: true, recommendations: true, achievements: true, activity: true, stats: true } };
        db.profiles.set(me, row);
        return res(200, row);
      }
      if (fn === 'find_profile') {
        const r = [...db.profiles.values()].filter((p) => p.handle_name === String(body.p_name).toLowerCase() && p.handle_number === body.p_number)
          .map((p) => ({ id: p.id, handle_name: p.handle_name, handle_number: p.handle_number, display_name: p.display_name, avatar: p.avatar }));
        return res(200, r);
      }
      if (fn === 'request_follow') {
        if (body.target === me) return p0001('self');
        if (!db.profiles.has(body.target)) return p0001('not_found');
        if (!rel(me, body.target)) db.follows.push({ follower_id: me, followee_id: body.target, status: 'pending', created_at: Date.now() });
        return res(200, rel(me, body.target).status);
      }
      if (fn === 'respond_follow') {
        const f = rel(body.p_follower, me);
        if (f) { if (body.p_accept) f.status = 'accepted'; else db.follows.splice(db.follows.indexOf(f), 1); }
        return res(204);
      }
      if (fn === 'delete_my_account') {
        db.profiles.delete(me); db.follows = db.follows.filter((f) => f.follower_id !== me && f.followee_id !== me);
        for (const k of [...db.shared.keys()]) if (k.startsWith(me + '|')) db.shared.delete(k);
        for (const k of [...db.covers.keys()]) if (k.startsWith(me + '|')) db.covers.delete(k);
        for (const [e, usr] of db.users) if (usr.id === me) db.users.delete(e);
        return res(204);
      }
      return err(404, 'PGRST202', 'function not found');
    }

    if (path === '/rest/v1/profiles') {
      if (method === 'GET') {
        let rows = [...db.profiles.values()];
        const one = eq(q.get('id')), many = inList(q.get('id'));
        if (one) rows = rows.filter((p) => p.id === one); if (many) rows = rows.filter((p) => many.includes(p.id));
        rows = rows.filter((p) => p.id === me || connected(me, p.id));                      // RLS
        return res(200, rows);
      }
      if (method === 'PATCH') {
        const allowed = ['display_name', 'avatar', 'privacy', 'updated_at'];
        if (Object.keys(body).some((k) => !allowed.includes(k))) return err(403, '42501', 'permission denied for column');
        if (eq(q.get('id')) !== me) return res(200, []);
        db.profiles.set(me, { ...db.profiles.get(me), ...body });
        return res(204);
      }
    }
    if (path === '/rest/v1/follows') {
      if (method === 'GET') {
        const m = /^\(follower_id\.eq\.([^,]+),followee_id\.eq\.([^)]+)\)$/.exec(q.get('or') || '');
        let rows = db.follows.filter((f) => f.follower_id === me || f.followee_id === me);   // RLS
        if (m) rows = rows.filter((f) => f.follower_id === m[1] || f.followee_id === m[2]);
        return res(200, rows.map((f) => ({ follower_id: f.follower_id, followee_id: f.followee_id, status: f.status })));
      }
      if (method === 'DELETE') {
        const a = eq(q.get('follower_id')), b = eq(q.get('followee_id'));
        db.follows = db.follows.filter((f) => !(f.follower_id === a && f.followee_id === b && (a === me || b === me)));
        return res(204);
      }
      return err(403, '42501', 'permission denied for table follows');
    }
    if (path === '/rest/v1/shared') {
      if (method === 'GET') {
        const ids = inList(q.get('user_id')) || [eq(q.get('user_id'))];
        const rows = [];
        for (const row of db.shared.values()) if (ids.includes(row.user_id) && (row.user_id === me || canView(me, row.user_id, row.section))) rows.push(row);   // RLS
        return res(200, rows);
      }
      if (method === 'POST') {
        const list = Array.isArray(body) ? body : [body];
        if (list.some((r) => r.user_id !== me)) return err(403, '42501', 'new row violates row-level security policy');
        for (const r of list) db.shared.set(`${r.user_id}|${r.section}`, { user_id: r.user_id, section: r.section, payload: r.payload });
        return res(201);
      }
      if (method === 'DELETE') {
        const secs = inList(q.get('section')) || [];
        if (eq(q.get('user_id')) !== me) return res(204);
        for (const s of secs) db.shared.delete(`${me}|${s}`);
        return res(204);
      }
    }
    if (path === '/rest/v1/covers') {
      if (flags.noCovers) return err(404, 'PGRST205', "Could not find the table 'public.covers' in the schema cache");
      const secs = ['reading', 'finished', 'favorites', 'recommendations'];
      if (method === 'GET') {
        const uid = eq(q.get('user_id')), cks = inList(q.get('ck'));
        const rows = [];
        for (const r of db.covers.values()) if (r.user_id === uid && (!cks || cks.includes(r.ck)) && (uid === me || canViewAny(me, uid, secs))) rows.push({ user_id: r.user_id, ck: r.ck, data: r.data });   // RLS
        return res(200, rows);
      }
      if (method === 'POST') {
        const list = Array.isArray(body) ? body : [body];
        if (list.some((r) => r.user_id !== me)) return err(403, '42501', 'new row violates row-level security policy');
        if (list.some((r) => String(r.data || '').length > 40000 || String(r.ck || '').length > 40)) return err(400, '23514', 'check violation');
        for (const r of list) db.covers.set(`${r.user_id}|${r.ck}`, { user_id: r.user_id, ck: r.ck, data: r.data });
        return res(201);
      }
      if (method === 'DELETE') {
        if (eq(q.get('user_id')) !== me) return res(204);
        for (const ck of inList(q.get('ck')) || []) db.covers.delete(`${me}|${ck}`);
        return res(204);
      }
    }
    return err(404, 'PGRST205', 'not found: ' + path);
  }

  /** Cria uma pessoa diretamente no servidor (para testes que precisam de "amigos" já existentes). */
  function seed({ name, number, display, sections = {}, privacy }) {
    const id = uuid(), email = `${name}${number}@readflow.app`;
    db.users.set(email, { id, email, password: 'segredo123' });
    db.profiles.set(id, { id, handle_name: name, handle_number: number, display_name: display || name, avatar: null, privacy: { bio: true, reading: true, finished: true, favorites: true, recommendations: true, achievements: true, activity: true, stats: true, ...(privacy || {}) } });
    for (const [section, payload] of Object.entries(sections)) db.shared.set(`${id}|${section}`, { user_id: id, section, payload });
    return id;
  }
  const seedCover = (uid, ck, data) => db.covers.set(`${uid}|${ck}`, { user_id: uid, ck, data });
  const follow = (follower, followee, status) => { db.follows = db.follows.filter((f) => !(f.follower_id === follower && f.followee_id === followee)); db.follows.push({ follower_id: follower, followee_id: followee, status, created_at: Date.now() }); };
  const uidOf = (handle) => { const m = /^([a-z0-9_]+)#(\d{6})$/.exec(handle); for (const p of db.profiles.values()) if (m && p.handle_name === m[1] && p.handle_number === +m[2]) return p.id; return null; };

  return { fetch: fetchMock, db, flags, log, seed, seedCover, follow, uidOf, key };
}
module.exports = { createMock };
