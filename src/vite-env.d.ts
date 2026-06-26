/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare const grecaptcha: {
  enterprise: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
  };
};
