import { errorMessage } from "../utils/common";
import { sanitizeErrorBody } from "./sanitize";
import logger from "../utils/logger";

/**
 * Parses the JSON response or falls back to regular text.
 * @param response the response from which the body is going to be parsed.
 * @returns the response's content in JSON, regular text or undefined.
 */
async function safeJsonParse(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}

/**
 * Defines a class to capture the non-successful requests coming from the
 * called APIs.
 */
export class ApiError extends Error {
  readonly body: string;
  readonly statusCode: number;

  constructor(message: string, statusCode: number, sanitizedBody?: unknown) {
    super(message);
    this.body = errorMessage(sanitizedBody);
    this.statusCode = statusCode;
  }

  /**
   * Builds an ApiError from a response, by safely parsing the body to avoid
   * further errors. Attempts a JSON, regular text and defaults to a generic
   * message if everything fails. It also logs the given message.
   * @param message the error message to log.
   * @param response the failed response.
   * @returns a new ApiError instance.
   */
  static async fromResponse(
    message: string,
    response: Response,
  ): Promise<ApiError> {
    const body = await safeJsonParse(response);
    const sanitized = sanitizeErrorBody(body);
    logger.error(message, sanitized);
    return new ApiError(message, response.status, sanitized);
  }
}
