import { ApiError } from "../error/ApiError";
import type {
  OpenClawItem,
  OpenClawWorkspace,
  SpaceRequestItem,
} from "../types";
import logger from "../utils/logger";
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

/**
 * Upserts a given secret.
 * @param basePath the base path of the URL.
 * @param name the name of the secret.
 * @param body the body of the request.
 * @throws {ApiError} if the requests to create or update the secret fail.
 */
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
      throw await ApiError.fromResponse(
        "createOrUpdateSecret failed: unable to fetch secret",
        getResponse,
      );
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
      throw await ApiError.fromResponse(
        "createOrUpdateSecret failed: unable to update",
        updateResponse,
      );
    }
    return;
  }

  throw await ApiError.fromResponse("createOrUpdateSecret", response);
}

/**
 * Creates an object and counts 409 responses as valid.
 * @param url the URL to send the request to.
 * @param body the body of the request.
 * @param label a descriptive resource label for error messages.
 * @throws {ApiError} if the request fails.
 */
async function createIfAbsent(
  url: string,
  body: string,
  label: string,
): Promise<void> {
  const response = await authFetch(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });

  if (response.ok || response.status === 409) return;

  throw await ApiError.fromResponse(
    `createIfAbsent failed: ${label}`,
    response,
  );
}

/**
 * Logs each rejected result and throws an AggregateError when any exist.
 * @param rejected the filtered rejected results.
 * @param context a label describing the operation (used in log and error messages).
 * @throws {AggregateError} if `rejected` is non-empty.
 */
function logAndAggregate(
  rejected: PromiseRejectedResult[],
  context: string,
): void {
  if (rejected.length === 0) return;

  for (const f of rejected) {
    const reason = f.reason;
    if (reason instanceof ApiError) {
      logger.error(`${context}: failed (status ${reason.statusCode})`, {
        statusCode: reason.statusCode,
        body: reason.body,
      });
    } else {
      logger.error(`${context}: failed`, reason);
    }
  }
  throw new AggregateError(
    rejected.map((f) => f.reason),
    `${context}: ${rejected.length} failure(s)`,
  );
}

/**
 * Deletes a resource and treats 404 responses as successful no-ops.
 * @param url the URL of the resource to delete.
 * @param label a descriptive resource label for error messages.
 * @throws {ApiError} if the delete request fails with a non-404 status.
 */
async function deleteIfPresent(url: string, label: string): Promise<void> {
  const response = await authFetch(url, { method: "DELETE" });

  if (response.ok || response.status === 404) return;

  throw await ApiError.fromResponse(
    `deleteIfPresent failed: ${label}`,
    response,
  );
}

/**
 * Fetches the SpaceRequest for the given namespace.
 * @param proxyURL the base proxy URL.
 * @param namespace the target namespace.
 * @returns the SpaceRequest item, or undefined if it does not exist.
 * @throws {ApiError} if the request fails with a non-404 status.
 */
export async function getSpaceRequest(
  proxyURL: string,
  namespace: string,
): Promise<SpaceRequestItem | undefined> {
  const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests/claw`;
  const response = await authFetch(`${proxyURL}${url}`, { method: "GET" });

  if (!response.ok) {
    if (response.status === 404) return undefined;
    throw await ApiError.fromResponse("getSpaceRequest failed", response);
  }
  return response.json();
}

/**
 * Creates a SpaceRequest in the given namespace. Treats 409 as a no-op.
 * @param proxyURL the base proxy URL.
 * @param namespace the target namespace.
 * @throws {ApiError} if the request fails with a non-409 status.
 */
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
    throw await ApiError.fromResponse("createSpaceRequest", response);
  }
}

/**
 * Deletes the SpaceRequest in the given namespace. Treats 404 as a no-op.
 * @param proxyURL the base proxy URL.
 * @param namespace the target namespace.
 * @throws {ApiError} if the request fails with a non-404 status.
 */
export async function deleteSpaceRequest(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests/claw`;
  const response = await authFetch(`${proxyURL}${url}`, { method: "DELETE" });

  if (!response.ok && response.status !== 404) {
    throw await ApiError.fromResponse("deleteSpaceRequest", response);
  }
}

/**
 * Fetches the OpenClaw CR for the given namespace.
 * @param proxyURL the base proxy URL.
 * @param namespace the target namespace.
 * @returns the OpenClaw item, or undefined if it does not exist.
 * @throws {ApiError} if the request fails with a non-404 status.
 */
