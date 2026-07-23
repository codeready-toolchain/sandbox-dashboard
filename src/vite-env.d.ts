/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface Window {
  /** Global tracker object injected by Adobe Analytics (dpal.js). */
  s?: { abort: boolean };
}

declare const grecaptcha: {
  enterprise: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
  };
};
