import { withRetry } from "../retry";
import { ApiError } from "../../error/ApiError";

describe("withRetry", () => {
  it("returns the result on first success", async () => {
    const result = await withRetry(() => Promise.resolve("ok"), 3, 0);
    expect(result).toBe("ok");
  });

  it("retries transient errors up to the attempt limit", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error("transient"));
      return Promise.resolve("recovered");
    };

    const result = await withRetry(fn, 3, 0);
    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("rethrows the last error when all attempts are exhausted", async () => {
    const fn = () => Promise.reject(new Error("always fails"));

    await expect(withRetry(fn, 2, 0)).rejects.toThrow("always fails");
  });

  it("rethrows 4xx ApiError immediately without retrying", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new ApiError("not found", 404));
    };

    await expect(withRetry(fn, 3, 0)).rejects.toThrow(ApiError);
    expect(calls).toBe(1);
  });

  it("retries 408 ApiError (Request Timeout)", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(new ApiError("timeout", 408));
      return Promise.resolve("ok");
    };

    const result = await withRetry(fn, 3, 0);
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("retries 429 ApiError (Too Many Requests)", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(new ApiError("rate limited", 429));
      return Promise.resolve("ok");
    };

    const result = await withRetry(fn, 3, 0);
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("retries 5xx ApiError", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 2) return Promise.reject(new ApiError("server error", 502));
      return Promise.resolve("ok");
    };

    const result = await withRetry(fn, 3, 0);
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("uses a custom shouldRetry predicate when provided", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error("custom"));
    };

    await expect(withRetry(fn, 5, 0, () => false)).rejects.toThrow("custom");
    expect(calls).toBe(1);
  });
});
