import type { AAPData } from "../../types";

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

export const aapIdledFixture: AAPData = {
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

export const aapEmptyFixture: AAPData = {
  items: [],
};
