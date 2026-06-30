import Keycloak from "keycloak-js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { setTokenGetter } from "../api/authFetch";
import { Environment, getConfig, type AppConfig } from "../config/config";
import type { AuthConfigResponse } from "../types";
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
      const authConfigResponse = await fetch(
        `${config.registrationServiceURL}/api/v1/authconfig`,
      );
      if (!authConfigResponse.ok) {
        throw new Error(
          `Failed to fetch auth config: ${authConfigResponse.status}`,
        );
      }
      const authConfig: AuthConfigResponse = await authConfigResponse.json();
      const clientConfig = JSON.parse(authConfig["auth-client-config"]);

      let keycloak: Keycloak;
      if (config.environment === Environment.DEVELOPMENT_STAGE) {
        // For the "development stage" environment, we need to override the
        // endpoint for obtaining the token and send it through the Vite
        // proxy, to avoid CORS issues.
        //
        // We use the "/vite-sso-token-proxy" prefix so that the Vite proxy
        // can easily identify the request and send it on the browser's
        // behalf. It basically strips that part and sends it to the original
        // SSO token URL.
        if (config.auth) {
          keycloak = new Keycloak({
            url: clientConfig["auth-server-url"],
            realm: clientConfig.realm,
            clientId: config.auth.clientId,
          });
        } else {
          throw new Error(
            'The "dev-stage" environment is configured, but no client ID was provided in the configuration',
          );
        }
      } else {
        keycloak = new Keycloak({
          url: clientConfig["auth-server-url"],
          realm: clientConfig.realm,
          clientId: clientConfig.clientId || clientConfig.resource,
        });
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
