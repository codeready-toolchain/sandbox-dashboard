import { http, HttpResponse, type RequestHandler } from "msw";
import {
  authConfigFixture,
  localKeycloakAuthConfigFixture,
  readyUserFixture,
  uiConfigFixture,
  segmentWriteKeyFixture,
} from "../fixtures/registration-fixtures";

export const registrationMockHandlers: RequestHandler[] = [
  http.get("*/api/v1/authconfig", () => {
    const fixture =
      window.__config__?.environment === "dev-keycloak"
        ? localKeycloakAuthConfigFixture
        : authConfigFixture;
    return HttpResponse.json(fixture);
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
];
