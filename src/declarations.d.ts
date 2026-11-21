/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';

/** Version aus package.json, von Vite beim Bauen eingesetzt (vite.renderer.config.mts) */
declare const __APP_VERSION__: string;
