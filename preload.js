const { contextBridge, ipcRenderer } = require('electron');

// Bridge minimo e sicuro (contextIsolation attivo, nessuna nodeIntegration nel renderer).
// L'app pagina non ha mai accesso diretto a Node/fs: passa sempre da qui, che inoltra al
// processo main via IPC.
contextBridge.exposeInMainWorld('desktopApp', {
  isElectron: true,
  platform: process.platform,
  versions: { chrome: process.versions.chrome, electron: process.versions.electron },
  storage: {
    // Carica/salva i dati dello studio su file cifrato (safeStorage), non più in localStorage.
    load: () => ipcRenderer.invoke('data:load'),
    save: (json) => ipcRenderer.invoke('data:save', json)
  },
  backup: {
    // Backup automatico su cartella: dialogo nativo + fs nel processo main, non l'API browser.
    chooseFolder: () => ipcRenderer.invoke('backup:choose-folder'),
    getStatus: () => ipcRenderer.invoke('backup:get-status'),
    clearFolder: () => ipcRenderer.invoke('backup:clear-folder')
  }
});
