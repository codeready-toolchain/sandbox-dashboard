/**
 * Defines the Keycloak client configuration returned by the registration
 * service's response.
 */
export type KeycloakClientConfig = {
  "auth-server-url": string;
  clientId: string;
  realm: string;
};

/**
 * Defines the response returned by the registration service which contains
 * the configuration for Keycloak.
 */
export type AuthConfigResponse = {
  "auth-client-library-url": string;
  "auth-client-config": string;
  "signup-url": string;
};

export interface UIConfig {
  workatoWebHookURL?: string;
  disabledIntegrations?: string[];
}
