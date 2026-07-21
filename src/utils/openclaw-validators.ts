import type { JsonCredentialSchema } from "../types";

// RFC 5322-based email regex. It's the same pattern previously used by
// ajv-formats.
const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

// Required fields per credential type, mirroring the GCP credential JSON
// structure. "type" is always required but validated separately as the
// discriminator.
const AUTHORIZED_USER_REQUIRED = [
  "client_id",
  "client_secret",
  "refresh_token",
] as const;

const SERVICE_ACCOUNT_REQUIRED = [
  "project_id",
  "private_key_id",
  "private_key",
  "client_email",
  "client_id",
  "auth_uri",
  "token_uri",
] as const;

/**
 * Checks if the given value is a string.
 * @param v the value to check.
 * @returns `true` if the given value is a string.
 */
const isString = (v: unknown): v is string => typeof v === "string";

// Uses the URL constructor as a spec-compliant URI validator,
// replacing the ajv-formats "uri" format check.
const isValidUri = (v: string): boolean => {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates a raw JSON string as a GCP Vertex AI credential
 * (authorized_user or service_account).
 *
 * This replaces the previous AJV-based validator to avoid runtime
 * `new Function()` calls that are blocked by Content-Security-Policy.
 *
 * @returns An array of human-readable error messages, or an empty array if
 * valid.
 */
export const openclawVertexJsonValidator = (rawJson: string): string[] => {
  // Allow empty input without errors (field hasn't been filled yet)
  if (rawJson === "") {
    return [];
  }

  let data: JsonCredentialSchema;
  try {
    data = JSON.parse(rawJson);
  } catch {
    return ["Please input valid JSON."];
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return ["Please input a valid JSON object."];
  }

  const obj = data as unknown as Record<string, unknown>;

  // Validate the discriminator field first because all other checks depend on
  // it.
  if (obj.type === undefined) {
    return ['The "type" property is required'];
  }
  if (obj.type !== "authorized_user" && obj.type !== "service_account") {
    return [
      'The "type" property must be "authorized_user" or "service_account"',
    ];
  }

  // Errors are grouped by category so they appear in a consistent order:
  // missing required fields first, then type mismatches, then format issues.
  const errMsgs: string[] = [];
  const invalidTypeErrMsgs: string[] = [];
  const invalidFormatErrMsgs: string[] = [];

  const requiredFields =
    obj.type === "authorized_user"
      ? AUTHORIZED_USER_REQUIRED
      : SERVICE_ACCOUNT_REQUIRED;

  // Check for missing required properties.
  const missing = requiredFields.filter((f) => !(f in obj));
  if (missing.length === 1) {
    errMsgs.push(`The "${missing[0]}" property is required.`);
  } else if (missing.length > 1) {
    const formatter = new Intl.ListFormat("en", {
      style: "long",
      type: "conjunction",
    });
    errMsgs.push(
      `The ${formatter.format(missing.map((property: string) => `"${property}"`))} properties are required.`,
    );
  }

  // All credential fields must be strings.
  for (const field of requiredFields) {
    if (field in obj && !isString(obj[field])) {
      invalidTypeErrMsgs.push(
        `The "${field}" field must be of the "string" type.`,
      );
    }
  }

  // Service account credentials have additional format constraints. Check
  // that both the emails and the provided URIs are valid.
  if (obj.type === "service_account") {
    if (isString(obj.client_email) && !EMAIL_RE.test(obj.client_email)) {
      invalidFormatErrMsgs.push("Invalid email format specified.");
    }
    for (const uriField of ["auth_uri", "token_uri"] as const) {
      if (isString(obj[uriField]) && !isValidUri(obj[uriField])) {
        invalidFormatErrMsgs.push(`Invalid URI specified in "${uriField}".`);
      }
    }
  }

  if (invalidTypeErrMsgs.length > 0) {
    errMsgs.push(invalidTypeErrMsgs.join(" "));
  }

  if (invalidFormatErrMsgs.length > 0) {
    errMsgs.push(invalidFormatErrMsgs.join(" "));
  }

  return errMsgs;
};