export async function getOpenClaw(
  proxyURL: string,
  namespace: string,
): Promise<OpenClawItem | undefined> {
  const url = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${CLAW_NAME}`;
  const response = await authFetch(`${proxyURL}${url}`, { method: "GET" });

  if (!response.ok) {
    if (response.status === 404) return undefined;
    throw await ApiError.fromResponse("getOpenClaw", response);
  }
  return response.json();
}

/**
 * Creates an OpenClaw instance with the provided credentials and configuration.
 * Rolls back created secrets on failure.
 * @param proxyURL the base proxy URL.
 * @param namespace the target namespace.
 * @param credentials the LLM provider credentials to configure.
 * @param disableDevicePairing whether to disable device pairing.
 * @param workspace optional workspace configuration for k8s access.
 * @param skills optional skill definitions to attach to the instance.
 * @throws {ApiError} if the OpenClaw CR creation fails with a non-409 status.
 */
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
      throw await ApiError.fromResponse("createOpenClaw", clawResponse);
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

/**
 * Patches the OpenClaw CR to un-idle the instance.
 * @param proxyURL the base proxy URL.
 * @param namespace the target namespace.
 * @throws {ApiError} if the patch request fails.
 */
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
    throw await ApiError.fromResponse("unIdleOpenClaw", response);
  }
}

/**
 * Deletes the OpenClaw CR and its associated secrets. Secret deletions are
 * performed in parallel using best-effort semantics: all secrets are attempted
 * regardless of individual failures, and 404 responses are treated as no-ops.
 * @param proxyURL the base proxy URL.
 * @param namespace the target namespace.
 * @throws {ApiError} if deleting the CR itself fails with a non-404 status.
 * @throws {AggregateError} if one or more secret deletions fail.
 */
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
    throw await ApiError.fromResponse("deleteOpenClawCR", clawResponse);
  }

  const results = await Promise.allSettled(
    [...secretNames].map((name) =>
      deleteIfPresent(
        `${proxyURL}/api/v1/namespaces/${namespace}/secrets/${name}`,
        `secret ${name}`,
      ),
    ),
  );

  logAndAggregate(
    results.filter((r): r is PromiseRejectedResult => r.status === "rejected"),
    "deleteOpenClawCR: secret deletion",
  );
}

/**
 * Creates the workspace environment resources (service account, role bindings,
 * network policy) required for OpenClaw to operate in the dev namespace.
 * @param proxyURL the base proxy URL.
 * @param devNamespace the development namespace to configure.
 * @param clawNamespace the namespace where OpenClaw runs.
 * @throws {ApiError} if any resource creation fails.
 */
export async function setupWorkspaceEnvironment(
  proxyURL: string,
  devNamespace: string,
  clawNamespace: string,
): Promise<void> {
  const saUrl = `${proxyURL}/api/v1/namespaces/${devNamespace}/serviceaccounts`;
  const rbUrl = `${proxyURL}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings`;
  const npUrl = `${proxyURL}/apis/networking.k8s.io/v1/namespaces/${devNamespace}/networkpolicies`;

  await createIfAbsent(
    saUrl,
    newServiceAccountObject(devNamespace),
    `service account ${SA_NAME}`,
  );

  await Promise.all([
    createIfAbsent(
      rbUrl,
      newEditRoleBindingObject(devNamespace),
      `role binding ${ROLEBINDING_EDIT_NAME}`,
    ),
    createIfAbsent(
      rbUrl,
      newRbacEditRoleBindingObject(devNamespace),
      `role binding ${ROLEBINDING_RBAC_EDIT_NAME}`,
    ),
    createIfAbsent(
      npUrl,
      newNetworkPolicyObject(devNamespace, clawNamespace),
      `network policy ${NETWORK_POLICY_NAME}`,
    ),
  ]);
}

/**
 * Generates a workspace kubeconfig and stores it as a secret in the claw namespace.
 * Fetches a CA certificate (best-effort) and requests a short-lived token for the
 * service account before building the kubeconfig.
 * @param proxyURL the base proxy URL.
 * @param devNamespace the development namespace containing the service account.
 * @param clawNamespace the namespace where the kubeconfig secret is stored.
 * @param apiEndpoint the Kubernetes API server endpoint for the kubeconfig.
 * @throws {ApiError} if the token request or secret creation fails.
 */
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
    throw await ApiError.fromResponse(
      "createWorkspaceKubeconfig: token request failed",
      tokenResponse,
    );
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

/**
 * Removes workspace environment resources (network policy, role bindings,
 * service account) from the dev namespace.
 * @param proxyURL the base proxy URL.
 * @param devNamespace the development namespace to clean up.
 * @throws {AggregateError} if one or more deletions fail.
 */
export async function cleanupWorkspaceEnvironment(
  proxyURL: string,
  devNamespace: string,
): Promise<void> {
  const results = await Promise.allSettled([
    deleteIfPresent(
      `${proxyURL}/apis/networking.k8s.io/v1/namespaces/${devNamespace}/networkpolicies/${NETWORK_POLICY_NAME}`,
      `network policy ${NETWORK_POLICY_NAME}`,
    ),
    deleteIfPresent(
      `${proxyURL}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings/${ROLEBINDING_RBAC_EDIT_NAME}`,
      `role binding ${ROLEBINDING_RBAC_EDIT_NAME}`,
    ),
    deleteIfPresent(
      `${proxyURL}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings/${ROLEBINDING_EDIT_NAME}`,
      `role binding ${ROLEBINDING_EDIT_NAME}`,
    ),
    deleteIfPresent(
      `${proxyURL}/api/v1/namespaces/${devNamespace}/serviceaccounts/${SA_NAME}`,
      `service account ${SA_NAME}`,
    ),
  ]);

  logAndAggregate(
    results.filter((r): r is PromiseRejectedResult => r.status === "rejected"),
    `Cleanup of namespace ${devNamespace}`,
  );
}
