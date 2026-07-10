/**
 * Defines an error that is critical and prevents the application from working
 * at all.
 */
export class CriticalError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage, { cause });
    this.name = "CriticalError";
    this.userMessage = userMessage;
  }
}
