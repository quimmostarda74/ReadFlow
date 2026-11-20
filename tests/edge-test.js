// Testes da função do servidor (supabase/functions/google-token): corre o código real com um Supabase e um Google falsos.
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'google-token', 'index.ts'), 'utf8');

function build(env, fetchImpl) {
  const holder = {};
  const code = SRC.replace('Deno.serve(handle);', 'holder.handle = handle;');
  new Function('Deno', 'fetch', 'holder', code)({ env: { get: (k) => env[k] } }, fetchImpl, holder);
  return holder.handle;
}
const must = (c, m) => { if (!c) throw new Error(m); };
const POST = (body, headers) => new Request('https://x.supabase.co/functions/v1/google-token', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const GOOD = { Authorization: 'Bearer ' + 'a'.repeat(40), apikey: 'sb_publishable_test' };
const VERIFIER = 'v'.repeat(50);

async function run(ok) {
  const calls = [];
  let googleReply = { status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 's', token_type: 'Bearer', id_token: 'NAO-DEVE-SAIR' } };
  let authOk = true;
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/v1/user')) return authOk ? new Response(JSON.stringify({ id: 'user-1' }), { status: 200 }) : new Response('{}', { status: 401 });
    if (String(url) === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify(googleReply.body), { status: googleReply.status });
    return new Response('{}', { status: 404 });
  };
  const env = { SUPABASE_URL: 'https://proj.supabase.co', GOOGLE_CLIENT_ID: 'CID', GOOGLE_CLIENT_SECRET: 'SEGREDO-DO-GOOGLE' };
  let handle = build(env, fetchImpl);
  const raw = async (body, headers) => { const r = await handle(POST(body, headers || GOOD)); const t = await r.text(); return { status: r.status, text: t, body: JSON.parse(t) }; };

  must((await handle(new Request('https://x', { method: 'GET' }))).status === 405, 'só aceita POST');
  must((await raw({ action: 'refresh', refresh_token: 'R' }, {})).status === 401, 'sem credenciais: 401');
  must((await raw({ action: 'refresh', refresh_token: 'R' }, { Authorization: 'Bearer curto', apikey: 'k' })).status === 401, 'token mal formado: 401');
  authOk = false; must((await raw({ action: 'refresh', refresh_token: 'R' })).body.error === 'invalid_session', 'sessão inválida: recusa'); authOk = true;
  must(!calls.some((c) => c.url.includes('oauth2.googleapis.com')), 'sem sessão válida nunca chega ao Google');
  ok('função do servidor: só aceita POST de utilizadores do ReadFlow com sessão válida');

  calls.length = 0;
  let r = await raw({ action: 'exchange', code: 'CODE', code_verifier: VERIFIER, redirect_uri: 'http://127.0.0.1:53210' });
  must(r.status === 200 && r.body.access_token === 'AT' && r.body.refresh_token === 'RT', 'troca de código: ' + r.text);
  const gcall = calls.find((c) => c.url === 'https://oauth2.googleapis.com/token'), sent = new URLSearchParams(gcall.init.body);
  must(sent.get('client_secret') === 'SEGREDO-DO-GOOGLE' && sent.get('client_id') === 'CID' && sent.get('grant_type') === 'authorization_code' && sent.get('code') === 'CODE' && sent.get('code_verifier') === VERIFIER && sent.get('redirect_uri') === 'http://127.0.0.1:53210', 'o Google recebe o segredo do servidor e o pedido certo');
  must(!r.text.includes('SEGREDO-DO-GOOGLE') && !r.text.includes('NAO-DEVE-SAIR'), 'a resposta nunca inclui o segredo nem campos a mais');
  const authCall = calls.find((c) => c.url.endsWith('/auth/v1/user')); must(authCall.init.headers.apikey === 'sb_publishable_test' && /^Bearer /.test(authCall.init.headers.Authorization), 'a sessão é confirmada com a chave e o token enviados');
  r = await raw({ action: 'refresh', refresh_token: 'RT' }); const s2 = new URLSearchParams(calls[calls.length - 1].init.body);
  must(r.status === 200 && s2.get('grant_type') === 'refresh_token' && s2.get('refresh_token') === 'RT' && s2.get('client_secret') === 'SEGREDO-DO-GOOGLE', 'renovar o acesso');
  ok('função do servidor: troca o código e renova o acesso com o segredo guardado no servidor, sem o devolver');

  for (const bad of [
    { action: 'exchange', code: 'C', code_verifier: VERIFIER, redirect_uri: 'https://evil.example/cb' }, { action: 'exchange', code: 'C', code_verifier: VERIFIER, redirect_uri: 'http://127.0.0.1.evil.com:80' },
    { action: 'exchange', code: 'C', code_verifier: 'curto', redirect_uri: 'http://127.0.0.1:5000' }, { action: 'exchange', code: 'x'.repeat(3000), code_verifier: VERIFIER, redirect_uri: 'http://127.0.0.1:5000' },
    { action: 'exchange', code_verifier: VERIFIER, redirect_uri: 'http://127.0.0.1:5000' }, { action: 'refresh' }, { action: 'refresh', refresh_token: 5 }]) must((await raw(bad)).status === 400, 'pedido inválido recusado: ' + JSON.stringify(bad).slice(0, 80));
  must((await raw({ action: 'revoke' })).body.error === 'bad_action' && (await raw({})).status === 400, 'só exchange e refresh');
  const badJson = await handle(new Request('https://x', { method: 'POST', headers: GOOD, body: '{nao-json' })); must(badJson.status === 400, 'JSON inválido');
  ok('função do servidor: recusa redirecionamentos que não sejam o endereço local, verificadores curtos, códigos enormes e ações desconhecidas');

  googleReply = { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } };
  r = await raw({ action: 'refresh', refresh_token: 'RT' }); must(r.status === 400 && r.body.error === 'invalid_grant', 'erro do Google passa com o código certo');
  googleReply = { status: 401, body: { error: 'invalid_client' } }; r = await raw({ action: 'refresh', refresh_token: 'RT' }); must(r.status === 401 && r.body.error === 'invalid_client', 'invalid_client');
  googleReply = { status: 500, body: { error: 'x' } }; r = await raw({ action: 'refresh', refresh_token: 'RT' }); must(r.status === 502, 'erro do Google vira 502');
  handle = build({ SUPABASE_URL: 'https://proj.supabase.co' }, fetchImpl); r = await raw({ action: 'refresh', refresh_token: 'RT' }); must(r.status === 500 && r.body.error === 'not_configured', 'sem os segredos configurados no Supabase');
  handle = build(env, fetchImpl); googleReply = { status: 200, body: { access_token: 'AT' } };
  let last = 0; for (let i = 0; i < 40; i++) last = (await raw({ action: 'refresh', refresh_token: 'RT' })).status; must(last === 429, 'limite de pedidos por minuto: ' + last);
  ok('função do servidor: erros do Google, segredos em falta e limite de 30 pedidos por minuto por pessoa');
}
module.exports = { run };
if (require.main === module) run((m) => console.log('OK   ' + m)).then(() => console.log('\nTUDO OK')).catch((e) => { console.error('FALHOU:', e); process.exit(1); });
