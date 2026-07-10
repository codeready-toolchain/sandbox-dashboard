const MAX_BODY_LENGTH = 2048;

const SENSITIVE_KEY_NAMES =
  "token|password|secret|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret";

const SENSITIVE_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: new RegExp(
      `("?(?:${SENSITIVE_KEY_NAMES})"?\\s*[:=]\\s*)(?:"[^"]+"|'[^']+')`,
      "gi",
    ),
    replacement: '$1"[REDACTED]"',
  },
  { pattern: /(Bearer\s+)\S+/gi, replacement: "$1[REDACTED]" },
  {
    pattern: new RegExp(
      `((?:${SENSITIVE_KEY_NAMES})\\s*[:=]\\s*)([^&\\s"'\\}\\],]+)`,
      "gi",
    ),
    replacement: "$1[REDACTED]",
  },
];

/**
 * Redacts sensitive values and truncates an error body so that secrets, tokens,
 * and backend payloads cannot appear in logs or user-facing text.
 * @param body the raw parsed response body (string, object, or primitive).
 * @returns the sanitized body with sensitive values replaced by `[REDACTED]`
 *   and length capped at {@link MAX_BODY_LENGTH} characters.
 */
export function sanitizeErrorBody(body: unknown): unknown {
  if (body === undefined || body === null) return body;

  if (typeof body === "string") {
    return redactAndTruncate(body);
  }

  if (typeof body === "object") {
    const sanitized = sanitizeObjectValues(body as Record<string, unknown>);
    return redactAndTruncate(JSON.stringify(sanitized));
  }

  return String(body);
}

function sanitizeObjectValues(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return redact(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObjectValues);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = sanitizeObjectValues(v);
    }
    return out;
  }
  return obj;
}

function redact(text: string): string {
  let result = text;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function redactAndTruncate(text: string): string {
  const result = redact(text);

  if (result.length > MAX_BODY_LENGTH) {
    return result.slice(0, MAX_BODY_LENGTH) + "... [truncated]";
  }

  return result;
}
