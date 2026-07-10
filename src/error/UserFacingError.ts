/**
 * Defines the severity of the user facing error.
 */
export enum ErrorSeverity {
  ERROR = "error",
  WARNING = "warning",
}

/**
 * Defines an error type that is used for errors that should be user facing,
 * with user-friendly messages and possibly next logical steps to take if
 * it makes sense for the user.
 */
export class UserFacingError extends Error {
  readonly severity: ErrorSeverity;
  readonly title: string;
  readonly detail: string;

  constructor(
    title: string,
    detail: string,
    cause?: unknown,
    severity?: ErrorSeverity,
  ) {
    super(title, { cause });

    this.name = "UserFacingError";
    this.title = title;
    this.detail = detail;
    this.severity = severity ?? ErrorSeverity.ERROR;
  }
}
