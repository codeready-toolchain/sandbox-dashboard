/**
 * Defines the environments that the user interface supports, namely:
 *
 * - A development environment where every call is mocked.
 * - A development environment which talks to a local Keycloak instance.
 * - A development environment which sends the requests directly to stage.
 * - A production environment.
 */
export enum Environment {
  DEVELOPMENT,
  DEVELOPMENT_KEYCLOAK,
  DEVELOPMENT_STAGE,
  PRODUCTION,
}

/**
 * Defines the expected authentication configuration options when the UI is
 * launched in "dev-keycloak" mode.
 */
export interface KeycloakConfigDevKeycloak {
  clientId: string;
  realm: string;
  url: string;
}

/**
 * Defines the expected authentication configuration options when the UI is
 * launched in "dev-stage" mode.
 */
export interface KeycloakConfigDevStage {
  clientId: string;
}

/**
 * Defines the base configuration options that must always be present.
 */
interface AppConfigBase {
  registrationServiceURL: string;
  recaptchaSiteKey: string;
}

/**
 * Discriminated union representing the parsed application configuration.
 * Narrowing on the environment gives access to the corresponding
 * authentication shape.
 */
export type AppConfig =
  | (AppConfigBase & { environment: Environment.DEVELOPMENT; auth?: undefined })
  | (AppConfigBase & {
      environment: Environment.DEVELOPMENT_KEYCLOAK;
      auth: KeycloakConfigDevKeycloak;
    })
  | (AppConfigBase & {
      environment: Environment.DEVELOPMENT_STAGE;
      auth: KeycloakConfigDevStage;
    })
  | (AppConfigBase & { environment: Environment.PRODUCTION; auth?: undefined });

/**
 * Defines the configuration "raw", without any structure, which is used to
 * represent the raw "config.js" structure that gets fed into the application.
 */
export interface AppConfigRaw {
  auth?: { url?: string; realm?: string; clientId?: string };
  registrationServiceURL: string;
  recaptchaSiteKey: string;
  environment: string;
}

/**
 * Define the structure for the raw configuration of the application.
 */
declare global {
  interface Window {
    __config__?: AppConfigRaw;
  }
}

/**
 * Parse the configuration and returned the structured configuration.
 * @returns the application's configuration in a structured format.
 * @throws Error when either the configuration is not defined or the
 */
export function getConfig(): AppConfig {
  const config = window.__config__;
  if (!config) {
    throw new Error("window.__config__ is not defined. Is config.js loaded?");
  }

  const { registrationServiceURL, recaptchaSiteKey } = config;

  switch (config.environment) {
    case "dev":
      return {
        environment: Environment.DEVELOPMENT,
        registrationServiceURL,
        recaptchaSiteKey,
      };

    case "dev-keycloak": {
      const auth = config.auth;
      if (
        !auth ||
        !auth.clientId ||
        !String(auth.clientId).trim() ||
        !auth.realm ||
        !String(auth.realm).trim() ||
        !auth.url ||
        !String(auth.url).trim()
      ) {
        throw new Error(
          `In the "dev-keycloak" environment you need to specify an "auth" object with the "clientId", "realm" and "url" fields.`,
        );
      }
      return {
        environment: Environment.DEVELOPMENT_KEYCLOAK,
        registrationServiceURL,
        recaptchaSiteKey,
        auth: { clientId: auth.clientId, realm: auth.realm, url: auth.url },
      };
    }

    case "dev-stage": {
      const auth = config.auth;
      if (!auth || !auth.clientId || !String(auth.clientId).trim()) {
        throw new Error(
          `In the "dev-stage" environment you need to specify an "auth" object with the "clientId" key.`,
        );
      }
      return {
        environment: Environment.DEVELOPMENT_STAGE,
        registrationServiceURL,
        recaptchaSiteKey,
        auth: { clientId: auth.clientId },
      };
    }

    case "prod":
      return {
        environment: Environment.PRODUCTION,
        registrationServiceURL,
        recaptchaSiteKey,
      };

    default:
      throw new Error(`Unknown environment specified: "${config.environment}"`);
  }
}
