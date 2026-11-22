import { desktop } from './desktop';

// Hell/Dunkel: „System“ folgt dem Betriebssystem (Standard), „Hell“/„Dunkel“ legen es für diesen
// Rechner fest. In Electron schaltet `nativeTheme` (main.ts) Fenster und `prefers-color-scheme`
// um; zusätzlich setzt `data-theme` am Wurzelelement `color-scheme`, damit die `light-dark()`-Farben
// aus jobpilot.css auch ohne Electron folgen (styles.css).

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
};

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === 'string' && (THEMES as readonly string[]).includes(value)
  );
}

function applyToDocument(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export async function loadTheme(): Promise<Theme> {
  const stored = await desktop.getTheme();
  const theme = isTheme(stored) ? stored : 'system';
  applyToDocument(theme);
  return theme;
}

export async function setTheme(theme: Theme) {
  applyToDocument(theme);
  await desktop.setTheme(theme);
}
