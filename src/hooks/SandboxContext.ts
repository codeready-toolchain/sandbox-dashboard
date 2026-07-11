import { createContext, useContext } from "react";
import { type SignupData, UserStatus } from "../types";

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
