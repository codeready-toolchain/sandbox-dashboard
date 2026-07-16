import { ErrorSeverity, UserFacingError } from "../UserFacingError";

describe("UserFacingError", () => {
  it("creates an error with required fields", () => {
    const error = new UserFacingError("Title", "Detail message");

    expect(error.title).toBe("Title");
    expect(error.detail).toBe("Detail message");
    expect(error.message).toBe("Title");
    expect(error.name).toBe("UserFacingError");
  });

  it("is an instance of Error", () => {
    const error = new UserFacingError("Title", "Detail");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UserFacingError);
  });

  it("defaults severity to ERROR when not provided", () => {
    const error = new UserFacingError("Title", "Detail");
    expect(error.severity).toBe(ErrorSeverity.ERROR);
  });

  it("accepts a custom severity", () => {
    const error = new UserFacingError(
      "Title",
      "Detail",
      undefined,
      undefined,
      ErrorSeverity.WARNING,
    );
    expect(error.severity).toBe(ErrorSeverity.WARNING);
  });

  it("stores technical details", () => {
    const error = new UserFacingError(
      "Title",
      "Detail",
      undefined,
      "Internal stack trace info",
    );
    expect(error.technicalDetails).toBe("Internal stack trace info");
  });

  it("leaves technicalDetails undefined when not provided", () => {
    const error = new UserFacingError("Title", "Detail");
    expect(error.technicalDetails).toBeUndefined();
  });

  it("stores the cause via Error's cause option", () => {
    const cause = new Error("root cause");
    const error = new UserFacingError("Title", "Detail", cause);
    expect(error.cause).toBe(cause);
  });

  it("has undefined cause when not provided", () => {
    const error = new UserFacingError("Title", "Detail");
    expect(error.cause).toBeUndefined();
  });
});

describe("ErrorSeverity", () => {
  it("has the expected values", () => {
    expect(ErrorSeverity.ERROR).toBe("error");
    expect(ErrorSeverity.WARNING).toBe("warning");
  });
});
