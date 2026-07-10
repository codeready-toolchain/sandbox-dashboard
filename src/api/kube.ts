import { ApiError } from "../error/ApiError";
import type {
  DeploymentData,
  PersistentVolumeClaimData,
  SecretItem,
  StatefulSetData,
} from "../types";
import { authFetch } from "./authFetch";

/**
 * Builds a Kubernetes resource URL, optionally appending a label selector
 * query parameter.
 * @param basePath the base API path for the resource collection.
 * @param labelSelector the raw label selector to filter by (will be URL-encoded).
 * @returns the complete URL with or without the `?labelSelector=` suffix.
 */
function resourceUrl(basePath: string, labelSelector?: string): string {
  return labelSelector
    ? `${basePath}?labelSelector=${encodeURIComponent(labelSelector)}`
    : basePath;
}

function pvcUrl(namespace: string, labelSelector?: string): string {
  return resourceUrl(
    `/api/v1/namespaces/${namespace}/persistentvolumeclaims`,
    labelSelector,
  );
}

function deploymentUrl(namespace: string, labelSelector?: string): string {
  return resourceUrl(
    `/apis/apps/v1/namespaces/${namespace}/deployments`,
    labelSelector,
  );
}

function statefulSetUrl(namespace: string, labelSelector?: string): string {
  return resourceUrl(
    `/apis/apps/v1/namespaces/${namespace}/statefulsets`,
    labelSelector,
  );
}

/**
 * Deletes the secrets and persistent volume claims.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param k8sObjects the Kubernetes objects to delete.
 * @param userNamespace the namespace to delete the resources from.
 * @throws {ApiError} if the API calls to delete the persistent volume claims
 * or the secrets fail.
 */
export async function deleteSecretsAndPVCs(
  proxyURL: string,
  k8sObjects: StatefulSetData | DeploymentData | void,
  userNamespace: string,
): Promise<void> {
  if (k8sObjects && k8sObjects.items.length > 0) {
    for (const k8sObject of k8sObjects.items) {
      const volumes = k8sObject?.spec?.template?.spec?.volumes;
      if (!volumes) continue;

      for (const volume of volumes) {
        if (volume.persistentVolumeClaim?.claimName) {
          const url = `/api/v1/namespaces/${userNamespace}/persistentvolumeclaims/${volume.persistentVolumeClaim.claimName}`;
          const response = await authFetch(`${proxyURL}${url}`, {
            method: "DELETE",
          });
          if (!response.ok && response.status !== 404) {
            throw await ApiError.fromResponse(
              "deleteSecretsAndPVCs failed: unable to delete persistent volume claims",
              response,
            );
          }
        }

        if (volume.secret?.secretName) {
          const url = `/api/v1/namespaces/${userNamespace}/secrets/${volume.secret.secretName}`;
          const response = await authFetch(`${proxyURL}${url}`, {
            method: "DELETE",
          });
          if (!response.ok && response.status !== 404) {
            throw await ApiError.fromResponse(
              "deleteSecretsAndPVCs failed: unable to delete secrets",
              response,
            );
          }
        }
      }
    }
  }
}

/**
 * Deletes the persistent volume claims for the given stateful set data.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param k8sObjects the Kubernetes objects to delete.
 * @param userNamespace the namespace to delete the resources from.
 * @throws {ApiError} if the API calls to delete the persistent volume claims
 * fail.
 */
export async function deletePVCsForSTS(
  proxyURL: string,
  k8sObjects: StatefulSetData | void,
  userNamespace: string,
): Promise<void> {
  if (k8sObjects && k8sObjects.items.length > 0) {
    for (const k8sObject of k8sObjects.items) {
      const volumeClaimTemplates = k8sObject?.spec?.volumeClaimTemplates;
      if (!volumeClaimTemplates) continue;

      for (const volumeClaim of volumeClaimTemplates) {
        const pvcs = await getPersistentVolumeClaims(
          proxyURL,
          userNamespace,
          `app.kubernetes.io/name=${volumeClaim.metadata.name}`,
        );

        if (pvcs && pvcs.items.length > 0) {
          for (const pvc of pvcs.items) {
            const url = `/api/v1/namespaces/${userNamespace}/persistentvolumeclaims/${pvc.metadata.name}`;
            const response = await authFetch(`${proxyURL}${url}`, {
              method: "DELETE",
            });
            if (!response.ok && response.status !== 404) {
              throw await ApiError.fromResponse(
                "deletePVCsForSTS failed",
                response,
              );
            }
          }
        }
      }
    }
  }
}

/**
 * Fetches a secret.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to fetch the secret from.
 * @param secretName the name of the secret to fetch.
 * @throws {ApiError} if the API call fails.
 */
export async function getSecret(
  proxyURL: string,
  namespace: string,
  secretName: string,
): Promise<SecretItem | undefined> {
  const url = `/api/v1/namespaces/${namespace}/secrets/${secretName}`;
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse("getSecret failed", response);
  }
  return response.json();
}

/**
 * Fetches the persistence volume claims.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to fetch the persistence volume claims from.
 * @param labelSelector the label selector to apply to the query, if any.
 * @throws {ApiError} if the API call fails.
 */
export async function getPersistentVolumeClaims(
  proxyURL: string,
  namespace: string,
  labelSelector?: string,
): Promise<PersistentVolumeClaimData | undefined> {
  const url = pvcUrl(namespace, labelSelector);
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse(
      "getPersistentVolumeClaims failed",
      response,
    );
  }
  return response.json();
}

/**
 * Fetches the deployments.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to fetch the deployments from.
 * @param labelSelector the label selector to apply to the query, if any.
 * @throws {ApiError} if the API call fails.
 */
export async function getDeployments(
  proxyURL: string,
  namespace: string,
  labelSelector?: string,
): Promise<DeploymentData | undefined> {
  const url = deploymentUrl(namespace, labelSelector);
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse("getDeployments failed", response);
  }
  return response.json();
}

/**
 * Fetches the stateful sets.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to fetch the deployments from.
 * @param labelSelector the label selector to apply to the query, if any.
 * @throws {ApiError} if the API call fails.
 */
export async function getStatefulSets(
  proxyURL: string,
  namespace: string,
  labelSelector?: string,
): Promise<StatefulSetData | undefined> {
  const url = statefulSetUrl(namespace, labelSelector);
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse("getStatefulSets failed", response);
  }
  return response.json();
}
