import { SUPPORT_EMAIL } from "../const";
import { ApiError } from "../error/ApiError";
import { UserFacingError } from "../error/UserFacingError";
import { UserSignupPhase } from "../hooks/userSignupPhase";
import type { User } from "../types";
import logger from "./logger";

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

export const mapFetchUserErrorToErrorMessage = (
  error: unknown,
): UserFacingError => {
  let title: string = "Unable to sign you up into Developer Sandbox";
  let message: string = `Unable to sign you up into Developer Sandbox. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`;
  let technicalDetails: string = "";
  if (error instanceof ApiError) {
    technicalDetails = error.body;

    switch (true) {
      case error.body.includes("invalid code"): {
        title = "Invalid activation code";
        message = "The provided activation code is invalid";

        logger.error(
          "The activation code that the user provided is invalid",
          error,
        );
        break;
      }
      case error.body.includes("has been suspended"):
        title = "The account is suspended";
        message =
          "Access to the Developer Sandbox has been suspended due to suspicious activity or detected abuse";

        logger.error("The user's account is suspended", error);
        break;
      case error.body.includes("has been denied"):
        title = "The access has been denied";
        message = "Access to the Developer Sandbox has been denied";

        logger.error("The user's access has been denied", error);
        break;
      case error.body.includes("failed to create usersignup for"):
        title = "CRT admin restriction";
        message = "A CRT admin is not allowed to sign up";

        logger.error(
          "The user is already a CRT admin and cannot sign up again",
          error,
        );
        break;
      case error.body.includes(
        "there is already an active UserSignup with such a username",
      ):
        title = "Already existing account";
        message =
          "An account is already signed up to Developer Sandbox with your username";

        logger.error("The user already has an existing account", error);
        break;
      default:
        break;
    }
  } else if (error instanceof Error) {
    technicalDetails = error.message;
  }

  return new UserFacingError(title, message, error, technicalDetails);
};
