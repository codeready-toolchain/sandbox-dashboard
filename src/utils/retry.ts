import { ApiError } from "../error/ApiError";

/**
 * Default predicate: retries server errors (5xx) and retriable client errors
 * (408 Request Timeout, 429 Too Many Requests). Other 4xx errors are treated
 * as terminal. Non-ApiError values are always retried.
 */
export function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      return true;
    }
    if (err.statusCode === 408 || err.statusCode === 429) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Returns whether the given value is an abort error from {@link AbortSignal}
 * or {@link fetch}.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function toAbortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) {
    return signal.reason;
  }
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw toAbortError(signal);
  }
}

function delay(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(toAbortError(signal));
      return;
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    function onAbort() {
      clearTimeout(timeoutId);
      reject(toAbortError(signal));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
 * @param signal optional abort signal that stops further attempts, including
 *   an in-progress delay, without treating abort as a retryable failure.
 * @returns the result of the successful function call.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
  shouldRetry: (err: unknown) => boolean = isTransient,
  signal?: AbortSignal,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    throwIfAborted(signal);
    try {
      return await fn();
    } catch (err) {
      throwIfAborted(signal);
      if (i === attempts - 1 || !shouldRetry(err)) {
        throw err;
      }
      await delay(delayMs, signal);
    }
  }

  throw new Error("unreachable");
}
