
// Testes do módulo do Google Drive (processo principal) com um «Google» falso em memória.
const crypto = require('crypto');
const http = require('http');
const { createDrive, sealToken, openToken } = require('../app/main/drive.js');

const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fakeGoogle() {
  const g = { files: new Map(), codes: new Map(), refresh: new Map(), access: new Set(), revoked: [], log: [], n: 0, noRefresh: false, fail: null, netDown: false };
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, arrayBuffer: async () => Buffer.from(JSON.stringify(body)) });
  const raw = (bytes) => ({ ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  g.expireAccess = () => g.access.clear();
  g.fetch = async (url, init) => {
    if (g.netDown) throw new Error('ECONNRESET');
    init = init || {}; const u = new URL(url), method = (init.method || 'GET').toUpperCase();
    g.log.push(method + ' ' + u.pathname);
    if (u.origin + u.pathname === 'https://oauth2.googleapis.com/token') {
      const p = new URLSearchParams(init.body);
      if (p.get('client_id') !== 'CID') return json(401, { error: 'invalid_client' });
      if (p.get('grant_type') === 'authorization_code') {
        const c = g.codes.get(p.get('code'));
        if (!c || b64url(crypto.createHash('sha256').update(p.get('code_verifier') || '').digest()) !== c.challenge || p.get('redirect_uri') !== c.redirect) return json(400, { error: 'invalid_grant' });
        const at = 'AT' + (++g.n), rt = 'RT' + g.n; g.access.add(at); g.refresh.set(rt, true);
        return json(200, { access_token: at, expires_in: 3600, ...(g.noRefresh ? {} : { refresh_token: rt }), scope: 'drive.appdata' });
      }
      if (p.get('grant_type') === 'refresh_token') {
        if (!g.refresh.get(p.get('refresh_token'))) return json(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
        const at = 'AT' + (++g.n); g.access.add(at); return json(200, { access_token: at, expires_in: 3600 });
      }
    }
    if (u.origin + u.pathname === 'https://oauth2.googleapis.com/revoke') { g.revoked.push(u.searchParams.get('token')); g.refresh.set(u.searchParams.get('token'), false); return json(200, {}); }
    const bearer = ((init.headers || {}).Authorization || '').replace('Bearer ', '');
    if (!g.access.has(bearer)) return json(401, { error: { message: 'Invalid Credentials' } });
    if (g.fail) { const f = g.fail; g.fail = null; return json(f.status, { error: { message: f.message || 'x', errors: [{ reason: f.reason || '' }] } }); }
    if (u.pathname === '/drive/v3/about') return json(200, { user: { emailAddress: 'leitor@gmail.com' } });
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      if (u.searchParams.get('spaces') !== 'appDataFolder') return json(400, { error: { message: 'spaces' } });
      let list = [...g.files.values()];
      const q = u.searchParams.get('q'); if (q) { const m = /name = '(.*)'/.exec(q); list = list.filter((f) => f.name === m[1].replace(/\\'/g, "'")); }
      const size = Math.min(+u.searchParams.get('pageSize') || 100, 1000), start = +(u.searchParams.get('pageToken') || 0);
      const page = list.slice(start, start + size).map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: String(f.bytes.length) }));
      return json(200, { files: page, ...(start + size < list.length ? { nextPageToken: String(start + size) } : {}) });
    }
    if (u.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const boundary = /boundary=(.+)$/.exec(init.headers['Content-Type'])[1], body = Buffer.from(init.body);
      const parts = body.toString('latin1').split('--' + boundary).filter((x) => x.trim() && x.trim() !== '--');
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].replace(/\r\n$/, ''));
      const start = body.indexOf(Buffer.from('\r\n\r\n', 'latin1'), body.indexOf(Buffer.from('--' + boundary + '\r\nContent-Type: ', 'latin1'), 10) ) + 4;
      const mediaStart = body.indexOf(Buffer.from('\r\n\r\n'), body.indexOf(Buffer.from('Content-Type: ', 'latin1'), body.indexOf(Buffer.from('}'))) ) + 4;
      const bytes = body.subarray(mediaStart, body.length - (`\r\n--${boundary}--`).length);
      if (!meta.parents || meta.parents[0] !== 'appDataFolder') return json(400, { error: { message: 'parents' } });
      const id = 'F' + (++g.n); g.files.set(id, { id, name: meta.name, bytes: Buffer.from(bytes), modifiedTime: new Date(1700000000000 + g.n * 1000).toISOString() });
      return json(200, { id, name: meta.name, modifiedTime: g.files.get(id).modifiedTime });
    }
    const m = /^\/(upload\/)?drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (m) {
      const f = g.files.get(m[2]);
      if (!f) return json(404, { error: { message: 'File not found' } });
      if (method === 'GET') return raw(f.bytes);
      if (method === 'PATCH') { f.bytes = Buffer.from(init.body); f.modifiedTime = new Date(1700000000000 + (++g.n) * 1000).toISOString(); return json(200, { id: f.id, modifiedTime: f.modifiedTime }); }
      if (method === 'DELETE') { g.files.delete(m[2]); return { ok: true, status: 204, json: async () => ({}) }; }
    }
    return json(404, { error: { message: 'rota desconhecida ' + u.pathname } });
  };
  return g;
}

