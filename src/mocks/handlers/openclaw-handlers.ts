import { http, HttpResponse, type RequestHandler } from "msw";
import {
  clawSpaceRequest,
  openClawFixture,
  openClawIdledFixture,
  openClawProvisioning,
  openClawTerminatingSpaceRequest,
  kubeRootCaConfigMapFixture,
  tokenRequestResponseFixture,
} from "../fixtures/openclaw-fixtures";
import { StateMachine } from "./state-machine";

/**
 * Expected request body for PATCH operations on a Claw instance.
 *
 * @property spec.idle_aap - When `true`, transitions the instance into the
 *   {@link OpenClawMockPhase.IDLED} phase instead of re-provisioning.
 */
interface ClawPatchBody {
  spec?: { idle_aap?: boolean };
}

/**
 * Defines the different states the mocked OpenClaw instance can be in.
 */
export enum OpenClawMockPhase {
  NOT_CREATED,
  SPACE_REQUEST_PROVISIONING,
  CLAW_PROVISIONING,
  READY,
  IDLED,
  TERMINATING,
  DELETED,
}

/**
 * Create the state machine for our requests.
 */
const openClawState = new StateMachine<OpenClawMockPhase>(
  OpenClawMockPhase.NOT_CREATED,
);

export const openClawMockHandlers: RequestHandler[] = [
  // ===== SpaceRequest =====
  http.get(
    "*/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/:ns/spacerequests/claw",
    () => {
      const phase = openClawState.getPhase();
      switch (phase) {
        case OpenClawMockPhase.NOT_CREATED:
        case OpenClawMockPhase.DELETED:
          return new HttpResponse(null, { status: 404 });
        case OpenClawMockPhase.TERMINATING:
          return HttpResponse.json(openClawTerminatingSpaceRequest);
        default:
          return HttpResponse.json(clawSpaceRequest);
      }
    },
  ),

  http.post(
    "*/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/:ns/spacerequests",
    () => {
      openClawState.setPhase(OpenClawMockPhase.SPACE_REQUEST_PROVISIONING);
      return new HttpResponse(null, { status: 201 });
    },
  ),

  http.delete(
    "*/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/:ns/spacerequests/claw",
    () => {
      openClawState.setPhase(OpenClawMockPhase.TERMINATING);
      openClawState.scheduleTransition(OpenClawMockPhase.DELETED);
      return new HttpResponse(null, { status: 200 });
    },
  ),

  // ===== Claw CR =====

  http.get(
    "*/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/:ns/claws/claw",
    () => {
      switch (openClawState.getPhase()) {
        case OpenClawMockPhase.CLAW_PROVISIONING:
          return HttpResponse.json(openClawProvisioning);
        case OpenClawMockPhase.READY:
          return HttpResponse.json(openClawFixture);
        case OpenClawMockPhase.IDLED:
          return HttpResponse.json(openClawIdledFixture);
        default:
          return new HttpResponse(null, { status: 404 });
      }
    },
  ),

  http.post(
    "*/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/:ns/claws",
    () => {
      openClawState.setPhase(OpenClawMockPhase.CLAW_PROVISIONING);
      openClawState.scheduleTransition(OpenClawMockPhase.READY);
      return new HttpResponse(null, { status: 201 });
    },
  ),

  http.patch(
    "*/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/:ns/claws/claw",
    async ({ request }) => {
      // Unmarshal the body assuming a "patch" structure, and in case of any
      // errors during unmarshalling simply use an empty object but casted as
      // the "patch" body itself to ensure safety.
      const body = (await request
        .json()
        .catch(() => ({}) as ClawPatchBody)) as ClawPatchBody;

      if (body?.spec?.idle_aap) {
        openClawState.setPhase(OpenClawMockPhase.IDLED);
      } else {
        openClawState.setPhase(OpenClawMockPhase.CLAW_PROVISIONING);
        openClawState.scheduleTransition(OpenClawMockPhase.READY);
      }

      return new HttpResponse(null, { status: 200 });
    },
  ),

  http.delete(
    "*/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/:ns/claws/claw",
    () => {
      openClawState.setPhase(OpenClawMockPhase.DELETED);

      return new HttpResponse(null, { status: 200 });
    },
  ),

  // ===== Workspace environment setup =====
  // These are created by setupWorkspaceEnvironment() and
  // createWorkspaceKubeconfig() before the Claw CR is posted.

  http.post("*/api/v1/namespaces/:ns/serviceaccounts", () => {
    return new HttpResponse(null, { status: 201 });
  }),

  http.post(
    "*/apis/rbac.authorization.k8s.io/v1/namespaces/:ns/rolebindings",
    () => {
      return new HttpResponse(null, { status: 201 });
    },
  ),

  http.post(
    "*/apis/networking.k8s.io/v1/namespaces/:ns/networkpolicies",
    () => {
      return new HttpResponse(null, { status: 201 });
    },
  ),

  http.get("*/api/v1/namespaces/:ns/configmaps/kube-root-ca.crt", () => {
    return HttpResponse.json(kubeRootCaConfigMapFixture);
  }),

  http.post(
    "*/api/v1/namespaces/:ns/serviceaccounts/claw-workspace/token",
    () => {
      return HttpResponse.json(tokenRequestResponseFixture, { status: 201 });
    },
  ),

  http.post("*/api/v1/namespaces/:ns/secrets", () => {
    return new HttpResponse(null, { status: 201 });
  }),

  // ===== Workspace environment cleanup or delete flow =====

  http.delete(
    "*/apis/rbac.authorization.k8s.io/v1/namespaces/:ns/rolebindings/claw-workspace-rbac-edit",
    () => {
      return new HttpResponse(null, { status: 200 });
    },
  ),

  http.delete(
    "*/apis/rbac.authorization.k8s.io/v1/namespaces/:ns/rolebindings/claw-workspace-edit",
    () => {
      return new HttpResponse(null, { status: 200 });
    },
  ),

  http.delete("*/api/v1/namespaces/:ns/serviceaccounts/claw-workspace", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.delete(
    "*/apis/networking.k8s.io/v1/namespaces/:ns/networkpolicies/allow-from-claw-namespace",
    () => {
      return new HttpResponse(null, { status: 200 });
    },
  ),

  http.delete("*/api/v1/namespaces/:ns/secrets/:name", () => {
    return new HttpResponse(null, { status: 200 });
  }),
];
