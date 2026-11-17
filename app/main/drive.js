/* ReadFlow — ligação ao Google Drive (corre no processo principal do Electron).
   Usa o acesso «drive.appdata»: uma pasta escondida e privada da app, dentro do Google Drive de cada pessoa.
   A app nunca vê os outros ficheiros do Drive. A ligação (token) fica guardada cifrada pelo Windows. */
'use strict';
const crypto = require('crypto');
const http = require('http');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

class DriveError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status; }
}

const PAGE = (title, msg) => `<!doctype html><html lang="pt"><meta charset="utf-8"><title>ReadFlow</title>
<body style="font-family:Segoe UI,system-ui,sans-serif;background:#F3F5FF;color:#1B2250;display:grid;place-items:center;height:100vh;margin:0">
<div style="background:#fff;padding:36px 44px;border-radius:18px;box-shadow:0 10px 30px rgba(51,71,255,.18);text-align:center;max-width:420px">
<h2 style="margin:0 0 10px">${title}</h2><p style="margin:0;color:#56607F">${msg}</p></div></body></html>`;

/** Cifra/decifra a ligação ao Google com uma chave derivada da palavra-passe do ReadFlow (nunca sai do computador). */
function sealToken(uid, password, payload) {
  const salt = crypto.createHash('sha256').update('readflow-vault:' + uid).digest().subarray(0, 16);
  const key = crypto.pbkdf2Sync(String(password), salt, 200000, 32, 'sha256');
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(payload), 'utf8'), c.final()]);
  return 'v1.' + b64url(Buffer.concat([iv, c.getAuthTag(), ct]));
}
function openToken(uid, password, blob) {
  try {
    if (!/^v1\./.test(String(blob))) throw new Error('formato');
    const raw = Buffer.from(String(blob).slice(3).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const salt = crypto.createHash('sha256').update('readflow-vault:' + uid).digest().subarray(0, 16);
    const key = crypto.pbkdf2Sync(String(password), salt, 200000, 32, 'sha256');
    const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
  } catch (e) { throw new DriveError('bad_password', 'Palavra-passe incorreta ou dados inválidos'); }
}

function createDrive(deps) {
  const { fetch, openExternal, tokenStore } = deps;
  const now = deps.now || Date.now, timeoutMs = deps.loopbackTimeoutMs || 180000;
  let cfg = { clientId: '', clientSecret: '' }, uid = null, tok = null, email = '';
  const ids = new Map();                                   // nome do ficheiro -> id no Drive

  const configured = () => !!(cfg.clientId && cfg.clientSecret);
  const status = () => ({ configured: configured(), connected: !!(uid && tok && tok.refresh), email });
  function configure(c) { cfg = { clientId: String((c && c.clientId) || '').trim(), clientSecret: String((c && c.clientSecret) || '').trim() }; return status(); }

  async function setUser(u) {
    uid = u || null; tok = null; email = ''; ids.clear();
    if (uid) {
      try { const s = await tokenStore.load(uid); if (s && s.refresh) { tok = { refresh: s.refresh, access: null, expires: 0 }; email = s.email || ''; } } catch (e) { /* sem token guardado */ }
    }
    return status();
  }

  async function tokenRequest(params) {
    let res;
    try { res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() }); }
    catch (e) { throw new DriveError('network', e.message); }
    let data = {}; try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const code = data.error === 'invalid_grant' ? 'auth' : data.error === 'invalid_client' ? 'bad_client' : 'token';
      throw new DriveError(code, data.error_description || data.error || ('HTTP ' + res.status), res.status);
    }
    return data;
  }

  async function access(force) {
    if (!uid || !tok) throw new DriveError('not_connected');
    if (!force && tok.access && now() < tok.expires) return tok.access;
    try {
      const d = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: tok.refresh, grant_type: 'refresh_token' });
      tok.access = d.access_token; tok.expires = now() + Math.max(60, (d.expires_in || 3600) - 60) * 1000;
      return tok.access;
    } catch (e) {
      if (e.code === 'auth') { try { await tokenStore.remove(uid); } catch (x) { /* ok */ } tok = null; }   // o acesso foi revogado
      throw e;
    }
  }

  async function api(url, init, retry) {
    init = init || {};
    const token = await access(false);
    let res;
    try { res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + token } }); }
    catch (e) { throw new DriveError('network', e.message); }
    if (res.status === 401 && retry !== false) { await access(true); return api(url, init, false); }
    if (res.ok) return res;
    let body = {}; try { body = await res.json(); } catch (e) { body = {}; }
    const reason = (((body.error || {}).errors || [])[0] || {}).reason || '', msg = (body.error && body.error.message) || ('HTTP ' + res.status);
    if (res.status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(reason + ' ' + msg)) throw new DriveError('api_disabled', msg, 403);
    if (res.status === 403 && /storageQuotaExceeded/i.test(reason)) throw new DriveError('quota', msg, 403);
    if (res.status === 429 || (res.status === 403 && /rate/i.test(reason))) throw new DriveError('rate', msg, res.status);
    if (res.status === 404) throw new DriveError('not_found', msg, 404);
    if (res.status >= 500) throw new DriveError('server', msg, res.status);
    throw new DriveError('drive', msg, res.status);
  }

  /** Servidor local (só 127.0.0.1) que recebe o código quando a pessoa autoriza no browser. */
  function listen(state) {
    return new Promise((resolve, reject) => {
      let done, fail, timer;
      const wait = new Promise((a, b) => { done = a; fail = b; });
      wait.catch(() => {});
      const server = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        const head = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
        if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
        const err = u.searchParams.get('error'), code = u.searchParams.get('code'), st = u.searchParams.get('state');
        if (err) { res.writeHead(200, head); res.end(PAGE('Não foi autorizado', 'Podes fechar esta janela e voltar ao ReadFlow.')); fail(new DriveError('denied', err)); return; }
        if (!code || st !== state) { res.writeHead(400, head); res.end(PAGE('Pedido inválido', 'Volta ao ReadFlow e tenta outra vez.')); return; }
        res.writeHead(200, head); res.end(PAGE('ReadFlow ligado ao Google Drive', 'Já podes fechar esta janela e voltar ao ReadFlow.'));
        done(code);
      });
      server.on('error', (e) => reject(new DriveError('loopback', e.message)));
      server.listen(0, '127.0.0.1', () => {
        timer = setTimeout(() => fail(new DriveError('timeout', 'A autorização demorou demasiado')), timeoutMs);
        resolve({ port: server.address().port, wait, close: () => { clearTimeout(timer); if (server.closeAllConnections) server.closeAllConnections(); server.close(); } });
      });
    });
  }

  async function connect() {
    if (!configured()) throw new DriveError('not_configured');
    if (!uid) throw new DriveError('no_user');
    const verifier = b64url(crypto.randomBytes(32)), challenge = b64url(crypto.createHash('sha256').update(verifier).digest()), state = b64url(crypto.randomBytes(16));
    const srv = await listen(state), redirect = `http://127.0.0.1:${srv.port}`;
    try {
      const url = AUTH_URL + '?' + new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE, code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent' }).toString();
      await openExternal(url);
      const code = await srv.wait;
      const d = await tokenRequest({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' });
      if (!d.refresh_token) throw new DriveError('no_refresh', 'O Google não devolveu a ligação permanente. Remove o acesso do ReadFlow na tua conta Google e tenta outra vez.');
      tok = { refresh: d.refresh_token, access: d.access_token, expires: now() + Math.max(60, (d.expires_in || 3600) - 60) * 1000 };
      email = '';
      try { const about = await (await api(DRIVE + '/about?fields=user(emailAddress)')).json(); email = (about.user && about.user.emailAddress) || ''; } catch (e) { email = ''; }
      try { await tokenStore.save(uid, { refresh: tok.refresh, email }); } catch (e) { /* só em memória */ }
      return status();
    } finally { srv.close(); }
  }

  async function disconnect() {
    if (tok && tok.refresh) { try { await fetch(REVOKE_URL + '?token=' + encodeURIComponent(tok.refresh), { method: 'POST' }); } catch (e) { /* sem rede: fica só o apagar local */ } }
    if (uid) { try { await tokenStore.remove(uid); } catch (e) { /* ok */ } }
    tok = null; email = ''; ids.clear();
    return status();
  }

  async function list() {
    const out = []; let page = '';
    do {
      const q = new URLSearchParams({ spaces: 'appDataFolder', pageSize: '1000', fields: 'nextPageToken,files(id,name,modifiedTime,size)' });
      if (page) q.set('pageToken', page);
      const d = await (await api(DRIVE + '/files?' + q.toString())).json();
      out.push(...(d.files || [])); page = d.nextPageToken || '';
    } while (page);
    ids.clear(); for (const f of out) ids.set(f.name, f.id);
    return out;
  }
  async function stat(name) {
    const q = new URLSearchParams({ spaces: 'appDataFolder', q: `name = '${String(name).replace(/'/g, "\\'")}'`, fields: 'files(id,name,modifiedTime,size)' });
    const d = await (await api(DRIVE + '/files?' + q.toString())).json();
    const f = (d.files || [])[0] || null;
    if (f) ids.set(f.name, f.id);
    return f;
  }
  const findId = async (name) => ids.get(name) || ((await stat(name)) || {}).id || null;

  async function read(name) {
    const id = await findId(name);
    if (!id) return null;
    try { return Buffer.from(await (await api(`${DRIVE}/files/${id}?alt=media`)).arrayBuffer()); }
    catch (e) { if (e.code === 'not_found') { ids.delete(name); return null; } throw e; }
  }
  async function write(name, bytes, mime) {
    const body = Buffer.from(bytes), type = mime || 'application/octet-stream';
    const id = await findId(name);
    if (id) {
      try { return await (await api(`${UPLOAD}/files/${id}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': type }, body })).json(); }
      catch (e) { if (e.code !== 'not_found') throw e; ids.delete(name); }   // foi apagado fora da app: volta a criar
    }
    const boundary = 'rf' + b64url(crypto.randomBytes(12));
    const multipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: ['appDataFolder'] })}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`),
      body, Buffer.from(`\r\n--${boundary}--`)]);
    const d = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart })).json();
    ids.set(name, d.id);
    return d;
  }
  async function remove(name) {
    const id = await findId(name);
    if (!id) return false;
    try { await api(`${DRIVE}/files/${id}`, { method: 'DELETE' }); } catch (e) { if (e.code !== 'not_found') throw e; }
    ids.delete(name);
    return true;
  }
  async function wipeAll() { let n = 0; for (const f of await list()) { if (await remove(f.name)) n++; } return n; }

  async function exportToken(password) {
    if (!uid || !tok) throw new DriveError('not_connected');
    return sealToken(uid, password, { r: tok.refresh, e: email });
  }
  async function importToken(blob, password) {
    if (!uid) throw new DriveError('no_user');
    const p = openToken(uid, password, blob);
    if (!p || !p.r) throw new DriveError('bad_password');
    tok = { refresh: p.r, access: null, expires: 0 }; email = p.e || '';
    try { await tokenStore.save(uid, { refresh: tok.refresh, email }); } catch (e) { /* só em memória */ }
    return status();
  }

  return { configure, setUser, status, connect, disconnect, list, stat, read, write, remove, wipeAll, exportToken, importToken };
}

module.exports = { createDrive, DriveError, sealToken, openToken, SCOPE };
