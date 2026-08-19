import { http, HttpResponse, type RequestHandler } from "msw";

import { UserSignupPhase } from "../../hooks/userSignupPhase";
import {
  authConfigFixture,
  localKeycloakAuthConfigFixture,
  pendingManualApprovalFixture,
  pendingPhoneVerificationFixture,
  provisioningUserFixture,
  readyUserFixture,
  segmentWriteKeyFixture,
  uiConfigFixture,
} from "../fixtures/registration-fixtures";
import { StateMachine } from "./state-machine";

/**
 * Define an initial state of the state machine taking into account the
 * Playwright overrides, if any.
 */
const initialState: UserSignupPhase =
  (typeof window !== "undefined"
    ? window.__playwrightOverrides__?.__signup__?.__initialState__
    : undefined) ?? UserSignupPhase.READY;

/**
 * Create the state machine for our requests.
 */
const userSignupState = new StateMachine<UserSignupPhase>(initialState);

/**
 * Expose the state machine so that the Playwright tests can override it at
 * will to test the different scenarios.
 */
if (typeof window !== "undefined") {
  window.__playwrightOverrides__ ??= {};
  window.__playwrightOverrides__.__signup__ ??= {};
  window.__playwrightOverrides__.__signup__.__stateMachine__ = userSignupState;
}

function getPlaywrightOverrides() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.__playwrightOverrides__;
}

function getAppConfig() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.__config__;
}

export const registrationMockHandlers: RequestHandler[] = [
  http.get("*/api/v1/authconfig", () => {
    const fixture =
      getAppConfig()?.environment === "dev-keycloak"
        ? localKeycloakAuthConfigFixture
        : authConfigFixture;
    return HttpResponse.json(fixture);
  }),

  http.get("*/api/v1/signup", () => {
    const phase = userSignupState.getPhase();
    switch (phase) {
      case UserSignupPhase.INITIAL_FETCH:
      case UserSignupPhase.NOT_STARTED:
      case UserSignupPhase.SIGNING_UP:
        return new HttpResponse(null, { status: 404 });
      case UserSignupPhase.READY:
        return HttpResponse.json(readyUserFixture);
      case UserSignupPhase.PROVISIONING:
      case UserSignupPhase.PROVISIONING_TIMED_OUT:
        return HttpResponse.json(provisioningUserFixture);
      case UserSignupPhase.BLOCKED:
        return new HttpResponse(
          JSON.stringify({ message: "has been suspended" }),
          { status: 403 },
        );
      case UserSignupPhase.PENDING_MANUAL_APPROVAL:
        return HttpResponse.json(pendingManualApprovalFixture);
      case UserSignupPhase.PENDING_PHONE_VERIFICATION:
        return HttpResponse.json(pendingPhoneVerificationFixture);
      default: {
        const unexpected: never = phase;
        throw new Error(`Unhandled user signup phase: ${String(unexpected)}`);
      }
    }
  }),

  http.post("*/api/v1/signup", () => {
    if (getPlaywrightOverrides()?.__signup__?.__forceSignupError__) {
      return new HttpResponse(null, { status: 500 });
    }

    userSignupState.scheduleTransition(UserSignupPhase.READY);
    return new HttpResponse(null, { status: 200 });
  }),

  http.put("*/api/v1/signup/verification", () => {
    const initiateError =
      getPlaywrightOverrides()?.__phoneVerification__?.__initiateError__;
    if (initiateError) {
      return HttpResponse.json({ message: initiateError }, { status: 400 });
    }

    // Stay in the current phase. READY is scheduled only when the user
    // completes verification via GET /signup/verification/:code.
    return new HttpResponse(null, { status: 200 });
  }),

  http.get("*/api/v1/signup/verification/:code", () => {
    const completeError =
      getPlaywrightOverrides()?.__phoneVerification__?.__completeError__;
    if (completeError) {
      return HttpResponse.json({ message: completeError }, { status: 400 });
    }

    userSignupState.scheduleTransition(UserSignupPhase.READY);
    return new HttpResponse(null, { status: 200 });
  }),

  http.post("*/api/v1/signup/verification/activation-code", () => {
    if (getPlaywrightOverrides()?.__activationCode__?.__forceError__) {
      return new HttpResponse(null, { status: 500 });
    }

    // Set READY immediately. Unlike phone verification, a NOT_STARTED user
    // is not polled, so CatalogPage's refetch after onVerified must already
    // see a ready signup.
    userSignupState.setPhase(UserSignupPhase.READY);
    return new HttpResponse(null, { status: 200 });
  }),

  http.get("*/api/v1/analytics/segment-write-key", () => {
    return new HttpResponse(segmentWriteKeyFixture);
  }),

  http.get("*/api/v1/uiconfig", () => {
    const disabledIntegrations =
      getPlaywrightOverrides()?.__uiconfig__?.__disabledIntegrations__;
    if (disabledIntegrations) {
      return HttpResponse.json({
        ...uiConfigFixture,
        disabledIntegrations,
      });
    }

    return HttpResponse.json(uiConfigFixture);
  }),

  http.post("*/api/v1/reset-namespaces", () => {
    if (getPlaywrightOverrides()?.__workspaces__?.__forceError__) {
      return new HttpResponse(null, { status: 500 });
    }

    return new HttpResponse(null, { status: 200 });
  }),
];
