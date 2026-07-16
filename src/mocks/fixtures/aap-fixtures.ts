import type { AAPCRList } from "../../types";

export const aapReadyFixture: AAPCRList = {
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

export const aapProvisioningFixture: AAPCRList = {
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

export const aapIdledFixture: AAPCRList = {
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
      spec: { idle_aap: true },
      metadata: {
        name: "sandbox-aap",
        uuid: "aap-uuid-123",
        creationTimestamp: "2025-01-15T00:00:00Z",
      },
    },
  ],
};

export const aapFailedFixture: AAPCRList = {
  items: [
    {
      status: {
        conditions: [
          {
            type: "Failure",
            status: "True",
            reason: "ReconciliationFailed",
            message: "Task failed: some operator error",
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

export const aapEmptyFixture: AAPCRList = {
  items: [],
};