// «Browser» falso: lê o pedido de autorização, valida-o e devolve o código ao servidor local da app.
function fakeBrowser(g, mode) {
  g.lastAuth = null;
  return async (url) => {
    const u = new URL(url), p = u.searchParams; g.lastAuth = Object.fromEntries(p);
    if (mode && mode.nothing) return;
    const redirect = p.get('redirect_uri'), code = 'CODE' + (++g.n);
    g.codes.set(code, { challenge: p.get('code_challenge'), redirect });
    const get = (q) => new Promise((resolve, reject) => http.get(redirect + '/?' + q, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject));
    if (mode && mode.denied) { await get('error=access_denied&state=' + p.get('state')); return; }
    if (mode && mode.badState) g.badStateStatus = await get('code=' + code + '&state=WRONG');
    await get('code=' + code + '&state=' + p.get('state'));
  };
}
const memStore = () => { const m = new Map(); return { m, load: async (u) => m.get(u) || null, save: async (u, v) => { m.set(u, JSON.parse(JSON.stringify(v))); }, remove: async (u) => { m.delete(u); } }; };
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const rejects = async (fn, code, msg) => { try { await fn(); } catch (e) { must(e.code === code, `${msg}: esperava «${code}» e veio «${e.code || e.message}»`); return; } throw new Error(msg + ': devia ter falhado'); };

