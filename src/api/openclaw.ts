import type {
  OpenClawItem,
  OpenClawWorkspace,
  SpaceRequestItem,
} from "../types";
import type {
  AddedCredential,
  ProviderConfig,
} from "../utils/openclaw-providers";
import {
  buildKubeconfig,
  KUBECONFIG_SECRET_NAME,
  NETWORK_POLICY_NAME,
  newEditRoleBindingObject,
  newNetworkPolicyObject,
  newOpenClawObject,
  newOpenClawSecretObject,
  newRbacEditRoleBindingObject,
  newServiceAccountObject,
  newTokenRequestObject,
  ROLEBINDING_EDIT_NAME,
  ROLEBINDING_RBAC_EDIT_NAME,
  SA_NAME,
  type OpenClawCredentialInput,
  type OpenClawCustomProviderInput,
} from "../utils/openclaw-utils";
import { errorMessage } from "../utils/common";
import { authFetch } from "./authFetch";

const CLAW_NAME = "claw";
const CUSTOM_LLM_NAME = "custom-llm";

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function secretKeyForProvider(config: ProviderConfig): string {
  if (config.credentialType === "gcp") {
    return `${config.id}-sa-key.json`;
  }
  return `${config.id}-api-key`;
}

function buildSecretData(cred: AddedCredential): Record<string, string> {
  const config = cred.provider;
  const key = secretKeyForProvider(config);

  if (config.credentialType === "gcp") {
    const saKey = cred.values["sa-key.json"];
    return saKey ? { [key]: saKey } : {};
  }

  const apiKey = cred.values["api-key"];
  return apiKey ? { [key]: apiKey } : {};
}

function buildCredentialInput(
  cred: AddedCredential,
  secretName: string,
): OpenClawCredentialInput {
  const config = cred.provider;
  const key = secretKeyForProvider(config);

  const base: OpenClawCredentialInput = {
    name: config.id,
    type: config.credentialType,
    secretName,
    secretKeys: [key],
  };

  if (config.credentialType === "gcp") {
    return {
      ...base,
      name: config.id === "anthropic-vertex" ? "anthropic-vertex" : "gemini",
      provider: config.provider,
      gcp: {
        project: cred.values["project-id"] || undefined,
        location: cred.values["region"] || undefined,
      },
    };
  }

  if (config.id === "custom") {
    const endpointUrl = cred.values["endpoint-url"] ?? "";
    const apiKey = cred.values["api-key"];
    return {
      ...base,
      name: CUSTOM_LLM_NAME,
      type: apiKey ? "bearer" : "none",
      domain: extractHostname(endpointUrl),
      secretKeys: apiKey ? [key] : [],
    };
  }

  return {
    ...base,
    provider: config.provider,
    domain: config.domain,
  };
}

function buildCustomProvider(
  cred: AddedCredential,
): OpenClawCustomProviderInput | undefined {
  if (cred.provider.id !== "custom") return undefined;

  const endpointUrl = cred.values["endpoint-url"] ?? "";
  const apiFormat = cred.values["api-format"];
  const modelName = cred.values["model-name"] ?? "";
  const displayName = cred.values["display-name"];

  return {
    name: CUSTOM_LLM_NAME,
    baseUrl: endpointUrl,
    api: apiFormat !== "openai-completions" ? apiFormat : undefined,
    credentialRef: CUSTOM_LLM_NAME,
    models: [
      {
        name: modelName,
        alias: displayName || undefined,
      },
    ],
  };
}

function resolveWebSearchProvider(
  credentials: AddedCredential[],
): string | undefined {
  const hasStandardProvider = credentials.some(
    (c) => c.provider.id !== "custom",
  );
  if (!hasStandardProvider) return undefined;

  const hasGoogleApiKey = credentials.some(
    (c) =>
      c.provider.provider === "google" && c.provider.credentialType !== "gcp",
  );
  return hasGoogleApiKey ? "gemini" : "duckduckgo";
}

async function createOrUpdateSecret(
  basePath: string,
  name: string,
  body: string,
): Promise<void> {
  const response = await authFetch(basePath, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });

  if (response.ok) return;

  if (response.status === 409) {
    const getResponse = await authFetch(`${basePath}/${name}`, {
      method: "GET",
    });
    if (!getResponse.ok) {
      const error = await getResponse.json();
      throw new Error(errorMessage(error));
    }
    const existing = await getResponse.json();
    const parsed = JSON.parse(body);
    parsed.metadata = {
      ...parsed.metadata,
      resourceVersion: existing.metadata?.resourceVersion,
    };

    const updateResponse = await authFetch(`${basePath}/${name}`, {
      method: "PUT",
      body: JSON.stringify(parsed),
      headers: { "Content-Type": "application/json" },
    });
    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(errorMessage(error));
    }
    return;
  }

  const error = await response.json();
  throw new Error(errorMessage(error));
}

