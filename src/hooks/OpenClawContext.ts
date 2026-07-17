import { createContext, useContext } from "react";
import { type OpenClawItem } from "../types";
import type { AddedCredential } from "../utils/openclaw-providers";
import type { OpenClawStatus } from "../utils/openclaw-utils";

export interface OpenClawContextType {
  deleteOpenClaw: () => Promise<void>;
  handleOpenClawInstance: (
    credentials?: AddedCredential[],
    disableDevicePairing?: boolean,
  ) => Promise<boolean>;
  openclawData: OpenClawItem | undefined;
  /**
   * Contains the raw error message when deleting the OpenClaw instance fails.
   */
  openClawDeletionErrorDetails: string | null;
  /**
   * Contains the raw error message when provisioning the OpenClaw instance
   * fails.
   */
  openClawProvisioningErrorDetails: string | null;
  openclawStatus: OpenClawStatus;
  openclawUILink: string | undefined;
  /** Resets the OpenClaw deletion error details. */
  resetOpenClawDeletionErrorDetails: () => void;
  /** Resets the OpenClaw provisioning error details. */
  resetOpenClawProvisioningErrorDetails: () => void;
}

export const OpenClawContext = createContext<OpenClawContextType | undefined>(
  undefined,
);

export const useOpenClawContext = (): OpenClawContextType => {
  const context = useContext(OpenClawContext);
  if (!context) {
    throw new Error("Context useOpenClawContext is not defined");
  }
  return context;
};
