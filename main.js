const { app, BrowserWindow, Menu, session, shell, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { createDrive } = require('./app/main/drive.js');

// A atualização automática só existe na versão instalada (não no modo de desenvolvimento).
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (e) { autoUpdater = null; }

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 640,
    backgroundColor: '#14193F', title: 'ReadFlow', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
  // Links externos abrem no navegador, nunca dentro da app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

/** Notas da versão (a descrição que escreves na release do GitHub), sem etiquetas HTML. */
function notesOf(info) {
  const n = info && info.releaseNotes;
  const text = typeof n === 'string' ? n : Array.isArray(n) ? n.map((x) => (x && x.note) || '').join('\n') : '';
  return text.replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, 1500);
}

function sendStatus(status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:status', { status, ...(extra || {}) });
}

function setupUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendStatus('checking'));
  autoUpdater.on('update-available', (info) => sendStatus('available', { version: info.version, notes: notesOf(info) }));
  autoUpdater.on('update-not-available', () => sendStatus('none'));
  autoUpdater.on('download-progress', (p) => sendStatus('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('error', (err) => sendStatus('error', { message: String((err && err.message) || err) }));
  autoUpdater.on('update-downloaded', (info) => {
    sendStatus('downloaded', { version: info.version, notes: notesOf(info) });
    dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Reiniciar agora', 'Mais tarde'], defaultId: 0, cancelId: 1,
      message: 'Há uma nova versão do ReadFlow', detail: `A versão ${info.version} está pronta. Reinicia a app para atualizar. Os teus dados ficam guardados.`
    }).then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 5000);                       // ao abrir
  setInterval(check, 6 * 60 * 60 * 1000);        // e de 6 em 6 horas
}

/* ---------- Google Drive (cópia na nuvem) ---------- */
// A ligação ao Google fica guardada cifrada pelo Windows (safeStorage), uma por conta do ReadFlow.
const { safeStorage } = require('electron');
const tokenFile = (uid) => path.join(app.getPath('userData'), 'drive-' + String(uid).replace(/[^a-zA-Z0-9-]/g, '') + '.bin');
const tokenStore = {
  async load(uid) { try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(tokenFile(uid)))); } catch (e) { return null; } },
  async save(uid, value) { if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(tokenFile(uid), safeStorage.encryptString(JSON.stringify(value))); },
  async remove(uid) { try { fs.unlinkSync(tokenFile(uid)); } catch (e) { /* já não existia */ } }
};
const drive = createDrive({ fetch: (...a) => fetch(...a), openExternal: (url) => shell.openExternal(url), tokenStore });
const driveCall = (fn) => async (_event, ...args) => {
  try { return { ok: true, value: await fn(...args) }; }
  catch (err) { return { ok: false, code: err.code || 'error', message: String((err && err.message) || err) }; }
};
ipcMain.handle('drive:configure', driveCall((c) => drive.configure(c)));
ipcMain.handle('drive:set-user', driveCall((uid) => drive.setUser(uid)));
ipcMain.handle('drive:set-auth', driveCall((jwt) => drive.setAuth(jwt)));
ipcMain.handle('drive:status', driveCall(() => drive.status()));
ipcMain.handle('drive:connect', driveCall(() => drive.connect()));
ipcMain.handle('drive:disconnect', driveCall(() => drive.disconnect()));
ipcMain.handle('drive:list', driveCall(() => drive.list()));
ipcMain.handle('drive:stat', driveCall((name) => drive.stat(name)));
ipcMain.handle('drive:read', driveCall((name) => drive.read(name)));
ipcMain.handle('drive:write', driveCall((name, bytes, mime) => drive.write(name, bytes, mime)));
ipcMain.handle('drive:remove', driveCall((name) => drive.remove(name)));
ipcMain.handle('drive:wipe', driveCall(() => drive.wipeAll()));
ipcMain.handle('drive:vault-export', driveCall((password) => drive.exportToken(password)));
ipcMain.handle('drive:vault-import', driveCall((blob, password) => drive.importToken(blob, password)));

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:install-update', () => { if (autoUpdater && app.isPackaged) autoUpdater.quitAndInstall(); });
ipcMain.handle('app:copy', (_event, text) => { try { clipboard.writeText(String(text).slice(0, 1000)); return true; } catch (e) { return false; } });
ipcMain.handle('app:check-updates', async () => {
  if (!autoUpdater || !app.isPackaged) return { status: 'unavailable' };
  try { await autoUpdater.checkForUpdates(); return { status: 'checked' }; }
  catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Só a webcam (fotografar capas e lombadas) e copiar texto são permitidos.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'media' || permission === 'clipboard-sanitized-write'));
  createWindow();
  setupUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
