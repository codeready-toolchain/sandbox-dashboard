import type {
  OpenClawCustomProvider,
  OpenClawGcpConfig,
  OpenClawItem,
  OpenClawWorkspace,
  SpaceRequestItem,
} from "../types";
import { isConditionTrue, isConditionFalse } from "./condition-utils";

export enum OpenClawStatus {
  NEW = "new",
  PROVISIONING = "provisioning",
  UNKNOWN = "unknown",
  READY = "ready",
  FAILED = "failed",
  IDLED = "idled",
  TERMINATING = "terminating",
  DELETING = "deleting",
}

export const getOpenClawReadyCondition = (
  data: OpenClawItem | undefined,
  setError: (errorDetails: string) => void,
): OpenClawStatus => {
  if (!data) {
    return OpenClawStatus.UNKNOWN;
  }

  if (data.spec?.idle) {
    return OpenClawStatus.IDLED;
  }

  const conditions = data.status?.conditions;
  if (!conditions?.length) {
    if (data.metadata?.creationTimestamp) {
      return OpenClawStatus.PROVISIONING;
    }
    return OpenClawStatus.NEW;
  }

  const [isSuccessful] = isConditionTrue("Ready", conditions);
  if (isSuccessful) {
    return OpenClawStatus.READY;
  }

  const [hasFailed, conditionFailure] = isConditionTrue("Failure", conditions);
  if (hasFailed) {
    if (conditionFailure) {
      setError(conditionFailure.message);
    }
    return OpenClawStatus.FAILED;
  }

  const [isProvisioning, conditionProvisioning] = isConditionFalse(
    "Ready",
    conditions,
  );
  if (isProvisioning && conditionProvisioning?.reason === "Provisioning") {
    return OpenClawStatus.PROVISIONING;
  }

  return OpenClawStatus.UNKNOWN;
};

export const newSpaceRequestObject = (namespace: string): string =>
  JSON.stringify({
    apiVersion: "toolchain.dev.openshift.com/v1alpha1",
    kind: "SpaceRequest",
    metadata: {
      namespace,
      name: "claw",
      labels: {
        "claw.sandbox.redhat.com/instance": "claw",
      },
    },
    spec: {
      tierName: "claw",
    },
  });

export const isSpaceRequestTerminating = (
  sr: SpaceRequestItem | undefined,
): boolean => {
  if (!sr?.status?.conditions) {
    return false;
  }
  const [notReady, condition] = isConditionFalse("Ready", sr.status.conditions);
  return notReady && condition?.reason === "Terminating";
};

export const isSpaceRequestReady = (
  sr: SpaceRequestItem | undefined,
): boolean => {
  if (!sr?.status?.conditions) {
    return false;
  }
  const [ready] = isConditionTrue("Ready", sr.status.conditions);
  return ready;
};

export const getSpaceRequestNamespace = (
  sr: SpaceRequestItem | undefined,
): string | undefined => {
  if (!isSpaceRequestReady(sr)) {
    return undefined;
  }
  return sr?.status?.namespaceAccess?.[0]?.name;
};

export type OpenClawCustomProviderInput = OpenClawCustomProvider;

export type OpenClawCredentialInput = {
  name: string;
  type: string;
  provider?: string;
  domain?: string;
  secretName: string;
  secretKeys: string[];
  gcp?: OpenClawGcpConfig;
};

export type NewOpenClawObjectOptions = {
  namespace: string;
  name: string;
  credentials: OpenClawCredentialInput[];
  disableDevicePairing: boolean;
  customProviders?: OpenClawCustomProviderInput[];
  webSearchProvider?: string;
  workspace?: OpenClawWorkspace;
  skills?: Record<string, string>;
};

export const newOpenClawObject = (opts: NewOpenClawObjectOptions): string => {
  const {
    namespace,
    name,
    credentials,
    disableDevicePairing,
    customProviders,
    webSearchProvider,
    workspace,
    skills,
  } = opts;
  const spec: Record<string, unknown> = {
    credentials: credentials.map((cred) => {
      const entry: Record<string, unknown> = {
        name: cred.name,
        type: cred.type,
        secretRef: cred.secretKeys.map((key) => ({
          name: cred.secretName,
          key,
        })),
      };
      if (cred.provider) {
        entry.provider = cred.provider;
      }
      if (cred.domain) {
        entry.domain = cred.domain;
      }
      if (cred.gcp) {
        entry.gcp = cred.gcp;
      }
      return entry;
    }),
    auth: {
      disableDevicePairing,
    },
  };

  if (customProviders?.length) {
    spec.customProviders = customProviders;
  }

  if (webSearchProvider) {
    spec.webSearch = { provider: webSearchProvider };
  }

  if (workspace) {
    spec.workspace = workspace;
  }

  if (skills && Object.keys(skills).length > 0) {
    spec.skills = skills;
  }

  return JSON.stringify({
    apiVersion: "claw.sandbox.redhat.com/v1alpha1",
    kind: "Claw",
    metadata: {
      namespace,
      name,
      labels: {
        "app.kubernetes.io/name": "claw",
        "claw.sandbox.redhat.com/instance": name,
      },
    },
    spec,
  });
};

