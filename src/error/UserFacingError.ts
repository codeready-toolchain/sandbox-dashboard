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
  /** User facing error title. */
  readonly title: string;
  /** User facing error details. */
  readonly detail: string;
  /** Internal technical details of the error. */
  readonly technicalDetails?: string;

  constructor(
    title: string,
    detail: string,
    cause?: unknown,
    technicalDetails?: string,
    severity?: ErrorSeverity,
  ) {
    super(title, { cause });

    this.name = "UserFacingError";
    this.title = title;
    this.detail = detail;
    this.technicalDetails = technicalDetails;
    this.severity = severity ?? ErrorSeverity.ERROR;
  }
}
