import { Environment, getConfig } from "../config/config";

/**
 * Checks if we're running in production.
 * @returns `true` if we are.
 */
function isProduction(): boolean {
  try {
    return getConfig().environment === Environment.PRODUCTION;
  } catch {
    return false;
  }
}

/**
 * Checks whether we are running the tests to avoid printing logs.
 * @returns `true` if we are.
 */
function isRunningTests(): boolean {
  return typeof process !== "undefined" && process.env.VITEST === "true";
}

/**
 * Defines a simple logger for the application. No libraries are used because
 * for now we do not require any more complexity than this.
 */
const logger = {
  /**
   * Logs a "debug" level message if the environment is not production.
   * @param msg the message to log.
   * @param args the arguments to interpolate in the message.
   */
  debug(msg: string, ...args: unknown[]) {
    if (!isProduction() && !isRunningTests()) {
      console.debug(`[rh-ds] [${new Date().toISOString()}] ${msg}`, ...args);
    }
  },

  /**
   * Logs an "error" level message.
   * @param msg the message to log.
   * @param args the arguments to interpolate in the message.
   */
  error(msg: string, ...args: unknown[]) {
    if (!isRunningTests()) {
      console.error(`[rh-ds] [${new Date().toISOString()}] ${msg}`, ...args);
    }
  },

  /**
   * Logs an "info" level message.
   * @param msg the message to log.
   * @param args the arguments to interpolate in the message.
   */
  info(msg: string, ...args: unknown[]) {
    if (!isRunningTests()) {
      console.info(`[rh-ds] [${new Date().toISOString()}] ${msg}`, ...args);
    }
  },

  /**
   * Logs an "warning" level message.
   * @param msg the message to log.
   * @param args the arguments to interpolate in the message.
   */
  warn(msg: string, ...args: unknown[]) {
    if (!isRunningTests()) {
      console.warn(`[rh-ds] [${new Date().toISOString()}] ${msg}`, ...args);
    }
  },
};

export default logger;
