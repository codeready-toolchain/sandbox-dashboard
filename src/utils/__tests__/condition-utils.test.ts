import type { StatusCondition } from "../../types";
import { anyConditionMatches } from "../condition-utils";

const makeCondition = (
  type: string,
  status: string,
  reason = "",
  message = "",
): StatusCondition => ({
  type,
  status,
  reason,
  message,
});

describe("condition-utils", () => {
  describe("anyConditionMatches", () => {
    it("returns the matching condition when both type and status match", () => {
      const conditions = [makeCondition("Successful", "True", "Done")];
      const result = anyConditionMatches("Successful", "True", conditions);
      expect(result).toEqual(conditions[0]);
    });

    it("does not match when only status matches but type differs", () => {
      const conditions = [makeCondition("Other", "True")];
      const result = anyConditionMatches("Successful", "True", conditions);
      expect(result).toBeUndefined();
    });

    it("does not match when only type matches but status differs", () => {
      const conditions = [makeCondition("Successful", "False")];
      const result = anyConditionMatches("Successful", "True", conditions);
      expect(result).toBeUndefined();
    });

    it("returns the matching condition when type, status, and reason all match", () => {
      const conditions = [makeCondition("Failure", "True", "SpecificReason")];
      const result = anyConditionMatches(
        "Failure",
        "True",
        conditions,
        "SpecificReason",
      );
      expect(result).toEqual(conditions[0]);
    });

    it("does not match when type and status match but reason differs", () => {
      const conditions = [makeCondition("Failure", "True", "OtherReason")];
      const result = anyConditionMatches(
        "Failure",
        "True",
        conditions,
        "SpecificReason",
      );
      expect(result).toBeUndefined();
    });

    it("matches on type and status when conditionReason is not provided, regardless of condition reason", () => {
      const conditions = [makeCondition("Successful", "True", "AnyReason")];
      const result = anyConditionMatches("Successful", "True", conditions);
      expect(result).toEqual(conditions[0]);
    });

    it("returns undefined when no conditions match", () => {
      const conditions = [makeCondition("Other", "False", "Nope")];
      const result = anyConditionMatches("Successful", "True", conditions);
      expect(result).toBeUndefined();
    });

    it("returns undefined for empty conditions array", () => {
      const result = anyConditionMatches("Successful", "True", []);
      expect(result).toBeUndefined();
    });

    it("returns the first matching condition when multiple match", () => {
      const conditions = [
        makeCondition("Successful", "True", "First"),
        makeCondition("Successful", "True", "Second"),
      ];
      const result = anyConditionMatches("Successful", "True", conditions);
      expect(result?.reason).toBe("First");
    });

    it("does not match on reason alone when type and status differ", () => {
      const conditions = [makeCondition("Other", "False", "SpecificReason")];
      const result = anyConditionMatches("Unrelated", "Unrelated", conditions);
      expect(result).toBeUndefined();
    });
  });
});
