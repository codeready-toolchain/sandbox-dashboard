export interface AppConfig {
  registrationServiceURL: string;
  recaptchaSiteKey: string;
  environment: "dev" | "dev-keycloak" | "prod";
}

declare global {
  interface Window {
    __config__?: AppConfig;
  }
}

export function getConfig(): AppConfig {
  const config = window.__config__;
  if (!config) {
    throw new Error("window.__config__ is not defined. Is config.js loaded?");
  }
  return config;
}
