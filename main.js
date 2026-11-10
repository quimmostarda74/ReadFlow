const { app, BrowserWindow, Menu, session, shell, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');

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

function sendStatus(status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:status', { status, ...(extra || {}) });
}

function setupUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendStatus('checking'));
  autoUpdater.on('update-available', (info) => sendStatus('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => sendStatus('none'));
  autoUpdater.on('download-progress', (p) => sendStatus('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('error', (err) => sendStatus('error', { message: String((err && err.message) || err) }));
  autoUpdater.on('update-downloaded', (info) => {
    sendStatus('downloaded', { version: info.version });
    dialog.showMessageBox(mainWindow, {
      type: 'info', buttons: ['Reiniciar agora', 'Mais tarde'], defaultId: 0, cancelId: 1,
      message: 'Há uma nova versão do ReadFlow', detail: `A versão ${info.version} está pronta. Reinicia a app para atualizar. Os teus dados ficam guardados.`
    }).then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 5000);                       // ao abrir
  setInterval(check, 6 * 60 * 60 * 1000);        // e de 6 em 6 horas
}

ipcMain.handle('app:version', () => app.getVersion());
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
