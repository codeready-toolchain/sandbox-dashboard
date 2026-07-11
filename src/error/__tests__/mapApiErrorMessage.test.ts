import { ApiError } from "../ApiError";
import { mapApiErrorMessage, type ApiErrorRule } from "../mapApiErrorMessage";

function makeApiError(body: string): ApiError {
  return new ApiError("test error", 400, body);
}

const rules: ApiErrorRule[] = [
  { match: "code is invalid", message: "Invalid code." },
  { match: "event is full", message: "Event full." },
  { match: "too many attempts", message: "Rate limited." },
];

const fallback = "Something went wrong.";

describe("mapApiErrorMessage", () => {
  it("returns the message for the first matching rule", () => {
    const err = makeApiError("the provided code is invalid");
    expect(mapApiErrorMessage(err, rules, fallback)).toBe("Invalid code.");
  });

  it("matches rules in order (first match wins)", () => {
    const err = makeApiError("code is invalid and too many attempts were made");
    expect(mapApiErrorMessage(err, rules, fallback)).toBe("Invalid code.");
  });

  it("returns fallback when no rule matches", () => {
    const err = makeApiError("unknown error from server");
    expect(mapApiErrorMessage(err, rules, fallback)).toBe(fallback);
  });

  it("works with an empty rules array", () => {
    const err = makeApiError("some error");
    expect(mapApiErrorMessage(err, [], fallback)).toBe(fallback);
  });

  it("works with readonly rule arrays", () => {
    const readonlyRules = [
      { match: "expired", message: "Code expired." },
    ] as const;
    const err = makeApiError("the code has expired");
    expect(mapApiErrorMessage(err, readonlyRules, fallback)).toBe(
      "Code expired.",
    );
  });
});
