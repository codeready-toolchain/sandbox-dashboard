import type { Status, SignupData } from "../types";

export const signupDataToStatus = (signupData?: SignupData): Status => {
  if (!signupData) {
    return "new";
  }
  if (signupData.status.ready) {
    return "ready";
  }
  if (!signupData.status.ready && signupData.status.verificationRequired) {
    return "verify";
  }
  if (!signupData.status.ready && signupData.status.reason === "Provisioning") {
    return "provisioning";
  }
  return "pending-approval";
};
