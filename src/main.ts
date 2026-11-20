import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Windows-Installer (Squirrel) legt Verknüpfungen an und beendet die App danach wieder.
if (started) {
  app.quit();
}

// Unter Windows erscheinen Benachrichtigungen nur mit gesetzter App-ID.
app.setAppUserModelId('de.jobpilot.desktop');

let mainWindow: BrowserWindow | null = null;

/** Nur http(s) geht an den Standardbrowser – nie file:, javascript: o. Ä. */
function openExternal(url: string) {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'jobpilot',
    // Hintergrund aus jobpilot.css (--jp-background), damit beim Öffnen nichts aufblitzt
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#151a17' : '#f4f6f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Links in Stellenanzeigen & Co. öffnen im Browser statt in einem neuen App-Fenster.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const ownOrigin = MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
      : 'file://';
    if (!url.startsWith(ownOrigin)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Klick auf eine Benachrichtigung holt das Fenster nach vorn.
ipcMain.on('window:focus', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(() => {
  createWindow();

  // macOS: Klick aufs Dock-Symbol öffnet wieder ein Fenster.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Unter macOS bleibt die App aktiv, bis sie mit Cmd + Q beendet wird.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
