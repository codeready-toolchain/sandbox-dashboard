import type { OpenClawItem, SpaceRequestItem } from "../../types";

export const clawSpaceRequest: SpaceRequestItem = {
  metadata: {
    name: "claw",
  },
  spec: {
    tierName: "claw",
  },
  status: {
    conditions: [
      { type: "Ready", message: "", reason: "Provisioned", status: "True" },
    ],
    namespaceAccess: [{ name: "claw", secretRef: "" }],
  },
};

export const openClawTerminatingSpaceRequest: SpaceRequestItem = {
  metadata: {
    name: "claw",
  },
  spec: {
    tierName: "claw",
  },
  status: {
    conditions: [
      { type: "Ready", message: "", reason: "Terminating", status: "False" },
    ],
    namespaceAccess: [{ name: "claw", secretRef: "" }],
  },
};

export const openClawProvisioning: OpenClawItem = {
  metadata: {
    name: "claw",
    creationTimestamp: "2025-01-15T00:00:00Z",
  },
  spec: {
    idle: false,
  },
  status: {
    conditions: [
      {
        type: "Ready",
        status: "False",
        reason: "Provisioning",
        message: "Waiting for deployments to become ready",
      },
    ],
  },
};

export const openClawIdledFixture: OpenClawItem = {
  metadata: {
    name: "claw",
    creationTimestamp: "2025-01-15T00:00:00Z",
  },
  spec: {
    idle: true,
  },
  status: {
    conditions: [
      { type: "Ready", status: "True", reason: "Provisioned", message: "" },
    ],
    url: "https://openclaw.apps.example.com",
  },
};

export const openClawFixture: OpenClawItem = {
  metadata: {
    name: "claw",
    creationTimestamp: "2025-01-15T00:00:00Z",
  },
  spec: {
    idle: false,
  },
  status: {
    conditions: [
      { type: "Ready", status: "True", reason: "Provisioned", message: "" },
    ],
    url: "https://openclaw.apps.example.com",
  },
};

export const kubeRootCaConfigMapFixture = {
  apiVersion: "v1",
  kind: "ConfigMap",
  metadata: {
    name: "kube-root-ca.crt",
    namespace: "johndoe-dev",
  },
  data: {
    "ca.crt":
      "-----BEGIN CERTIFICATE-----\nMOCK-CA-CERT-DATA\n-----END CERTIFICATE-----\n",
  },
};

export const tokenRequestResponseFixture = {
  kind: "TokenRequest",
  apiVersion: "authentication.k8s.io/v1",
  status: {
    token: "mock-service-account-token",
    expirationTimestamp: "2026-07-06T19:03:50Z",
  },
};
