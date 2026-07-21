import { AggregatedOperationError } from "../AggregatedOperationError";
import { ApiError } from "../ApiError";

describe("AggregatedOperationError", () => {
  it("stores the product name and failures", () => {
    const error = new AggregatedOperationError("OpenClaw", [
      { operation: "Delete CR", detail: "500 Internal Server Error" },
    ]);

    expect(error.productName).toBe("OpenClaw");
    expect(error.failures).toHaveLength(1);
    expect(error.failures[0].operation).toBe("Delete CR");
    expect(error.name).toBe("AggregatedOperationError");
  });

  it("is an instance of Error", () => {
    const error = new AggregatedOperationError("AAP", []);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AggregatedOperationError);
  });

  it("includes the product name and failure count in the message", () => {
    const error = new AggregatedOperationError("OpenClaw", [
      { operation: "op1", detail: "d1" },
      { operation: "op2", detail: "d2" },
    ]);
    expect(error.message).toBe("An operation of OpenClaw had 2 failure(s)");
  });

  describe("toString", () => {
    it("formats failures with numbered indices", () => {
      const error = new AggregatedOperationError("OpenClaw", [
        { operation: "Delete CR", detail: "404 Not Found" },
        { operation: "Delete SpaceRequest", detail: "timeout" },
      ]);

      const result = error.toString();
      expect(result).toContain("OpenClaw");
      expect(result).toContain("[1]: Delete CR: 404 Not Found");
      expect(result).toContain("[2]: Delete SpaceRequest: timeout");
    });

    it("returns only the product name for an empty failures array", () => {
      const error = new AggregatedOperationError("AAP", []);
      expect(error.toString()).toBe("AAP\n\n");
    });
  });

  describe("fromSettledResults", () => {
    it("returns undefined when all results are fulfilled", () => {
      const results: PromiseSettledResult<void>[] = [
        { status: "fulfilled", value: undefined },
        { status: "fulfilled", value: undefined },
      ];

      const error = AggregatedOperationError.fromSettledResults(
        "OpenClaw",
        ["op1", "op2"],
        results,
      );
      expect(error).toBeUndefined();
    });

    it("creates an error from rejected results", () => {
      const results: PromiseSettledResult<void>[] = [
        { status: "fulfilled", value: undefined },
        { status: "rejected", reason: new Error("something broke") },
      ];

      const error = AggregatedOperationError.fromSettledResults(
        "OpenClaw",
        ["Delete CR", "Delete SpaceRequest"],
        results,
      );

      expect(error).toBeDefined();
      expect(error!.failures).toHaveLength(1);
      expect(error!.failures[0].operation).toBe("Delete SpaceRequest");
      expect(error!.failures[0].detail).toContain("something broke");
    });

    it("extracts statusCode and body from ApiError rejections", () => {
      const results: PromiseSettledResult<void>[] = [
        {
          status: "rejected",
          reason: new ApiError("api error", 403, "Forbidden"),
        },
      ];

      const error = AggregatedOperationError.fromSettledResults(
        "OpenClaw",
        ["Cleanup workspace"],
        results,
      );

      expect(error).toBeDefined();
      expect(error!.failures[0].detail).toBe("403 Forbidden");
    });

    it("handles multiple rejected results", () => {
      const results: PromiseSettledResult<void>[] = [
        { status: "rejected", reason: new Error("err1") },
        { status: "fulfilled", value: undefined },
        { status: "rejected", reason: new Error("err2") },
      ];

      const error = AggregatedOperationError.fromSettledResults(
        "AAP",
        ["op1", "op2", "op3"],
        results,
      );

      expect(error).toBeDefined();
      expect(error!.failures).toHaveLength(2);
      expect(error!.failures[0].operation).toBe("op1");
      expect(error!.failures[1].operation).toBe("op3");
    });
  });
});
