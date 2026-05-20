import type { AAPData } from "../types";
import { AAPObject } from "../utils/aap-utils";
import { errorMessage } from "../utils/common";
import { authFetch } from "./authFetch";

const aapBasePath = (namespace: string) =>
  `/apis/aap.ansible.com/v1alpha1/namespaces/${namespace}/ansibleautomationplatforms`;

export async function getAAP(
  proxyURL: string,
  namespace: string,
): Promise<AAPData | undefined> {
  const response = await authFetch(`${proxyURL}${aapBasePath(namespace)}`, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
  return response.json();
}

export async function createAAP(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const response = await authFetch(`${proxyURL}${aapBasePath(namespace)}`, {
    method: "POST",
    body: AAPObject,
    headers: {
      "Content-Type": "application/yaml",
    },
  });

  if (!response.ok && response.status !== 409) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
}

export async function unIdleAAP(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const response = await authFetch(
    `${proxyURL}${aapBasePath(namespace)}/sandbox-aap`,
    {
      method: "PATCH",
      body: JSON.stringify({
        spec: {
          idle_aap: false,
        },
      }),
      headers: {
        "Content-Type": "application/merge-patch+json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
}

export async function deleteAAPCR(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const response = await authFetch(
    `${proxyURL}${aapBasePath(namespace)}/sandbox-aap`,
    { method: "DELETE" },
  );

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(errorMessage(error));
  }
}
