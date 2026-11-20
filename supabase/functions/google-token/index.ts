// ReadFlow · «cofre» do segredo do Google (Supabase Edge Function).
// O segredo do cliente do Google fica AQUI (nos «Secrets» do Supabase) e nunca no programa nem no GitHub.
// A app só envia o código de autorização (ou o token de renovação); esta função acrescenta o segredo, fala com o Google e devolve o resultado.
//
// Como instalar (ver docs/NUVEM-GOOGLE-DRIVE.md, Parte E):
//   1. Supabase > Edge Functions > Deploy a new function > Via Editor > nome: google-token > colar ESTE ficheiro > Deploy.
//      Se aparecer a opção «Verify JWT», deixa DESLIGADA (esta função verifica a sessão por dentro).
//   2. Supabase > Edge Functions > Secrets: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (os valores do teu cliente OAuth do Google).
//
// Só aceita pedidos de utilizadores do ReadFlow com sessão válida, só troca/renova tokens e limita o número de pedidos por pessoa.
// Não regista (nem guarda) códigos nem tokens.

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const LIMIT_PER_MINUTE = 30;
const hits = new Map();            // utilizador -> instantes dos últimos pedidos (por instância da função)

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const isString = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

async function handle(req) {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // 1) Quem chama tem de ser um utilizador do ReadFlow com sessão válida (confirmado junto do Supabase Auth).
  const auth = req.headers.get('Authorization') || '', apikey = req.headers.get('apikey') || '';
  if (!/^Bearer \S{20,}$/.test(auth) || !apikey) return json(401, { error: 'missing_auth' });
  let user = null;
  try {
    const r = await fetch(Deno.env.get('SUPABASE_URL') + '/auth/v1/user', { headers: { Authorization: auth, apikey } });
    if (!r.ok) return json(401, { error: 'invalid_session' });
    user = await r.json();
  } catch (e) { return json(502, { error: 'auth_unreachable' }); }
  if (!user || !user.id) return json(401, { error: 'invalid_session' });

  // 2) Limite de pedidos por pessoa.
  const now = Date.now(), recent = (hits.get(user.id) || []).filter((t) => now - t < 60000);
  if (recent.length >= LIMIT_PER_MINUTE) return json(429, { error: 'rate_limited' });
  recent.push(now); hits.set(user.id, recent);
  if (hits.size > 5000) hits.clear();

  // 3) Pedido: só «exchange» (código -> tokens) e «refresh» (renovar o acesso).
  let body = null;
  try { body = await req.json(); } catch (e) { return json(400, { error: 'bad_json' }); }
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID'), clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json(500, { error: 'not_configured' });

  let params = null;
  if (body && body.action === 'exchange') {
    const okVerifier = typeof body.code_verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier);
    const okRedirect = typeof body.redirect_uri === 'string' && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(body.redirect_uri);   // só o endereço local da app
    if (!isString(body.code, 2048) || !okVerifier || !okRedirect) return json(400, { error: 'bad_request' });
    params = { grant_type: 'authorization_code', code: body.code, code_verifier: body.code_verifier, redirect_uri: body.redirect_uri };
  } else if (body && body.action === 'refresh') {
    if (!isString(body.refresh_token, 2048)) return json(400, { error: 'bad_request' });
    params = { grant_type: 'refresh_token', refresh_token: body.refresh_token };
  } else return json(400, { error: 'bad_action' });

  let g = null, data = {};
  try {
    g = await fetch(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret }).toString() });
    data = await g.json();
  } catch (e) { return json(502, { error: 'google_unreachable' }); }
  const status = g.ok ? 200 : (g.status === 400 || g.status === 401 ? g.status : 502);
  // Devolve só o que a app precisa.
  const out = g.ok
    ? { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, scope: data.scope, token_type: data.token_type }
    : { error: data.error || 'google_error', error_description: data.error_description };
  return json(status, out);
}

Deno.serve(handle);
