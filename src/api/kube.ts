import type {
  DeploymentData,
  PersistentVolumeClaimData,
  SecretItem,
  StatefulSetData,
} from "../types";
import { errorMessage } from "../utils/common";
import { authFetch } from "./authFetch";

function pvcUrl(namespace: string, labelSelector?: string): string {
  let url = `/api/v1/namespaces/${namespace}/persistentvolumeclaims`;
  if (labelSelector) {
    url += `?labelSelector=${labelSelector}`;
  }
  return url;
}

function deploymentUrl(namespace: string, labelSelector?: string): string {
  let url = `/apis/apps/v1/namespaces/${namespace}/deployments`;
  if (labelSelector) {
    url += `?labelSelector=${labelSelector}`;
  }
  return url;
}

function statefulSetUrl(namespace: string, labelSelector?: string): string {
  let url = `/apis/apps/v1/namespaces/${namespace}/statefulsets`;
  if (labelSelector) {
    url += `?labelSelector=${labelSelector}`;
  }
  return url;
}

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
            const error = await response.json();
            throw new Error(errorMessage(error));
          }
        }

        if (volume.secret?.secretName) {
          const url = `/api/v1/namespaces/${userNamespace}/secrets/${volume.secret.secretName}`;
          const response = await authFetch(`${proxyURL}${url}`, {
            method: "DELETE",
          });
          if (!response.ok && response.status !== 404) {
            const error = await response.json();
            throw new Error(errorMessage(error));
          }
        }
      }
    }
  }
}

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
          `app.kubernetes.io%2Fname%3D${volumeClaim.metadata.name}`,
        );

        if (pvcs && pvcs.items.length > 0) {
          for (const pvc of pvcs.items) {
            const url = `/api/v1/namespaces/${userNamespace}/persistentvolumeclaims/${pvc.metadata.name}`;
            const response = await authFetch(`${proxyURL}${url}`, {
              method: "DELETE",
            });
            if (!response.ok && response.status !== 404) {
              const error = await response.json();
              throw new Error(errorMessage(error));
            }
          }
        }
      }
    }
  }
}

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
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
  return response.json();
}

export async function getPersistentVolumeClaims(
  proxyURL: string,
  namespace: string,
  labels?: string,
): Promise<PersistentVolumeClaimData | undefined> {
  const url = pvcUrl(namespace, labels);
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
  return response.json();
}

export async function getDeployments(
  proxyURL: string,
  namespace: string,
  labels?: string,
): Promise<DeploymentData | undefined> {
  const url = deploymentUrl(namespace, labels);
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
  return response.json();
}

export async function getStatefulSets(
  proxyURL: string,
  namespace: string,
  labels?: string,
): Promise<StatefulSetData | undefined> {
  const url = statefulSetUrl(namespace, labels);
  const response = await authFetch(`${proxyURL}${url}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
  return response.json();
}
