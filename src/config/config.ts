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
 * Defines the expected structure to make the UI connect to a specified
 * Keycloak instance.
 */
export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

/**
 * Defines the parsed and validated application configuration for the UI.
 */
export interface AppConfig {
  auth?: KeycloakConfig;
  registrationServiceURL: string;
  recaptchaSiteKey: string;
  environment: Environment;
}

/**
 * Defines the configuration "raw", without any structure, which is used to
 * represent the raw "config.js" structure that gets fed into the application.
 */
export interface AppConfigRaw {
  auth?: KeycloakConfig;
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

  // Parse the specified environment.
  let environment: Environment;
  switch (config.environment) {
    case "dev":
      environment = Environment.DEVELOPMENT;
      break;
    case "dev-keycloak":
      environment = Environment.DEVELOPMENT_KEYCLOAK;
      break;
    case "dev-stage":
      environment = Environment.DEVELOPMENT_STAGE;
      break;
    case "prod":
      environment = Environment.PRODUCTION;
      break;
    default:
      throw new Error(`Unknown environment specified: "${config.environment}"`);
  }

  // Make sure that in the "development keycloak" environment the whole auth
  // object is populated.
  if (environment === Environment.DEVELOPMENT_KEYCLOAK) {
    if (
      !config.auth ||
      !config.auth.clientId ||
      !String(config.auth.clientId).trim() ||
      !config.auth.realm ||
      !String(config.auth.realm).trim() ||
      !config.auth.url ||
      !String(config.auth.url).trim()
    ) {
      throw new Error(
        `In the "${environment}" environment you need to specify an "auth" object with the "clientId", "realm" and "url" fields.`,
      );
    }
  }

  // Make sure that in the "development stage" environment the required
  // "clientId" parameter has been specified in the configuration.
  if (environment === Environment.DEVELOPMENT_STAGE) {
    if (
      !config.auth ||
      !config.auth.clientId ||
      !String(config.auth.clientId).trim()
    ) {
      throw new Error(
        `In the "dev-stage" environment you need to specify an "auth" object with the "clientId" key.`,
      );
    }
  }

  return {
    ...config,
    environment: environment,
  };
}
