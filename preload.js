const { contextBridge, ipcRenderer } = require('electron');

// Ponte segura entre a janela e o programa (só o que é preciso para as atualizações).
// As chamadas ao Google Drive devolvem {ok, value} ou {ok:false, code, message}; aqui viram valores ou erros com «code».
const call = async (channel, ...args) => {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (r && r.ok === false) { const e = new Error(r.message || r.code); e.code = r.code; throw e; }
  return r && r.value;
};
const drive = {
  configure: (cfg) => call('drive:configure', cfg), setUser: (uid) => call('drive:set-user', uid), setAuth: (jwt) => call('drive:set-auth', jwt), status: () => call('drive:status'),
  connect: () => call('drive:connect'), disconnect: () => call('drive:disconnect'), list: () => call('drive:list'), stat: (name) => call('drive:stat', name),
  read: (name) => call('drive:read', name), write: (name, bytes, mime) => call('drive:write', name, bytes, mime), remove: (name) => call('drive:remove', name),
  wipe: () => call('drive:wipe'), vaultExport: (password) => call('drive:vault-export', password), vaultImport: (blob, password) => call('drive:vault-import', blob, password)
};

contextBridge.exposeInMainWorld('readflowApp', {
  drive,
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkUpdates: () => ipcRenderer.invoke('app:check-updates'),
  copyText: (text) => ipcRenderer.invoke('app:copy', String(text)),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  onUpdateStatus: (callback) => { ipcRenderer.on('updater:status', (_event, payload) => callback(payload)); }
});
