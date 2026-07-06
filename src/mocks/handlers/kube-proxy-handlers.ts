import { http, HttpResponse, type RequestHandler } from "msw";
import {
  secretFixture,
  deploymentFixture,
  statefulSetFixture,
  pvcFixture,
} from "../fixtures/kube-proxy-fixtures";

export const kubeProxyMockHandlers: RequestHandler[] = [
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
];