export const newOpenClawSecretObject = (
  namespace: string,
  name: string,
  data: Record<string, string>,
  instanceName = "claw",
): string =>
  JSON.stringify({
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      namespace,
      name,
      labels: {
        "app.kubernetes.io/name": "claw",
        "claw.sandbox.redhat.com/instance": instanceName,
      },
    },
    stringData: data,
  });

const CLAW_LABELS = {
  "app.kubernetes.io/managed-by": "devsandbox-dashboard",
  "claw.sandbox.redhat.com/instance": "claw",
};

export const SA_NAME = "claw-workspace";
export const ROLEBINDING_EDIT_NAME = "claw-workspace-edit";
export const ROLEBINDING_RBAC_EDIT_NAME = "claw-workspace-rbac-edit";
export const NETWORK_POLICY_NAME = "allow-from-claw-namespace";
export const KUBECONFIG_SECRET_NAME = "workspace-kubeconfig";

export const newServiceAccountObject = (namespace: string): string =>
  JSON.stringify({
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
      namespace,
      name: SA_NAME,
      labels: CLAW_LABELS,
    },
  });

export const newEditRoleBindingObject = (namespace: string): string =>
  JSON.stringify({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: {
      namespace,
      name: ROLEBINDING_EDIT_NAME,
      labels: CLAW_LABELS,
    },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "ClusterRole",
      name: "edit",
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name: SA_NAME,
        namespace,
      },
    ],
  });

export const newRbacEditRoleBindingObject = (namespace: string): string =>
  JSON.stringify({
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: {
      namespace,
      name: ROLEBINDING_RBAC_EDIT_NAME,
      labels: CLAW_LABELS,
    },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "Role",
      name: "rbac-edit",
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name: SA_NAME,
        namespace,
      },
    ],
  });

export const newNetworkPolicyObject = (
  devNamespace: string,
  clawNamespace: string,
): string =>
  JSON.stringify({
    apiVersion: "networking.k8s.io/v1",
    kind: "NetworkPolicy",
    metadata: {
      namespace: devNamespace,
      name: NETWORK_POLICY_NAME,
      labels: CLAW_LABELS,
    },
    spec: {
      ingress: [
        {
          from: [
            {
              namespaceSelector: {
                matchLabels: {
                  "kubernetes.io/metadata.name": clawNamespace,
                },
              },
            },
          ],
        },
      ],
      podSelector: {},
      policyTypes: ["Ingress"],
    },
  });

export const TOKEN_EXPIRATION_SECONDS = 31536000;

export const newTokenRequestObject = (): string =>
  JSON.stringify({
    apiVersion: "authentication.k8s.io/v1",
    kind: "TokenRequest",
    spec: {
      expirationSeconds: TOKEN_EXPIRATION_SECONDS,
    },
  });

export const buildKubeconfig = (opts: {
  server: string;
  caData?: string;
  allowInsecure?: boolean;
  token: string;
  namespace: string;
}): string => {
  const cluster: Record<string, unknown> = { server: opts.server };
  if (opts.caData) {
    cluster["certificate-authority-data"] = opts.caData;
  } else if (opts.allowInsecure) {
    cluster["insecure-skip-tls-verify"] = true;
  } else {
    throw new Error(
      "buildKubeconfig: no caData provided and allowInsecure is not set.",
    );
  }

  const kubeconfig = {
    apiVersion: "v1",
    kind: "Config",
    clusters: [{ name: "sandbox", cluster }],
    users: [{ name: SA_NAME, user: { token: opts.token } }],
    contexts: [
      {
        name: "workspace",
        context: {
          cluster: "sandbox",
          user: SA_NAME,
          namespace: opts.namespace,
        },
      },
    ],
    "current-context": "workspace",
  };

  return JSON.stringify(kubeconfig);
};
