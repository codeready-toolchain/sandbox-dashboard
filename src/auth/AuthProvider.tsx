import Keycloak from "keycloak-js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { setTokenGetter } from "../api/authFetch";
import { Environment, getConfig, type AppConfig } from "../config/config";
import type { AuthConfigResponse, KeycloakClientConfig } from "../types";
import { AuthContext, type AuthContextValue } from "./AuthContext";

const MIN_TOKEN_VALIDITY_SECONDS = 30;

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const config = getConfig();

  if (config.environment === Environment.DEVELOPMENT) {
    return <DevBypassProvider>{children}</DevBypassProvider>;
  }

  return <KeycloakProvider config={config}>{children}</KeycloakProvider>;
}

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
 * A mock provider for development which creates a fake token as if we had
 * received it from SSO.
 * @param param0 the child components for the provider.
 * @returns the development SSO provider.
 */
function DevBypassProvider({ children }: { children: ReactNode }) {
  const value: AuthContextValue = {
    authenticated: true,
    token: "dev-fake-token",
    givenName: "Developer",
    familyName: "Sandbox",
    email: "dev@example.com",
    username: "dev-user",
    getToken: async () => "dev-fake-token",
    logout: () => {},
  };

  useEffect(() => {
    setTokenGetter(async () => "dev-fake-token");
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Creates a Keycloak provider which configures the SSO details and obtains
 * a token.
 *
 * - In the development stage environment, the configuration details are
 *   fetched from the registration service, but the client ID is set up from
 *   the configuration to be able to log in locally with the stage's SSO.
 * - In the production environment all the SSO details are grabbed from the
 *   registration service.
 * @param param0 which includes the app's configuration and any children that
 *               want to use this Keycloak provider.
 * @returns the created Keycloak provider.
 */
function KeycloakProvider({
  config,
  children,
}: {
  config: AppConfig;
  children: ReactNode;
}) {
  const keycloakRef = useRef<Keycloak | null>(null);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; value: AuthContextValue }
  >({ phase: "loading" });
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    initKeycloak().catch((err) => {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    });

    async function initKeycloak() {
      let keycloak: Keycloak;
      switch (config.environment) {
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
              await fetchKeycloakClientConfiguration(
                config.registrationServiceURL,
              );
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
            await fetchKeycloakClientConfiguration(
              config.registrationServiceURL,
            );

          keycloak = new Keycloak({
            url: clientConfig["auth-server-url"],
            realm: clientConfig.realm,
            clientId: clientConfig.clientId || clientConfig.resource,
          });
        }
      }

      keycloakRef.current = keycloak;

      const authenticated = await keycloak.init({
        onLoad: "login-required",
        checkLoginIframe: false,
      });

      if (!authenticated) {
        throw new Error("Authentication failed");
      }

      const getToken = async (): Promise<string> => {
        await keycloak.updateToken(MIN_TOKEN_VALIDITY_SECONDS);
        return keycloak.token!;
      };

      setTokenGetter(getToken);

      const parsed = keycloak.tokenParsed ?? {};
      setState({
        phase: "ready",
        value: {
          authenticated: true,
          token: keycloak.token,
          givenName: (parsed.given_name as string) ?? "",
          familyName: (parsed.family_name as string) ?? "",
          email: (parsed.email as string) ?? "",
          username: (parsed.preferred_username as string) ?? "",
          getToken,
          logout: () => keycloak.logout(),
        },
      });
    }
  }, [config]);

  if (state.phase === "loading") {
    return <div data-testid="auth-loading">Loading...</div>;
  }

  if (state.phase === "error") {
    return (
      <div data-testid="auth-error">Authentication error: {state.message}</div>
    );
  }

  return (
    <AuthContext.Provider value={state.value}>{children}</AuthContext.Provider>
  );
}
