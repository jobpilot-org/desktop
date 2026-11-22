import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Windows-Installer (Squirrel) legt Verknüpfungen an und beendet die App danach wieder.
if (started) {
  app.quit();
}

// Unter Windows erscheinen Benachrichtigungen nur mit gesetzter App-ID.
app.setAppUserModelId('de.jobpilot.desktop');

let mainWindow: BrowserWindow | null = null;

// Hell/Dunkel: „system“ folgt dem Betriebssystem. Die Wahl gilt für diesen Rechner und liegt im
// Benutzerordner der App, damit sie schon vor dem ersten Fenster greift (kein Aufblitzen).
const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];
const isTheme = (value: unknown): value is Theme =>
  typeof value === 'string' && (THEMES as readonly string[]).includes(value);
const themeFile = () => path.join(app.getPath('userData'), 'theme.json');

function readTheme(): Theme {
  try {
    const { theme } = JSON.parse(fs.readFileSync(themeFile(), 'utf8')) as {
      theme?: unknown;
    };
    return isTheme(theme) ? theme : 'system';
  } catch {
    return 'system';
  }
}

/** Hintergrund aus jobpilot.css (--jp-background), damit beim Öffnen nichts aufblitzt */
const windowBackground = () =>
  nativeTheme.shouldUseDarkColors ? '#151a17' : '#f4f6f2';

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
    backgroundColor: windowBackground(),
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

ipcMain.handle('theme:get', () => nativeTheme.themeSource);
ipcMain.handle('theme:set', (_event, theme: unknown) => {
  if (!isTheme(theme)) return;
  nativeTheme.themeSource = theme;
  fs.writeFileSync(themeFile(), JSON.stringify({ theme }));
  mainWindow?.setBackgroundColor(windowBackground());
});

// Klick auf eine Benachrichtigung holt das Fenster nach vorn.
ipcMain.on('window:focus', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(() => {
  nativeTheme.themeSource = readTheme();
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
