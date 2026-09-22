import { UserSignupPhase } from "../userSignupPhase";

/** Polling interval used to watch user activation during signup. */
export const SIGNUP_WATCHER_INTERVAL_MS = 50;

/**
 * Returns whether the current browsing context still has a transient user
 * activation. A missing User Activation API is treated as inactive so the
 * slow path (continuation modal) is used instead of `window.open`.
 */
export function isUserActivationActive(): boolean {
  return navigator.userActivation?.isActive ?? false;
}

/**
 * Signup phases that abort a pending signup action. The progress modal
 * closes and the existing toast / later-click flows take over.
 *
 * `NOT_STARTED` is only an interrupt after signup has already progressed
 * past that phase (for example when `signupUser` fails and the phase is
 * reset). Opening the continuation from `NOT_STARTED` must not close the
 * modal immediately.
 */
export function isSignupActionInterrupt(
  phase: UserSignupPhase,
  hasProgressedPastNotStarted: boolean,
): boolean {
  switch (phase) {
    case UserSignupPhase.PENDING_PHONE_VERIFICATION:
    case UserSignupPhase.PENDING_MANUAL_APPROVAL:
    case UserSignupPhase.BLOCKED:
    case UserSignupPhase.PROVISIONING_TIMED_OUT:
      return true;
    case UserSignupPhase.NOT_STARTED:
      return hasProgressedPastNotStarted;
    default:
      return false;
  }
}
