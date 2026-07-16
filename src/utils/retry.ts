import { ApiError } from "../error/ApiError";

/**
 * Default predicate: retries server errors (5xx) and retriable client errors
 * (408 Request Timeout, 429 Too Many Requests). Other 4xx errors are treated
 * as terminal. Non-ApiError values are always retried.
 */
export function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) return true;
    if (err.statusCode === 408 || err.statusCode === 429) return true;
    return false;
  }
  return true;
}

/**
 * Retries an async operation a specified number of times with a delay between
 * attempts. Permanent errors (determined by `shouldRetry`) are rethrown
 * immediately. Throws the last error if all attempts are exhausted.
 * @param fn the async function to retry.
 * @param attempts the maximum number of attempts.
 * @param delayMs the delay in milliseconds between attempts.
 * @param shouldRetry optional predicate evaluated in the catch block before
 *   sleeping; defaults to {@link isTransient} which rethrows 4xx ApiErrors.
 * @returns the result of the successful function call.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
  shouldRetry: (err: unknown) => boolean = isTransient,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1 || !shouldRetry(err)) throw err;
      await new Promise((retry) => setTimeout(retry, delayMs));
    }
  }

  throw new Error("unreachable");
}