async function run(ok) {
  const g = fakeGoogle(), store = memStore();
  const mk = (extra) => createDrive({ fetch: g.fetch, openExternal: fakeBrowser(g), tokenStore: store, loopbackTimeoutMs: 4000, ...(extra || {}) });
  let d = mk();

  await rejects(() => d.connect(), 'not_configured', 'sem configuração');
  d.configure({ clientId: 'CID' });
  await rejects(() => d.connect(), 'no_user', 'sem utilizador');
  ok('Google: sem configuração ou sem conta, a ligação recusa com um erro claro');

  await d.setUser('u1');
  const st = await d.connect();
  must(st.connected && st.email === 'leitor@gmail.com', 'estado depois de ligar: ' + JSON.stringify(st));
  const A = g.lastAuth;
  must(A.client_id === 'CID' && /^http:\/\/127\.0\.0\.1:\d+$/.test(A.redirect_uri) && A.scope === 'https://www.googleapis.com/auth/drive.appdata' && A.code_challenge_method === 'S256' && A.access_type === 'offline' && A.prompt === 'consent' && A.response_type === 'code' && A.state.length >= 16, 'pedido de autorização: ' + JSON.stringify(A));
  must(store.m.get('u1').refresh.startsWith('RT'), 'a ligação devia ficar guardada');
  ok('Google: autorização com PKCE (S256), só a pasta privada da app, servidor local 127.0.0.1 e ligação guardada');

  await d.disconnect(); await d.setUser('u1');
  d = mk({ openExternal: fakeBrowser(g, { badState: true }) }); d.configure({ clientId: 'CID' }); await d.setUser('u1');
  must((await d.connect()).connected && g.badStateStatus === 400, 'um pedido com «state» errado devia ser recusado (400) sem estragar a ligação');
  ok('Google: pedidos de retorno com «state» errado são recusados');

  d = mk({ openExternal: fakeBrowser(g, { denied: true }) }); d.configure({ clientId: 'CID' }); await d.setUser('u2');
  await rejects(() => d.connect(), 'denied', 'recusar no Google');
  d = mk({ openExternal: fakeBrowser(g, { nothing: true }), loopbackTimeoutMs: 250 }); d.configure({ clientId: 'CID' }); await d.setUser('u2');
  await rejects(() => d.connect(), 'timeout', 'demora');
  g.noRefresh = true; d = mk(); d.configure({ clientId: 'CID' }); await d.setUser('u2');
  await rejects(() => d.connect(), 'no_refresh', 'sem ligação permanente'); g.noRefresh = false;
  d = mk(); d.configure({ clientId: 'ERRADO' }); await d.setUser('u2');
  await rejects(() => d.connect(), 'bad_client', 'Client ID errado');
  ok('Google: recusa, demora, ausência de «refresh token» e Client ID errado dão erros distintos');

  d = mk(); d.configure({ clientId: 'CID' }); await d.setUser('u1');
  must((await d.status()).connected, 'a ligação guardada devia ser restaurada num novo arranque');
  const bin = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
  await d.write('img-a', bin, 'image/jpeg'); await d.write('readflow-data.json', Buffer.from('{"v":1,"nome":"Introdução"}'), 'application/json');
  must(Buffer.compare(await d.read('img-a'), bin) === 0, 'leitura binária igual à escrita');
  must((await d.read('readflow-data.json')).toString('utf8') === '{"v":1,"nome":"Introdução"}', 'texto com acentos');
  await d.write('readflow-data.json', Buffer.from('{"v":2}'), 'application/json');
  must((await d.read('readflow-data.json')).toString() === '{"v":2}' && (await d.list()).filter((f) => f.name === 'readflow-data.json').length === 1, 'atualizar não duplica o ficheiro');
  must(await d.read('nao-existe') === null, 'ficheiro inexistente devolve null');
  must((await d.stat('img-a')).name === 'img-a' && await d.stat('nada') === null, 'stat');
  ok('Google Drive: criar, ler (binário e acentos), atualizar sem duplicar, stat e inexistentes');

  for (let i = 0; i < 1500; i++) { const id = 'B' + i; g.files.set(id, { id, name: 'img-' + i, bytes: Buffer.from('x'), modifiedTime: '2026-01-01T00:00:00Z' }); }
  const all = await d.list(); must(all.length === 1502, 'paginação: ' + all.length);
  ok('Google Drive: listagem com mais de 1000 ficheiros (paginada)');

  g.expireAccess(); const before = g.log.filter((x) => x.includes('/token')).length;
  must(Buffer.compare(await d.read('img-a'), bin) === 0, 'depois de expirar o acesso'); must(g.log.filter((x) => x.includes('/token')).length > before, 'devia renovar o acesso sozinho');
  g.expireAccess(); g.access.add('FORCADO');
  ok('Google: o acesso expirado é renovado automaticamente');

  g.fail = { status: 403, reason: 'accessNotConfigured', message: 'Google Drive API has not been used in project' }; await rejects(() => d.list(), 'api_disabled', 'API desligada');
  g.fail = { status: 403, reason: 'storageQuotaExceeded' }; await rejects(() => d.write('x', Buffer.from('1')), 'quota', 'Drive cheio');
  g.fail = { status: 429 }; await rejects(() => d.list(), 'rate', 'demasiados pedidos');
  g.fail = { status: 503 }; await rejects(() => d.list(), 'server', 'erro do servidor');
  g.netDown = true; await rejects(() => d.list(), 'network', 'sem rede'); g.netDown = false;
  ok('Google: erros (API desligada, Drive cheio, limite de pedidos, servidor, rede) têm códigos próprios');

  const blob = await d.exportToken('segredo123'); must(!blob.includes('RT') && /^v1\./.test(blob), 'o blob não pode conter o token em claro');
  const d2 = mk(); d2.configure({ clientId: 'CID' }); await d2.setUser('u1'); await d2.disconnect(); await d2.setUser('u1');
  const d3 = mk(); d3.configure({ clientId: 'CID' }); await d3.setUser('u9'); await d3.connect();
  const sealed = await d3.exportToken('palavra-passe');
  const d4 = mk(); d4.configure({ clientId: 'CID' }); await d4.setUser('u9');
  await d4.disconnect(); g.refresh.set(store.m.get('u9') ? store.m.get('u9').refresh : 'x', true);
  await d4.setUser('u9'); must(!(await d4.status()).connected, 'ainda desligado');
  const dNew = mk(); dNew.configure({ clientId: 'CID' }); await dNew.setUser('u9');
  g.refresh.set(openToken('u9', 'palavra-passe', sealed).r, true);
  await rejects(() => dNew.importToken(sealed, 'errada'), 'bad_password', 'palavra-passe errada');
  const dOther = mk(); dOther.configure({ clientId: 'CID' }); await dOther.setUser('outro');
  await rejects(() => dOther.importToken(sealed, 'palavra-passe'), 'bad_password', 'conta diferente');
  must((await dNew.importToken(sealed, 'palavra-passe')).connected, 'palavra-passe certa devia ligar');
  await dNew.list();
  ok('Cofre: a ligação ao Google viaja cifrada (AES-GCM) e só abre com a palavra-passe do ReadFlow da mesma conta');

  g.access.clear(); g.refresh.clear();
  const dr = mk(); dr.configure({ clientId: 'CID' }); await dr.setUser('u9');
  await rejects(() => dr.list(), 'auth', 'acesso revogado'); must(!(await dr.status()).connected && !store.m.has('u9'), 'depois de revogado fica desligado e sem token guardado');
  ok('Google: se o acesso for revogado, a app fica desligada e apaga o token guardado');

  const dw = mk(); dw.configure({ clientId: 'CID' }); await dw.setUser('u7'); await dw.connect();
  const n = await dw.wipeAll(); must(n > 1000 && (await dw.list()).length === 0, 'apagar tudo: ' + n);
  const r0 = g.revoked.length; await dw.disconnect(); must(g.revoked.length === r0 + 1 && !store.m.has('u7'), 'desligar revoga no Google e apaga o token local');
  ok('Google: «apagar cópia» remove tudo da pasta da app e desligar revoga o acesso');

  const s1 = sealToken('x', 'a', { r: 'tok' }), s2 = sealToken('x', 'a', { r: 'tok' }); must(s1 !== s2 && openToken('x', 'a', s1).r === 'tok', 'cifra com IV aleatório');
}
module.exports = { run };
if (require.main === module) run((m) => console.log('OK   ' + m)).then(() => console.log('\nTUDO OK')).catch((e) => { console.error('FALHOU:', e); process.exit(1); });
