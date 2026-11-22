import { contextBridge, ipcRenderer } from 'electron';

// Die einzige Brücke zum Main-Prozess. Der Renderer bekommt keinen Node-Zugriff,
// nur diese Funktionen (siehe `src/renderer/desktop.ts`).
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  focusWindow: () => ipcRenderer.send('window:focus'),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme: string) => ipcRenderer.invoke('theme:set', theme),
});
