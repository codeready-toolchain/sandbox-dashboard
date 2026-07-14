import type { AuthConfigResponse, User, UIConfig } from "../../types";

export const MOCK_PROXY_URL = "https://proxy.example.com";
export const MOCK_REG_SERVICE_URL = "https://registration.example.com";

export const authConfigFixture: AuthConfigResponse = {
  "auth-client-library-url": "https://sso.devsandbox.dev/auth/js/keycloak.js",
  "auth-client-config": JSON.stringify({
    realm: "sandbox-dev",
    "auth-server-url": "https://sso.devsandbox.dev/auth",
    resource: "sandbox-public",
    clientId: "sandbox-public",
    "public-client": true,
    "confidential-port": 0,
  }),
  "signup-url": MOCK_REG_SERVICE_URL,
};

export const localKeycloakAuthConfigFixture: AuthConfigResponse = {
  "auth-client-library-url": "http://localhost:8080/js/keycloak.js",
  "auth-client-config": JSON.stringify({
    realm: "sandbox-dev",
    "auth-server-url": "http://localhost:8080",
    clientId: "sandbox-public",
    "public-client": true,
  }),
  "signup-url": MOCK_REG_SERVICE_URL,
};

export const readyUserFixture: User = {
  name: "John Doe",
  compliantUsername: "johndoe",
  username: "johndoe",
  givenName: "John",
  familyName: "Doe",
  company: "Red Hat",
  email: "johndoe@example.com",
  status: {
    ready: true,
    reason: "",
    verificationRequired: false,
  },
  consoleURL: "https://console.apps.example.com",
  proxyURL: MOCK_PROXY_URL,
  rhodsMemberURL: "https://rhods.apps.example.com",
  cheDashboardURL: "https://devspaces.apps.example.com",
  defaultUserNamespace: "johndoe-dev",
  apiEndpoint: "https://api.apps.example.com:6443",
  startDate: "2025-01-01T00:00:00Z",
  endDate: "2025-01-31T00:00:00Z",
};

export const verifyUserFixture: User = {
  ...readyUserFixture,
  status: {
    ready: false,
    reason: "",
    verificationRequired: true,
  },
};

export const provisioningUserFixture: User = {
  ...readyUserFixture,
  status: {
    ready: false,
    reason: "Provisioning",
    verificationRequired: false,
  },
};

export const uiConfigFixture: UIConfig = {
  workatoWebHookURL: "https://webhooks.example.com/sandbox",
};

export const segmentWriteKeyFixture = "mock-segment-write-key";
