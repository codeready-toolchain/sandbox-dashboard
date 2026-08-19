/**
 * Defines the phases in which the "user signup" currently is.
 *
 * Kept in a React-free module so Playwright tests can import the members
 * without loading the UI graph.
 */
export enum UserSignupPhase {
  INITIAL_FETCH,
  NOT_STARTED,
  BLOCKED,
  SIGNING_UP,
  PENDING_PHONE_VERIFICATION,
  PENDING_MANUAL_APPROVAL,
  PROVISIONING,
  PROVISIONING_TIMED_OUT,
  READY,
}
