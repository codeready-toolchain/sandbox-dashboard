import { createContext, useContext } from "react";
import { type AAPData } from "../types";
import type { AnsibleStatus } from "../utils/aap-utils";

export interface AnsibleContextType {
  ansibleData: AAPData | undefined;
  /**
   * Contains the raw condition message for when the provisioning the AAP
   * instance fails.
   */
  ansibleProvisioningErrorDetails: string | null;
  ansibleStatus: AnsibleStatus;
  ansibleUILink: string | undefined;
  ansibleUIPassword: string;
  ansibleUIUser: string | undefined;
  handleAAPInstance: (userNamespace: string) => void;
  refetchAAP: (userNamespace: string) => void;
  resetAnsibleProvisioningErrorDetails: () => void;
}

export const AnsibleContext = createContext<AnsibleContextType | undefined>(
  undefined,
);

export const useAnsibleContext = (): AnsibleContextType => {
  const context = useContext(AnsibleContext);
  if (!context) {
    throw new Error("Context useAnsibleContext is not defined");
  }
  return context;
};
