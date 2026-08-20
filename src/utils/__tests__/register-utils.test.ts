import { ApiError } from "../../error/ApiError";
import { UserFacingError } from "../../error/UserFacingError";
import { UserSignupPhase } from "../../hooks/userSignupPhase";
import type { User } from "../../types";
import {
  mapFetchUserErrorToErrorMessage,
  mapUserStatusToSignupPhase,
} from "../register-utils";

describe("register-utils", () => {
  describe("mapUserStatusToSignupPhase", () => {
    it("should return NOT_STARTED when user data is undefined and phase is NOT_STARTED", () => {
      expect(
        mapUserStatusToSignupPhase(UserSignupPhase.NOT_STARTED, undefined),
      ).toBe(UserSignupPhase.NOT_STARTED);
    });

    it("should preserve SIGNING_UP phase when user data is undefined", () => {
      expect(
        mapUserStatusToSignupPhase(UserSignupPhase.SIGNING_UP, undefined),
      ).toBe(UserSignupPhase.SIGNING_UP);
    });

    it("should return READY when status.ready is true", () => {
      const user: User = {
        name: "Test User",
        compliantUsername: "testuser",
        username: "testuser",
        givenName: "Test",
        familyName: "User",
        company: "Test Company",
        status: {
          ready: true,
          verificationRequired: false,
          reason: "",
        },
      };
      expect(
        mapUserStatusToSignupPhase(UserSignupPhase.NOT_STARTED, user),
      ).toBe(UserSignupPhase.READY);
    });

    it("should return PENDING_PHONE_VERIFICATION when not ready and verification is required", () => {
      const user: User = {
        name: "Test User",
        compliantUsername: "testuser",
        username: "testuser",
        givenName: "Test",
        familyName: "User",
        company: "Test Company",
        status: {
          ready: false,
          verificationRequired: true,
          reason: "",
        },
      };
      expect(
        mapUserStatusToSignupPhase(UserSignupPhase.NOT_STARTED, user),
      ).toBe(UserSignupPhase.PENDING_PHONE_VERIFICATION);
    });

    it("should return PROVISIONING when not ready and reason is Provisioning", () => {
      const user: User = {
        name: "Test User",
        compliantUsername: "testuser",
        username: "testuser",
        givenName: "Test",
        familyName: "User",
        company: "Test Company",
        status: {
          ready: false,
          verificationRequired: false,
          reason: "Provisioning",
        },
      };
      expect(
        mapUserStatusToSignupPhase(UserSignupPhase.NOT_STARTED, user),
      ).toBe(UserSignupPhase.PROVISIONING);
    });

    it("should return PENDING_MANUAL_APPROVAL for unknown states", () => {
      const user: User = {
        name: "Test User",
        compliantUsername: "testuser",
        username: "testuser",
        givenName: "Test",
        familyName: "User",
        company: "Test Company",
        status: {
          ready: false,
          verificationRequired: false,
          reason: "SomeOtherReason",
        },
      };
      expect(
        mapUserStatusToSignupPhase(UserSignupPhase.NOT_STARTED, user),
      ).toBe(UserSignupPhase.PENDING_MANUAL_APPROVAL);
    });
  });

  describe("mapFetchUserErrorToErrorMessage", () => {
    it("returns a UserFacingError instance", () => {
      const result = mapFetchUserErrorToErrorMessage(new Error("something"));
      expect(result).toBeInstanceOf(UserFacingError);
    });

    it("maps 'invalid code' error to an invalid activation code message", () => {
      const err = new ApiError(
        "getSignupData failed",
        403,
        "invalid code: the code has expired",
      );
      const result = mapFetchUserErrorToErrorMessage(err);

      expect(result.title).toBe("Invalid activation code");
      expect(result.detail).toBe("The provided activation code is invalid");
      expect(result.technicalDetails).toBe(
        "invalid code: the code has expired",
      );
    });

    it("maps 'has been suspended' error to a suspended message", () => {
      const err = new ApiError(
        "getSignupData failed",
        403,
        "user has been suspended",
      );
      const result = mapFetchUserErrorToErrorMessage(err);

      expect(result.title).toBe("The account is suspended");
      expect(result.detail).toBe(
        "Access to the Developer Sandbox has been suspended due to suspicious activity or detected abuse",
      );
    });

    it("maps 'has been denied' error to a denied message", () => {
      const err = new ApiError(
        "getSignupData failed",
        403,
        "user has been denied",
      );
      const result = mapFetchUserErrorToErrorMessage(err);

      expect(result.title).toBe("The access has been denied");
      expect(result.detail).toBe(
        "Access to the Developer Sandbox has been denied",
      );
    });

    it("maps 'failed to create usersignup for' error to a CRT admin message", () => {
      const err = new ApiError(
        "getSignupData failed",
        403,
        "failed to create usersignup for user@example.com",
      );
      const result = mapFetchUserErrorToErrorMessage(err);

      expect(result.title).toBe("CRT admin restriction");
      expect(result.detail).toBe("A CRT admin is not allowed to sign up");
    });

    it("maps duplicate username error to an already existing account message", () => {
      const err = new ApiError(
        "getSignupData failed",
        409,
        "there is already an active UserSignup with such a username",
      );
      const result = mapFetchUserErrorToErrorMessage(err);

      expect(result.title).toBe("Already existing account");
      expect(result.detail).toBe(
        "An account is already signed up to Developer Sandbox with your username",
      );
    });

    it("returns the default message for an ApiError with an unknown body", () => {
      const err = new ApiError(
        "getSignupData failed",
        500,
        "unexpected server error",
      );
      const result = mapFetchUserErrorToErrorMessage(err);

      expect(result.title).toBe("Unable to sign you up into Developer Sandbox");
      expect(result.detail).toContain("Please try again later");
      expect(result.detail).toContain("devsandbox@redhat.com");
      expect(result.technicalDetails).toBe("unexpected server error");
    });

    it("uses the error message as technical details for a plain Error", () => {
      const err = new Error("Network timeout");
      const result = mapFetchUserErrorToErrorMessage(err);

      expect(result.title).toBe("Unable to sign you up into Developer Sandbox");
      expect(result.technicalDetails).toBe("Network timeout");
    });

    it("handles a non-Error value gracefully", () => {
      const result = mapFetchUserErrorToErrorMessage("string error");

      expect(result.title).toBe("Unable to sign you up into Developer Sandbox");
      expect(result.technicalDetails).toBe("");
    });
  });
});