async function createIfAbsent(url: string, body: string): Promise<void> {
  const response = await authFetch(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });

  if (response.ok || response.status === 409) return;

  const error = await response.json();
  throw new Error(errorMessage(error));
}

async function deleteIfPresent(url: string): Promise<void> {
  const response = await authFetch(url, { method: "DELETE" });

  if (response.ok || response.status === 404) return;

  const error = await response.json();
  throw new Error(errorMessage(error));
}

export async function getSpaceRequest(
  proxyURL: string,
  namespace: string,
): Promise<SpaceRequestItem | undefined> {
  const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests/claw`;
  const response = await authFetch(`${proxyURL}${url}`, { method: "GET" });

  if (!response.ok) {
    if (response.status === 404) return undefined;
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
  return response.json();
}

export async function createSpaceRequest(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const { newSpaceRequestObject } = await import("../utils/openclaw-utils");
  const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests`;
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "POST",
    body: newSpaceRequestObject(namespace),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok && response.status !== 409) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
}

export async function deleteSpaceRequest(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests/claw`;
  const response = await authFetch(`${proxyURL}${url}`, { method: "DELETE" });

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
}

export async function getOpenClaw(
  proxyURL: string,
  namespace: string,
): Promise<OpenClawItem | undefined> {
  const url = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${CLAW_NAME}`;
  const response = await authFetch(`${proxyURL}${url}`, { method: "GET" });

  if (!response.ok) {
    if (response.status === 404) return undefined;
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
  return response.json();
}

export async function createOpenClaw(
  proxyURL: string,
  namespace: string,
  credentials: AddedCredential[],
  disableDevicePairing: boolean,
  workspace?: OpenClawWorkspace,
  skills?: Record<string, string>,
): Promise<void> {
  const secretsBasePath = `${proxyURL}/api/v1/namespaces/${namespace}/secrets`;
  const secretName = "llm-key";
  const createdSecrets: string[] = [];

  const mergedSecretData: Record<string, string> = {};
  for (const cred of credentials) {
    const data = buildSecretData(cred);
    Object.assign(mergedSecretData, data);
  }

  if (Object.keys(mergedSecretData).length > 0) {
    const secretBody = newOpenClawSecretObject(
      namespace,
      secretName,
      mergedSecretData,
    );
    await createOrUpdateSecret(secretsBasePath, secretName, secretBody);
    createdSecrets.push(secretName);
  }

  try {
    const credentialInputs: OpenClawCredentialInput[] = credentials.map(
      (cred) => buildCredentialInput(cred, secretName),
    );

    if (workspace) {
      credentialInputs.push({
        name: "k8s-workspace",
        type: "kubernetes",
        secretName: KUBECONFIG_SECRET_NAME,
        secretKeys: ["kubeconfig"],
      });
    }

    const customProviders: OpenClawCustomProviderInput[] = credentials
      .map((cred) => buildCustomProvider(cred))
      .filter((cp): cp is OpenClawCustomProviderInput => cp !== undefined);

    const webSearchProvider = resolveWebSearchProvider(credentials);

    const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws`;
    const clawResponse = await authFetch(`${proxyURL}${clawUrl}`, {
      method: "POST",
      body: newOpenClawObject({
        namespace,
        name: CLAW_NAME,
        credentials: credentialInputs,
        disableDevicePairing,
        customProviders:
          customProviders.length > 0 ? customProviders : undefined,
        webSearchProvider,
        workspace,
        skills,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!clawResponse.ok && clawResponse.status !== 409) {
      const error = await clawResponse.json();
      throw new Error(errorMessage(error));
    }
  } catch (err) {
    for (const name of createdSecrets) {
      try {
        await authFetch(`${secretsBasePath}/${name}`, { method: "DELETE" });
      } catch {
        // Best-effort cleanup
      }
    }
    throw err;
  }
}

export async function unIdleOpenClaw(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${CLAW_NAME}`;
  const response = await authFetch(`${proxyURL}${clawUrl}`, {
    method: "PATCH",
    body: JSON.stringify({ spec: { idle: false } }),
    headers: { "Content-Type": "application/merge-patch+json" },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
}

export async function deleteOpenClawCR(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const clawData = await getOpenClaw(proxyURL, namespace);
  const secretNames = new Set<string>();
  if (clawData?.spec?.credentials) {
    for (const cred of clawData.spec.credentials) {
      for (const ref of cred.secretRef) {
        secretNames.add(ref.name);
      }
    }
  }

  const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${CLAW_NAME}`;
  const clawResponse = await authFetch(`${proxyURL}${clawUrl}`, {
    method: "DELETE",
  });

  if (!clawResponse.ok && clawResponse.status !== 404) {
    const error = await clawResponse.json();
    throw new Error(errorMessage(error));
  }

  for (const name of secretNames) {
    const secretUrl = `/api/v1/namespaces/${namespace}/secrets/${name}`;
    const secretResponse = await authFetch(`${proxyURL}${secretUrl}`, {
      method: "DELETE",
    });

    if (!secretResponse.ok && secretResponse.status !== 404) {
      const error = await secretResponse.json();
      throw new Error(errorMessage(error));
    }
  }
}

export async function setupWorkspaceEnvironment(
  proxyURL: string,
  devNamespace: string,
  clawNamespace: string,
): Promise<void> {
  const saUrl = `${proxyURL}/api/v1/namespaces/${devNamespace}/serviceaccounts`;
  const rbUrl = `${proxyURL}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings`;
  const npUrl = `${proxyURL}/apis/networking.k8s.io/v1/namespaces/${devNamespace}/networkpolicies`;

  await createIfAbsent(saUrl, newServiceAccountObject(devNamespace));

  await Promise.all([
    createIfAbsent(rbUrl, newEditRoleBindingObject(devNamespace)),
    createIfAbsent(rbUrl, newRbacEditRoleBindingObject(devNamespace)),
    createIfAbsent(npUrl, newNetworkPolicyObject(devNamespace, clawNamespace)),
  ]);
}

export async function createWorkspaceKubeconfig(
  proxyURL: string,
  devNamespace: string,
  clawNamespace: string,
  apiEndpoint: string,
): Promise<void> {
  let caData: string | undefined;
  try {
    const caUrl = `${proxyURL}/api/v1/namespaces/${devNamespace}/configmaps/kube-root-ca.crt`;
    const caResponse = await authFetch(caUrl, { method: "GET" });
    if (caResponse.ok) {
      const caConfigMap = await caResponse.json();
      const caCert: string | undefined = caConfigMap?.data?.["ca.crt"];
      if (caCert) {
        caData = btoa(caCert);
      }
    }
  } catch {
    // Non-fatal
  }

  const tokenUrl = `${proxyURL}/api/v1/namespaces/${devNamespace}/serviceaccounts/${SA_NAME}/token`;
  const tokenResponse = await authFetch(tokenUrl, {
    method: "POST",
    body: newTokenRequestObject(),
    headers: { "Content-Type": "application/json" },
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.json();
    throw new Error(errorMessage(error));
  }

  const tokenData = await tokenResponse.json();
  const token: string = tokenData.status?.token;
  if (!token) {
    throw new Error("TokenRequest returned no token");
  }

  if (!apiEndpoint?.trim()) {
    throw new Error("createWorkspaceKubeconfig: apiEndpoint is required");
  }

  const kubeconfigContent = buildKubeconfig({
    server: apiEndpoint,
    caData,
    allowInsecure: !caData,
    token,
    namespace: devNamespace,
  });

  const secretsBasePath = `${proxyURL}/api/v1/namespaces/${clawNamespace}/secrets`;
  const secretBody = newOpenClawSecretObject(
    clawNamespace,
    KUBECONFIG_SECRET_NAME,
    { kubeconfig: kubeconfigContent },
  );
  await createOrUpdateSecret(
    secretsBasePath,
    KUBECONFIG_SECRET_NAME,
    secretBody,
  );
}

export async function cleanupWorkspaceEnvironment(
  proxyURL: string,
  devNamespace: string,
): Promise<void> {
  const results = await Promise.allSettled([
    deleteIfPresent(
      `${proxyURL}/apis/networking.k8s.io/v1/namespaces/${devNamespace}/networkpolicies/${NETWORK_POLICY_NAME}`,
    ),
    deleteIfPresent(
      `${proxyURL}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings/${ROLEBINDING_RBAC_EDIT_NAME}`,
    ),
    deleteIfPresent(
      `${proxyURL}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings/${ROLEBINDING_EDIT_NAME}`,
    ),
    deleteIfPresent(
      `${proxyURL}/api/v1/namespaces/${devNamespace}/serviceaccounts/${SA_NAME}`,
    ),
  ]);

  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(f.reason);
    }
    throw new AggregateError(
      failures.map((f) => f.reason),
      `Cleanup of namespace ${devNamespace} had ${failures.length} failure(s)`,
    );
  }
}
