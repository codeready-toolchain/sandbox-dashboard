import { signupDataToStatus } from "../register-utils";
import type { SignupData } from "../../types";

describe("register-utils", () => {
  describe("signupDataToStatus", () => {
    it('should return "new" when signupData is undefined', () => {
      expect(signupDataToStatus(undefined)).toBe("new");
    });

    it('should return "ready" when status.ready is true', () => {
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
      expect(signupDataToStatus(signupData)).toBe("ready");
    });

    it('should return "verify" when not ready and verification is required', () => {
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
      expect(signupDataToStatus(signupData)).toBe("verify");
    });

    it('should return "provisioning" when not ready and reason is Provisioning', () => {
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
      expect(signupDataToStatus(signupData)).toBe("provisioning");
    });

    it('should return "pending-approval" for unknown states', () => {
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
      expect(signupDataToStatus(signupData)).toBe("pending-approval");
    });
  });
});
