import { createContext, useContext } from "react";
import type { UserFacingError } from "../error/UserFacingError";
import type { AddedCredential } from "../utils/openclaw-providers";
import type { OpenClawStatus } from "../utils/openclaw-utils";

export interface OpenClawContextType {
  deleteOpenClaw: () => Promise<void>;
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
  /**
   * Contains a user facing error with the appropriate user friendly message,
   * and the technical details to be copied if needed.
   */
  provisioningError: UserFacingError | undefined;
  /** Resets the OpenClaw deletion error details. */
  resetOpenClawDeletionErrorDetails: () => void;
  /** Resets the OpenClaw provisioning error details. */
  resetOpenClawProvisioningErrorDetails: () => void;
  /**
   * Starts the provisioning flow for the instance.
   * @param credentials The credentials to be created along the instance.
   * @param isDevicePairingDisabled whether the device pairing mechanism is
   * disabled or not.
   * @throws {UserFacingError} if the provisioning process could not be
   * started.
   **/
  startProvisioning: (
    credentials: AddedCredential[],
    isDevicePairingDisabled?: boolean,
  ) => Promise<void>;
  unidleInstance: () => Promise<void>;
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
