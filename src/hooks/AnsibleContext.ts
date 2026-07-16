import { createContext, useContext } from "react";
import type { AAPInstanceStatus } from "../utils/aap-utils";
import type { AAPInstanceCredentials } from "../types";

export interface AnsibleContextType {
  /**
   * Delete the instance.
   */
  deleteInstance: () => Promise<void>;
  /**
   * Fetches the user instance's credentials.
   */
  fetchInstanceCredentials: () => Promise<AAPInstanceCredentials>;
  /**
   * Provisions or reprovisions the instance.
   */
  handleAAPInstance: () => Promise<void>;
  /**
   * Current status of the instance.
   */
  instanceStatus: AAPInstanceStatus;
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
