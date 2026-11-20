// «Google Drive» falso para testar a sincronização: um disco na nuvem partilhado e a ligação deste «computador».
function createFakeDrive() {
  const f = { cloud: new Map(), n: 0, uid: null, connected: new Set(), email: 'leitor@gmail.com', down: false, failCode: null, hookStat: null, calls: [], auth: '' };
  const coded = (code) => Object.assign(new Error(code), { code });
  const guard = (name) => { f.calls.push(name); if (f.down) throw coded('network'); if (f.failCode) { const c = f.failCode; f.failCode = null; throw coded(c); } };
  const status = () => ({ configured: true, connected: !!(f.uid && f.connected.has(f.uid)), email: f.connected.has(f.uid) ? f.email : '' });
  const need = () => { if (!status().connected) throw coded('not_connected'); };
  const time = () => new Date(1700000000000 + (++f.n) * 60000).toISOString();
  const api = {
    configure: async () => status(), setAuth: async (jwt) => { f.auth = jwt; return true; }, setUser: async (uid) => { f.uid = uid; return status(); }, status: async () => status(),
    connect: async () => { guard('connect'); f.connected.add(f.uid); return status(); },
    disconnect: async () => { f.connected.delete(f.uid); return status(); },
    list: async () => { guard('list'); need(); return [...f.cloud].map(([name, x]) => ({ id: 'id-' + name, name, modifiedTime: x.modifiedTime, size: String(x.bytes.length) })); },
    stat: async (name) => { guard('stat'); need(); if (f.hookStat) { const h = f.hookStat; f.hookStat = null; h(); } const x = f.cloud.get(name); return x ? { id: 'id-' + name, name, modifiedTime: x.modifiedTime } : null; },
    read: async (name) => { guard('read'); need(); const x = f.cloud.get(name); return x ? new Uint8Array(x.bytes) : null; },
    write: async (name, bytes) => { guard('write'); need(); const x = { bytes: new Uint8Array(bytes), modifiedTime: time() }; f.cloud.set(name, x); return { id: 'id-' + name, modifiedTime: x.modifiedTime }; },
    remove: async (name) => { guard('remove'); need(); return f.cloud.delete(name); },
    wipe: async () => { guard('wipe'); need(); const n = f.cloud.size; f.cloud.clear(); return n; },
    vaultExport: async (pw) => { need(); return 'v1.' + Buffer.from(JSON.stringify({ pw, uid: f.uid })).toString('base64'); },
    vaultImport: async (blob, pw) => { const p = JSON.parse(Buffer.from(String(blob).slice(3), 'base64').toString()); if (p.pw !== pw || p.uid !== f.uid) throw coded('bad_password'); f.connected.add(f.uid); return status(); }
  };
  f.api = api; f.setCloudFile = (name, bytes, modifiedTime) => f.cloud.set(name, { bytes: new Uint8Array(bytes), modifiedTime: modifiedTime || time() });
  return f;
}
module.exports = { createFakeDrive };
