export type AuthConfigResponse = {
  "auth-client-library-url": string;
  "auth-client-config": string;
  "signup-url": string;
};

export interface UIConfig {
  workatoWebHookURL?: string;
  disabledIntegrations?: string[];
}
