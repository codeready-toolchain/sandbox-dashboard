import {
  getPhoneStepValidationError,
  isValidCountryCode,
  isValidOTP,
  isValidPhoneNumber,
} from "../phone-utils";

describe("phone-utils", () => {
  describe("isValidCountryCode", () => {
    it("should return true for valid country codes", () => {
      expect(isValidCountryCode("+1")).toBe(true);
      expect(isValidCountryCode("91")).toBe(true);
      expect(isValidCountryCode("+44")).toBe(true);
      expect(isValidCountryCode("86")).toBe(true);
    });

    it("should return false for invalid country codes", () => {
      expect(isValidCountryCode("+")).toBe(false);
      expect(isValidCountryCode("abc")).toBe(false);
      expect(isValidCountryCode("+ab")).toBe(false);
      expect(isValidCountryCode("++1")).toBe(false);
      expect(isValidCountryCode("")).toBe(false);
    });
  });

  describe("isValidPhoneNumber", () => {
    it("should return true for valid phone numbers", () => {
      expect(isValidPhoneNumber("1234567890")).toBe(true);
      expect(isValidPhoneNumber("(123) 456-7890")).toBe(true);
      expect(isValidPhoneNumber("123-456-7890")).toBe(true);
      expect(isValidPhoneNumber("123.456.7890")).toBe(true);
      expect(isValidPhoneNumber("123 456 7890")).toBe(true);
    });

    it("should return false for invalid phone numbers", () => {
      expect(isValidPhoneNumber("abc")).toBe(false);
      expect(isValidPhoneNumber("123-abc-7890")).toBe(false);
      expect(isValidPhoneNumber("")).toBe(false);
      expect(isValidPhoneNumber("++1234567890")).toBe(false);
    });
  });

  describe("isValidOTP", () => {
    it("should return true for valid OTP strings", () => {
      expect(isValidOTP("123456")).toBe(true);
      expect(isValidOTP("ABCDEF")).toBe(true);
      expect(isValidOTP("abc123")).toBe(true);
      expect(isValidOTP("")).toBe(true);
    });

    it("should return false for invalid OTP strings", () => {
      expect(isValidOTP("123-456")).toBe(false);
      expect(isValidOTP("ABC DEF")).toBe(false);
      expect(isValidOTP("abc@123")).toBe(false);
      expect(isValidOTP("#special")).toBe(false);
    });
  });

  describe("getPhoneStepValidationError", () => {
    it("should prefer the country code error when both are invalid", () => {
      expect(getPhoneStepValidationError("", "")).toBe(
        "Please enter a valid country code.",
      );
    });

    it("should return the phone number error when the country code is valid", () => {
      expect(getPhoneStepValidationError("+1", "")).toBe(
        "Please enter a valid phone number.",
      );
    });

    it("should return null when both fields are valid", () => {
      expect(getPhoneStepValidationError("+1", "5551234567")).toBeNull();
    });
  });
});
