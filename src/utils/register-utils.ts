import { UserSignupPhase } from "../hooks/UserContext";
import type { User } from "../types";

export const mapUserStatusToSignupPhase = (
  currentPhase: UserSignupPhase,
  userSignupData?: User,
): UserSignupPhase => {
  if (!userSignupData) {
    if (currentPhase === UserSignupPhase.SIGNING_UP) {
      return UserSignupPhase.SIGNING_UP;
    } else {
      return UserSignupPhase.NOT_STARTED;
    }
  }

  if (userSignupData.status.ready) {
    return UserSignupPhase.READY;
  }

  if (
    !userSignupData.status.ready &&
    userSignupData.status.verificationRequired
  ) {
    return UserSignupPhase.PENDING_PHONE_VERIFICATION;
  }

  if (
    !userSignupData.status.ready &&
    userSignupData.status.reason === "Provisioning"
  ) {
    return UserSignupPhase.PROVISIONING;
  }

  return UserSignupPhase.PENDING_MANUAL_APPROVAL;
};
