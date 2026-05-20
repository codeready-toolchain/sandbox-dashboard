import { http, HttpResponse, type RequestHandler } from "msw";
import {
  authConfigFixture,
  readyUserFixture,
  uiConfigFixture,
  segmentWriteKeyFixture,
  secretFixture,
  deploymentFixture,
  statefulSetFixture,
  pvcFixture,
  aapReadyFixture,
} from "./fixtures";

export const handlers: RequestHandler[] = [
  // Registration-service endpoints
  http.get("*/api/v1/authconfig", () => {
    return HttpResponse.json(authConfigFixture);
  }),

  http.get("*/api/v1/signup", () => {
    return HttpResponse.json(readyUserFixture);
  }),

  http.post("*/api/v1/signup", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.put("*/api/v1/signup/verification", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get("*/api/v1/signup/verification/:code", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post("*/api/v1/signup/verification/activation-code", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.get("*/api/v1/analytics/segment-write-key", () => {
    return new HttpResponse(segmentWriteKeyFixture);
  }),

  http.get("*/api/v1/uiconfig", () => {
    return HttpResponse.json(uiConfigFixture);
  }),

  http.post("*/api/v1/reset-namespaces", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Kube proxy endpoints
  http.get("*/api/v1/namespaces/:ns/secrets/:name", () => {
    return HttpResponse.json(secretFixture);
  }),

  http.get("*/api/v1/namespaces/:ns/persistentvolumeclaims", () => {
    return HttpResponse.json(pvcFixture);
  }),

  http.get("*/apis/apps/v1/namespaces/:ns/deployments", () => {
    return HttpResponse.json(deploymentFixture);
  }),

  http.get("*/apis/apps/v1/namespaces/:ns/statefulsets", () => {
    return HttpResponse.json(statefulSetFixture);
  }),

  http.delete("*/api/v1/namespaces/:ns/persistentvolumeclaims/:name", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.delete("*/api/v1/namespaces/:ns/secrets/:name", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // AAP proxy endpoints
  http.get(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms",
    () => {
      return HttpResponse.json(aapReadyFixture);
    },
  ),

  http.post(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms",
    () => {
      return new HttpResponse(null, { status: 201 });
    },
  ),

  http.patch(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms/sandbox-aap",
    () => {
      return new HttpResponse(null, { status: 200 });
    },
  ),

  http.delete(
    "*/apis/aap.ansible.com/v1alpha1/namespaces/:ns/ansibleautomationplatforms/sandbox-aap",
    () => {
      return new HttpResponse(null, { status: 200 });
    },
  ),
];
