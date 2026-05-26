import { signupDataToStatus } from "../register-utils";
import { UserStatus } from "../../types";
import type { SignupData } from "../../types";

describe("register-utils", () => {
  describe("signupDataToStatus", () => {
    it("should return UserStatus.NEW when signupData is undefined", () => {
      expect(signupDataToStatus(undefined)).toBe(UserStatus.NEW);
    });

    it("should return UserStatus.READY when status.ready is true", () => {
      const signupData: SignupData = {
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
      expect(signupDataToStatus(signupData)).toBe(UserStatus.READY);
    });

    it("should return UserStatus.VERIFY when not ready and verification is required", () => {
      const signupData: SignupData = {
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
      expect(signupDataToStatus(signupData)).toBe(UserStatus.VERIFY);
    });

    it("should return UserStatus.PROVISIONING when not ready and reason is Provisioning", () => {
      const signupData: SignupData = {
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
      expect(signupDataToStatus(signupData)).toBe(UserStatus.PROVISIONING);
    });

    it("should return UserStatus.PENDING_APPROVAL for unknown states", () => {
      const signupData: SignupData = {
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
      expect(signupDataToStatus(signupData)).toBe(UserStatus.PENDING_APPROVAL);
    });
  });
});
