import type {
  AAPData,
  DeploymentData,
  PersistentVolumeClaimData,
  SecretItem,
  SignupData,
  StatefulSetData,
  AuthConfigResponse,
  UIConfig,
} from "../types";

export const MOCK_PROXY_URL = "https://proxy.example.com";
export const MOCK_REG_SERVICE_URL = "https://registration.example.com";

export const authConfigFixture: AuthConfigResponse = {
  "auth-client-library-url":
    "https://sso.devsandbox.dev/auth/js/keycloak.js",
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

export const readyUserFixture: SignupData = {
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
  startDate: "2025-01-01T00:00:00Z",
  endDate: "2025-01-31T00:00:00Z",
};

export const verifyUserFixture: SignupData = {
  ...readyUserFixture,
  status: {
    ready: false,
    reason: "",
    verificationRequired: true,
  },
};

export const provisioningUserFixture: SignupData = {
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

export const secretFixture: SecretItem = {
  data: {
    password: btoa("admin-password"),
  },
  metadata: {
    name: "sandbox-aap-admin-password",
    uuid: "secret-uuid-123",
    creationTimestamp: "2025-01-15T00:00:00Z",
  },
};

export const deploymentFixture: DeploymentData = {
  items: [
    {
      metadata: {
        name: "test-deployment",
        uuid: "deploy-uuid-1",
        creationTimestamp: "2025-01-15T00:00:00Z",
        labels: { app: "sandbox-aap" },
      },
      status: {
        conditions: [{ type: "Available", status: "True" }],
      },
      spec: {
        replicas: 1,
        template: {
          metadata: {
            labels: { app: "sandbox-aap", deployment: "test-deployment" },
          },
          spec: {
            volumes: [
              {
                name: "data-volume",
                persistentVolumeClaim: { claimName: "test-pvc" },
              },
              {
                name: "secret-volume",
                secret: { secretName: "test-secret" },
              },
            ],
          },
        },
      },
    },
  ],
};

export const statefulSetFixture: StatefulSetData = {
  items: [
    {
      metadata: {
        name: "test-statefulset",
        uuid: "sts-uuid-1",
        creationTimestamp: "2025-01-15T00:00:00Z",
        labels: { app: "sandbox-aap" },
      },
      status: {
        conditions: [{ type: "Available", status: "True" }],
      },
      spec: {
        replicas: 1,
        template: {
          metadata: {
            labels: { app: "sandbox-aap", deployment: "test-statefulset" },
          },
          spec: {},
        },
        volumeClaimTemplates: [
          { metadata: { name: "data" } },
        ],
      },
    },
  ],
};

export const pvcFixture: PersistentVolumeClaimData = {
  items: [
    {
      metadata: {
        name: "test-pvc-1",
        uuid: "pvc-uuid-1",
        creationTimestamp: "2025-01-15T00:00:00Z",
        labels: { app: "sandbox-aap" },
      },
    },
  ],
};

export const aapReadyFixture: AAPData = {
  items: [
    {
      status: {
        conditions: [
          {
            type: "Successful",
            status: "True",
            reason: "Successful",
            message: "",
          },
        ],
        URL: "https://aap.apps.example.com",
        adminPasswordSecret: "sandbox-aap-admin-password",
        adminUser: "admin",
      },
      spec: { idle_aap: false },
      metadata: {
        name: "sandbox-aap",
        uuid: "aap-uuid-123",
        creationTimestamp: "2025-01-15T00:00:00Z",
      },
    },
  ],
};

export const aapProvisioningFixture: AAPData = {
  items: [
    {
      status: {
        conditions: [
          {
            type: "Running",
            status: "True",
            reason: "Running",
            message: "Running reconciliation",
          },
        ],
        URL: "",
        adminPasswordSecret: "",
        adminUser: "",
      },
      spec: { idle_aap: false },
      metadata: {
        name: "sandbox-aap",
        uuid: "aap-uuid-123",
        creationTimestamp: "2025-01-15T00:00:00Z",
      },
    },
  ],
};

export const aapEmptyFixture: AAPData = {
  items: [],
};
