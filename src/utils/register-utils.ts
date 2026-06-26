import { UserStatus } from "../types";
import type { SignupData } from "../types";

export const signupDataToStatus = (signupData?: SignupData): UserStatus => {
  if (!signupData) {
    return UserStatus.NEW;
  }
  if (signupData.status.ready) {
    return UserStatus.READY;
  }
  if (!signupData.status.ready && signupData.status.verificationRequired) {
    return UserStatus.VERIFY;
  }
  if (!signupData.status.ready && signupData.status.reason === "Provisioning") {
    return UserStatus.PROVISIONING;
  }
  return UserStatus.PENDING_APPROVAL;
};
