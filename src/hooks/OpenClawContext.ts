import { createContext, useContext } from "react";
import type { UserFacingError } from "../error/UserFacingError";
import type { AddedCredential } from "../utils/openclaw-providers";
import type { OpenClawStatus } from "../utils/openclaw-utils";

export interface OpenClawContextType {
  /** Clears the deletion error. */
  clearDeletionError: () => void;
  /** Clears the provisioning error. */
  clearProvisioningError: () => void;
  /**
   * Deletes the OpenClaw instance.
   * @throws {UserFacingError} if the scheduling of the deletion fails.
   */
  deleteInstance: () => Promise<void>;
  /**
   * Contains a user facing error with the appropriate user friendly message,
   * and the technical details to be coiped if needed.
   */
  deletionError: UserFacingError | undefined;
  openclawStatus: OpenClawStatus;
  openclawUILink: string | undefined;
  /**
   * Contains a user facing error with the appropriate user friendly message,
   * and the technical details to be copied if needed.
   */
  provisioningError: UserFacingError | undefined;

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

  /**
   * Unidles the instance.
   * @throws {UserFacingError} if the unidling process could not be
   * started.
   */
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
