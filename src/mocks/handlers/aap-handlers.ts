import { http, HttpResponse, type RequestHandler } from "msw";

import {
  aapEmptyFixture,
  aapFailedFixture,
  aapIdledFixture,
  aapProvisioningFixture,
  aapReadyFixture,
} from "../fixtures/aap-fixtures";
import { AAPMockPhase } from "./aap-mock-phase";
import { StateMachine } from "./state-machine";

/**
 * Expected request body for PATCH operations on an AAP instance.
 *
 * @property spec.idle_aap - When `true`, transitions the instance into the
 *   {@link AAPMockPhase.IDLED} phase instead of re-provisioning.
 */
interface AAPPatchBody {
  spec?: { idle_aap?: boolean };
}

/**
 * Define an initial state of the state machine taking into account the
 * Playwright overrides, if any.
 */
const initialState: AAPMockPhase =
  (typeof window !== "undefined"
    ? window.__playwrightOverrides__?.__aap__?.__initialState__
    : undefined) ?? AAPMockPhase.NOT_CREATED;

/**
 * Create the state machine for our requests.
 */
const aapState = new StateMachine<AAPMockPhase>(initialState);

/**
 * Expose the state machine so that the Playwright tests can override it at
 * will to test the different scenarios.
 */
if (typeof window !== "undefined") {
  window.__playwrightOverrides__ ??= {};
  window.__playwrightOverrides__.__aap__ ??= {};
  window.__playwrightOverrides__.__aap__.__stateMachine__ = aapState;
}

export const aapMockHandlers: RequestHandler[] = [
  http.get(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms",
    () => {
      switch (aapState.getPhase()) {
        case AAPMockPhase.NOT_CREATED:
        case AAPMockPhase.DELETING:
          return HttpResponse.json(aapEmptyFixture);
        case AAPMockPhase.PROVISIONING:
          return HttpResponse.json(aapProvisioningFixture);
        case AAPMockPhase.IDLED:
          return HttpResponse.json(aapIdledFixture);
        case AAPMockPhase.READY:
          return HttpResponse.json(aapReadyFixture);
        case AAPMockPhase.FAILED:
          return HttpResponse.json(aapFailedFixture);
      }
    },
  ),

  http.post(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms",
    () => {
      aapState.setPhase(AAPMockPhase.PROVISIONING);
      aapState.scheduleTransition(AAPMockPhase.READY);
      return new HttpResponse(null, { status: 201 });
    },
  ),

  http.patch(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms/sandbox-aap",
    async ({ request }) => {
      // Unmarshal the body assuming a "patch" structure, and in case of any
      // errors during unmarshalling simply use an empty object but casted as
      // the "patch" body itself to ensure safety.
      const body = (await request
        .json()
        .catch(() => ({}) as AAPPatchBody)) as AAPPatchBody;

      if (body?.spec?.idle_aap) {
        aapState.setPhase(AAPMockPhase.IDLED);
      } else {
        if (
          typeof window !== "undefined" &&
          window.__playwrightOverrides__?.__aap__?.__forceUnidleError__
        ) {
          return new HttpResponse(null, { status: 500 });
        }

        aapState.setPhase(AAPMockPhase.PROVISIONING);
        aapState.scheduleTransition(AAPMockPhase.READY);
      }

      return new HttpResponse(null, { status: 200 });
    },
  ),

  http.delete(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms/sandbox-aap",
    () => {
      aapState.setPhase(AAPMockPhase.DELETING);
      aapState.scheduleTransition(AAPMockPhase.NOT_CREATED, 1000 * 3);
      return new HttpResponse(null, { status: 200 });
    },
  ),
];
