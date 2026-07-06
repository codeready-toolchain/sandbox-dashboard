import type {
  DeploymentData,
  PersistentVolumeClaimData,
  SecretItem,
  StatefulSetData,
} from "../../types";

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
        volumeClaimTemplates: [{ metadata: { name: "data" } }],
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
