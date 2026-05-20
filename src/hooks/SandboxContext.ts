import { createContext, useContext } from "react";
import type { AAPData, SignupData } from "../types";
import type { AnsibleStatus } from "../utils/aap-utils";

export interface SandboxContextType {
  userStatus: string;
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
  ansibleError: string | null;
  ansibleStatus: AnsibleStatus;
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
