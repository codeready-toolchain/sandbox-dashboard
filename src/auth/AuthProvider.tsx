import { useEffect, useRef, useState, type ReactNode } from "react";
import Keycloak from "keycloak-js";
import { getConfig } from "../config/config";
import { setTokenGetter } from "../api/authFetch";
import type { AuthConfigResponse } from "../types";
import { AuthContext, type AuthContextValue } from "./AuthContext";

const MIN_TOKEN_VALIDITY_SECONDS = 30;

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const config = getConfig();
  const isDev = config.environment === "dev";

  if (isDev) {
    return <DevBypassProvider>{children}</DevBypassProvider>;
  }

  return <KeycloakProvider>{children}</KeycloakProvider>;
}

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

function KeycloakProvider({ children }: { children: ReactNode }) {
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
      const config = getConfig();
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

      const keycloak = new Keycloak({
        url: clientConfig["auth-server-url"],
        realm: clientConfig.realm,
        clientId: clientConfig.clientId || clientConfig.resource,
      });

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
  }, []);

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
