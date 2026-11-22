// Was `src/preload.ts` dem Renderer bereitstellt. Ohne Electron (z. B. in Tests) fehlt es.
type DesktopBridge = {
  platform: string;
  focusWindow: () => void;
  /** Hell/Dunkel für diesen Rechner: 'system' | 'light' | 'dark' */
  getTheme: () => Promise<string>;
  setTheme: (theme: string) => Promise<void>;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

const THEME_KEY = 'jobpilot.theme';

export const desktop: DesktopBridge = window.desktop ?? {
  platform: 'web',
  focusWindow: () => window.focus(),
  // Ohne Electron (Tests, Browser): im Speicher des Browsers
  getTheme: async () => localStorage.getItem(THEME_KEY) ?? 'system',
  setTheme: async (theme) => localStorage.setItem(THEME_KEY, theme),
};
