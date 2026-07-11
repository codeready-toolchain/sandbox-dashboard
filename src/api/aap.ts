import { ApiError } from "../error/ApiError";
import type { AAPData } from "../types";
import { AAPObject } from "../utils/aap-utils";
import { authFetch } from "./authFetch";

const aapBasePath = (namespace: string) =>
  `/apis/aap.ansible.com/v1alpha1/namespaces/${namespace}/ansibleautomationplatforms`;

/**
 * Fetches an Ansible Automation Platform custom resource.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to fetch the resource from.
 * @returns the Ansible Automation Platform custom resource.
 * @throws {ApiError} if the API call fails.
 */
export async function getAAP(
  proxyURL: string,
  namespace: string,
): Promise<AAPData | undefined> {
  const response = await authFetch(`${proxyURL}${aapBasePath(namespace)}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse("getAAP failed", response);
  }

  return response.json();
}

/**
 * Creates an Ansible Automation Platform custom resource.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to create the resource in.
 * @throws {ApiError} if the API call fails.
 */
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
    throw await ApiError.fromResponse("createAAP failed", response);
  }
}

/**
 * Sets the "idle" status of the Ansible Automation Platform as "false".
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to update the resource in.
 * @throws {ApiError} if the API call fails.
 */
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
    throw await ApiError.fromResponse("unIdleAAP failed", response);
  }
}

/**
 * Deletes the Ansible Automation Platform custom resource.
 * @param proxyURL the URL of the proxy to send the request to.
 * @param namespace the namespace to delete the resource from.
 * @throws {ApiError} if the API call fails.
 */
export async function deleteAAPCR(
  proxyURL: string,
  namespace: string,
): Promise<void> {
  const response = await authFetch(
    `${proxyURL}${aapBasePath(namespace)}/sandbox-aap`,
    { method: "DELETE" },
  );

  if (!response.ok && response.status !== 404) {
    throw await ApiError.fromResponse("deleteAAPCR failed", response);
  }
}
