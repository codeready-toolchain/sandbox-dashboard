import { createContext, useContext } from "react";
import {
  type AAPData,
  type OpenClawItem,
  type SignupData,
  UserStatus,
} from "../types";
import type { AnsibleStatus } from "../utils/aap-utils";
import type { OpenClawStatus } from "../utils/openclaw-utils";
import type { AddedCredential } from "../utils/openclaw-providers";

export interface SandboxContextType {
  userStatus: UserStatus;
  userFound: boolean;
  userReady: boolean;
  verificationRequired: boolean;
  pendingApproval: boolean;
  userData: SignupData | undefined;
  loading: boolean;
  refetchUserData: () => Promise<SignupData | undefined>;
  signupUser: () => void;
  refetchAAP: (userNamespace: string) => void;
  handleAAPInstance: (userNamespace: string) => void;
  ansibleData: AAPData | undefined;
  ansibleUIUser: string | undefined;
  ansibleUIPassword: string;
  ansibleUILink: string | undefined;
  /**
   * Contains the raw condition message for when the provisioning the AAP
   * instance fails.
   */
  ansibleProvisioningErrorDetails: string | null;
  ansibleStatus: AnsibleStatus;
  openclawData: OpenClawItem | undefined;
  /**
   * Contains the raw error message when deleting the OPenClaw instance fails.
   */
  openClawDeletionErrorDetails: string | null;
  /**
   * Resets the OpenClaw deletion error details.
   */
  resetOpenClawDeletionErrorDetails: () => void;
  /**
   * Contains the raw error message when provisioning the OpenClaw instance
   * fails.
   */
  openClawProvisioningErrorDetails: string | null;
  /** Resets the OpenClaw provisioning error details. */
  resetOpenClawProvisioningErrorDetails: () => void;
  openclawStatus: OpenClawStatus;
  openclawUILink: string | undefined;
  /** Resets the AAP provisioning error details. */
  resetAnsibleProvisioningErrorDetails: () => void;
  handleOpenClawInstance: (
    userNamespace: string,
    credentials?: AddedCredential[],
    disableDevicePairing?: boolean,
  ) => Promise<boolean>;
  deleteOpenClaw: (userNamespace: string) => Promise<void>;
  segmentTrackClick?: (data: Record<string, unknown>) => Promise<void>;
  marketoWebhookURL?: string;
  disabledIntegrations?: string[];
}

export const SandboxContext = createContext<SandboxContextType | undefined>(
  undefined,
);

export const useSandboxContext = (): SandboxContextType => {
  const context = useContext(SandboxContext);
  if (!context) {
    throw new Error("Context useSandboxContext is not defined");
  }
  return context;
};
