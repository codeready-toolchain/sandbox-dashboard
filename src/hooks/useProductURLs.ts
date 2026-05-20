import { useMemo } from "react";
import { useSandboxContext } from "./SandboxContext";
import type { SignupData } from "../types";

export enum Product {
  OPENSHIFT_CONSOLE = "openshift-console",
  OPENSHIFT_AI = "red-hat-data-science",
  DEVSPACES = "devspaces",
  AAP = "ansible-automation-platform",
  OPENSHIFT_VIRT = "openshift-virtualization",
}

export enum Intcmp {
  OPENSHIFT_CONSOLE = "701Pe00000dnCEYIA2",
  DEVSPACES = "701Pe00000doTQCIA2",
  RHODS = "701Pe00000do2uiIAA",
  OPENSHIFT_VIRT = "701Pe00000dov6IIAQ",
  AAP = "701Pe00000dowQXIAY",
}

interface ProductURL {
  id: Product;
  url: string;
}

enum AppURL {
  DEVSPACES = "devspaces",
}

const getAppsURL = (
  appRouteName: AppURL,
  consoleURL: string | undefined,
): string => {
  if (!consoleURL) {
    return "";
  }
  const index = consoleURL.indexOf(".apps");
  if (index === -1) {
    return "";
  }
  const appsURL = consoleURL.substring(index);
  return `https://${appRouteName}${appsURL}`;
};

export const productsURLMapping = (
  userData: SignupData | undefined,
): ProductURL[] => {
  const isProvisioned = userData?.status?.ready || false;
  return [
    {
      id: Product.OPENSHIFT_CONSOLE,
      url:
        isProvisioned && userData?.defaultUserNamespace
          ? `${userData?.consoleURL}/k8s/cluster/projects/${userData?.defaultUserNamespace}`
          : "",
    },
    {
      id: Product.OPENSHIFT_AI,
      url: isProvisioned ? `${userData?.rhodsMemberURL}` : "",
    },
    {
      id: Product.DEVSPACES,
      url: isProvisioned
        ? `${userData?.cheDashboardURL}` ||
          getAppsURL(AppURL.DEVSPACES, userData?.consoleURL)
        : "",
    },
    { id: Product.AAP, url: "" },
    {
      id: Product.OPENSHIFT_VIRT,
      url: isProvisioned
        ? `${userData?.consoleURL}/k8s/ns/${userData?.defaultUserNamespace}/virtualization-overview`
        : "",
    },
  ];
};

const useProductURLs = (): ProductURL[] => {
  const { userData } = useSandboxContext();
  return useMemo(() => productsURLMapping(userData), [userData]);
};

export default useProductURLs;
