import Keycloak from "keycloak-js";
import { setTokenGetter } from "../api/authFetch";
import { Environment, type AppConfig } from "../config/config";
import type { AuthConfigResponse, KeycloakClientConfig } from "../types";
import type { AuthenticatedContextValue } from "./AuthenticatedContext";

/**
 * Fetches the Keycloak client's configuration from the registration service.
 * @param registrationServiceURL the URL of the registration service.
 * @returns the parsed configuration.
 */
async function fetchKeycloakClientConfiguration(
  registrationServiceURL: string,
): Promise<KeycloakClientConfig> {
  const response = await fetch(`${registrationServiceURL}/api/v1/authconfig`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch the configuration for the authentication client: ${response.status}`,
    );
  }

  const authConfig: AuthConfigResponse = await response.json();
  return JSON.parse(authConfig["auth-client-config"]);
}

/**
 * Initializes the Keycloak instance and builds an authenticated context
 * value.
 *
 * @param config the app's configuration.
 * @returns an {@link AuthenticatedContextValue}. When in a "backend is
 * mocked" development environment, a fake value is returned. In every other
 * case the value is built after the authentication with the Keycloak
 * instance.
 */
async function initializeKeycloak(
  config: AppConfig,
): Promise<AuthenticatedContextValue> {
  let keycloak: Keycloak;
  switch (config.environment) {
    case Environment.DEVELOPMENT:
      // For the development environment simply return a fake authentication
      // context value and assign the fake token getters and setters.
      setTokenGetter(async () => "dev-fake-token");

      return {
        token: "dev-fake-token",
        givenName: "Developer",
        familyName: "Sandbox",
        email: "dev@example.com",
        username: "dev-user",
        logout: () => {},
      };
    case Environment.DEVELOPMENT_KEYCLOAK:
      // For the "development keycloak" environment we simply use the
      // configuration settings provided by the developer.
      if (config.auth) {
        keycloak = new Keycloak({
          clientId: config.auth.clientId,
          realm: config.auth.realm,
          url: config.auth.url,
        });
      } else {
        throw new Error(
          'The "dev-keycloak" environment is configured, but no "auth" object was provided in the configuration',
        );
      }
      break;

    case Environment.DEVELOPMENT_STAGE: {
      // For the "development stage" environment, we need to override the
      // endpoint for obtaining the token and send it through the Vite
      // proxy, to avoid CORS issues.
      //
      // We use the "/vite-sso-token-proxy" prefix so that the Vite proxy
      // can easily identify the request and send it on the browser's
      // behalf. It basically strips that part and sends it to the original
      // SSO token URL.
      if (config.auth) {
        const clientConfig: KeycloakClientConfig =
          await fetchKeycloakClientConfiguration(config.registrationServiceURL);
        const realmUrl = `${clientConfig["auth-server-url"]}/realms/${clientConfig.realm}/protocol/openid-connect`;
        keycloak = new Keycloak({
          clientId: config.auth.clientId,
          oidcProvider: {
            authorization_endpoint: `${realmUrl}/auth`,
            token_endpoint: `/vite-sso-token-proxy${realmUrl}/token`,
            end_session_endpoint: `${realmUrl}/logout`,
            userinfo_endpoint: `${realmUrl}/userinfo`,
          },
        });
      } else {
        throw new Error(
          'The "dev-stage" environment is configured, but no client ID was provided in the configuration',
        );
      }
      break;
    }

    default: {
      const clientConfig: KeycloakClientConfig =
        await fetchKeycloakClientConfiguration(config.registrationServiceURL);

      keycloak = new Keycloak({
        url: clientConfig["auth-server-url"],
        realm: clientConfig.realm,
        clientId: clientConfig.clientId || clientConfig.resource,
      });
    }
  }

  // Authenticate the user.
  const authenticated = await keycloak.init({
    onLoad: "login-required",
    checkLoginIframe: false,
  });

  if (!authenticated) {
    throw new Error("Authentication failed");
  }

  // Use Keycloak's token utilities as the "token getter" for the
  // authenticated fetch calls.
  setTokenGetter(async (): Promise<string> => {
    await keycloak.updateToken(30);
    return keycloak.token!;
  });

  // Obtain the claims that we use on our application.
  const parsed = keycloak.tokenParsed ?? {};
  return {
    token: keycloak.token,
    givenName: (parsed.given_name as string) ?? "",
    familyName: (parsed.family_name as string) ?? "",
    email: (parsed.email as string) ?? "",
    username: (parsed.preferred_username as string) ?? "",
    logout: () => keycloak.logout(),
  };
}

export default initializeKeycloak;
