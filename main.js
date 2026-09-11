const { app, BrowserWindow, shell, ipcMain, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const DATA_FILE_NAME = 'dati.enc';
function getDataFilePath() {
  return path.join(app.getPath('userData'), DATA_FILE_NAME);
}

// Dati dello studio: cifrati a riposo con safeStorage (Keychain su Mac, DPAPI su Windows).
// Se la cifratura non è disponibile sul sistema, si salva comunque in chiaro come ultima
// risorsa, così l'app non perde mai dati, ma il renderer viene avvisato del rischio.
ipcMain.handle('data:load', async () => {
  try {
    const filePath = getDataFilePath();
    if (!fsSync.existsSync(filePath)) return null;
    const buffer = await fs.readFile(filePath);
    if (!buffer.length) return null;
    if (safeStorage.isEncryptionAvailable()) {
      try { return safeStorage.decryptString(buffer); }
      catch (error) { return buffer.toString('utf8'); } // file più vecchio, mai cifrato
    }
    return buffer.toString('utf8');
  } catch (error) { return null; }
});

ipcMain.handle('data:save', async (event, json) => {
  try {
    const filePath = getDataFilePath();
    const encryptionAvailable = safeStorage.isEncryptionAvailable();
    const payload = encryptionAvailable ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8');
    await fs.writeFile(filePath, payload);
    return { ok: true, encrypted: encryptionAvailable };
  } catch (error) { return { ok: false, error: error.message }; }
});

// Backup automatico su cartella scelta dall'utente: copia periodica (ogni 2 ore) del file
// dati.enc già cifrato, via dialogo nativo e fs del processo main - non l'API del browser.
const BACKUP_CONFIG_FILE = 'backup-config.json';
const BACKUP_INTERVAL_MS = 2 * 60 * 60 * 1000;
let backupIntervalHandle = null;
function getBackupConfigPath() { return path.join(app.getPath('userData'), BACKUP_CONFIG_FILE); }
async function readBackupConfig() {
  try { return JSON.parse(await fs.readFile(getBackupConfigPath(), 'utf8')); }
  catch (error) { return null; }
}
async function writeBackupConfig(config) { await fs.writeFile(getBackupConfigPath(), JSON.stringify(config, null, 2), 'utf8'); }
async function performBackup() {
  const config = await readBackupConfig();
  if (!config?.folderPath) return;
  try {
    const dataFile = getDataFilePath();
    if (!fsSync.existsSync(dataFile) || !fsSync.existsSync(config.folderPath)) return;
    const stamp = new Date();
    const name = `backup-denti-cura-${stamp.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.enc`;
    await fs.copyFile(dataFile, path.join(config.folderPath, name));
    config.lastBackupAt = stamp.toLocaleString('it-IT');
    await writeBackupConfig(config);
  } catch (error) { /* si ritenta al prossimo giro, non deve bloccare l'app */ }
}
function startBackupInterval() { if (backupIntervalHandle) clearInterval(backupIntervalHandle); backupIntervalHandle = setInterval(performBackup, BACKUP_INTERVAL_MS); }

ipcMain.handle('backup:choose-folder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Scegli la cartella per il backup automatico' });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  const folderPath = result.filePaths[0];
  await writeBackupConfig({ folderPath, lastBackupAt: null });
  startBackupInterval();
  await performBackup();
  const updated = await readBackupConfig();
  return { ok: true, canceled: false, folderPath, folderName: path.basename(folderPath), lastBackupAt: updated?.lastBackupAt || null };
});

ipcMain.handle('backup:get-status', async () => {
  const config = await readBackupConfig();
  if (!config?.folderPath) return null;
  return { folderPath: config.folderPath, folderName: path.basename(config.folderPath), lastBackupAt: config.lastBackupAt || null };
});

ipcMain.handle('backup:clear-folder', async () => {
  if (backupIntervalHandle) { clearInterval(backupIntervalHandle); backupIntervalHandle = null; }
  try { await fs.unlink(getBackupConfigPath()); } catch (error) { /* già assente */ }
  return { ok: true };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 1120,
    minWidth: 980,
    minHeight: 640,
    title: 'Denti & Cura',
    backgroundColor: '#fbf4e8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, 'Studio_Dentistico.html'));

  // Le finestre di stampa dei preventivi/fatture si aprono con window.open('', ...):
  // vanno consentite. Eventuali link a URL esterni si aprono nel browser di sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(async () => {
  createWindow();
  const config = await readBackupConfig();
  if (config?.folderPath) startBackupInterval();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
