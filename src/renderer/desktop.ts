// Was `src/preload.ts` dem Renderer bereitstellt. Ohne Electron (z. B. in Tests) fehlt es.
type DesktopBridge = {
  platform: string;
  focusWindow: () => void;
};

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge = window.desktop ?? {
  platform: 'web',
  focusWindow: () => window.focus(),
};
