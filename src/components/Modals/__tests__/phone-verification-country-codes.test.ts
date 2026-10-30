import {
  normalizeDialCodeInput,
  resolveCountryCodeEntry,
} from "../phone-verification-country-codes";

describe("phone-verification-country-codes", () => {
  describe("normalizeDialCodeInput", () => {
    it("adds a leading plus to bare digit codes", () => {
      expect(normalizeDialCodeInput("34")).toBe("+34");
      expect(normalizeDialCodeInput(" 1 ")).toBe("+1");
    });

    it("keeps codes that already include a plus", () => {
      expect(normalizeDialCodeInput("+34")).toBe("+34");
    });

    it("trims non-numeric text without changing it", () => {
      expect(normalizeDialCodeInput(" Spain ")).toBe("Spain");
    });
  });

  describe("resolveCountryCodeEntry", () => {
    it("resolves a unique dial code with or without a plus", () => {
      expect(resolveCountryCodeEntry("+34")).toEqual({
        name: "Spain",
        code: "+34",
      });
      expect(resolveCountryCodeEntry("34")).toEqual({
        name: "Spain",
        code: "+34",
      });
    });

    it("prefers a primary country for shared dial codes", () => {
      expect(resolveCountryCodeEntry("+1")).toEqual({
        name: "United States",
        code: "+1",
      });
      expect(resolveCountryCodeEntry("+44")).toEqual({
        name: "United Kingdom",
        code: "+44",
      });
    });

    it("returns undefined for unknown or partial input", () => {
      expect(resolveCountryCodeEntry("")).toBeUndefined();
      expect(resolveCountryCodeEntry("Spain")).toBeUndefined();
      expect(resolveCountryCodeEntry("+9999")).toBeUndefined();
      expect(resolveCountryCodeEntry("+3")).toBeUndefined();
    });
  });
});
