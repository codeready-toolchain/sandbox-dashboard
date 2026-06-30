/**
 * Defines the environments that the user interface supports.
 */
export enum Environment {
  DEVELOPMENT,
  DEVELOPMENT_KEYCLOAK,
  PRODUCTION,
}

/**
 * Defines the parsed and validated application configuration for the UI.
 */
export interface AppConfig {
  registrationServiceURL: string;
  recaptchaSiteKey: string;
  environment: Environment;
}

/**
 * Defines the configuration "raw", without any structure, which is used to
 * represent the raw "config.js" structure that gets fed into the application.
 */
export interface AppConfigRaw {
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

  let sanitizedEnv: Environment;
  const env: string = config.environment;
  switch (config.environment) {
    case "dev":
      sanitizedEnv = Environment.DEVELOPMENT;
      break;
    case "prod":
      sanitizedEnv = Environment.PRODUCTION;
      break;
    default:
      throw new Error(`Unknown environment specified: "${env}"`);
  }

  return {
    ...config,
    environment: sanitizedEnv,
  };
}
