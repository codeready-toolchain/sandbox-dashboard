import { UserSignupPhase } from "../../hooks/UserContext";
import type { User } from "../../types";
import { mapUserStatusToSignupPhase } from "../register-utils";

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
});
