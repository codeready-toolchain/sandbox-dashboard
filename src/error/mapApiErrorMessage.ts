import type { ApiError } from "./ApiError";

export type ApiErrorRule = {
  /** Substring to match within the ApiError body. */
  match: string;
  /** User-facing message to return when matched. */
  message: string;
};

/**
 * Maps an ApiError's body to a user-facing message using ordered matching
 * rules. Returns the message from the first matching rule, or the fallback if
 * none match.
 * @param err the {@link ApiError} whose body is checked against the rules.
 * @param rules ordered list of substring-to-message mappings; first match wins.
 * @param fallback message returned when no rule matches.
 * @returns the user-facing error message.
 */
export function mapApiErrorMessage(
  err: ApiError,
  rules: readonly ApiErrorRule[],
  fallback: string,
): string {
  for (const rule of rules) {
    if (err.body.includes(rule.match)) {
      return rule.message;
    }
  }
  return fallback;
}
