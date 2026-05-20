import { calculateDaysBetweenDates, errorMessage } from "../common";

describe("errorMessage", () => {
  it("should return the string directly when input is a string", () => {
    expect(errorMessage("test error message")).toBe("test error message");
  });

  it("should return message from Error object", () => {
    expect(errorMessage(new Error("test error"))).toBe("test error");
  });

  it("should return message from object with message property", () => {
    expect(errorMessage({ message: "test error from object" })).toBe(
      "test error from object",
    );
  });

  it("should return stringified object when object has no message property", () => {
    expect(errorMessage({ code: 404, details: "not found" })).toBe(
      '{"code":404,"details":"not found"}',
    );
  });

  it("should return fallback message for null input", () => {
    expect(errorMessage(null)).toBe("An unknown error occurred");
  });

  it("should return fallback message for undefined input", () => {
    expect(errorMessage(undefined)).toBe("An unknown error occurred");
  });

  it("should return fallback message for non-string message property", () => {
    expect(errorMessage({ message: 123 })).toBe('{"message":123}');
  });
});

describe("calculateDaysBetweenDates", () => {
  it("should return the expected number of days between dates", () => {
    expect(
      calculateDaysBetweenDates(new Date("2001-01-01"), new Date("2001-01-30")),
    ).toBe(30);
  });

  it("should handle same day (returns 1 since it includes both start and end date)", () => {
    expect(
      calculateDaysBetweenDates(new Date("2023-05-15"), new Date("2023-05-15")),
    ).toBe(1);
  });

  it("should handle dates spanning month boundaries", () => {
    expect(
      calculateDaysBetweenDates(new Date("2023-01-25"), new Date("2023-02-05")),
    ).toBe(12);
  });

  it("should handle dates spanning year boundaries", () => {
    expect(
      calculateDaysBetweenDates(new Date("2022-12-25"), new Date("2023-01-05")),
    ).toBe(12);
  });

  it("should handle leap years correctly", () => {
    expect(
      calculateDaysBetweenDates(new Date("2020-02-01"), new Date("2020-02-29")),
    ).toBe(29);

    expect(
      calculateDaysBetweenDates(new Date("2023-02-01"), new Date("2023-02-28")),
    ).toBe(28);
  });

  it("should handle dates with different time components", () => {
    const startDate = new Date("2023-05-15T08:00:00");
    const endDate = new Date("2023-05-15T18:00:00");
    expect(calculateDaysBetweenDates(startDate, endDate)).toBe(1);
  });

  it("should handle a full year correctly", () => {
    expect(
      calculateDaysBetweenDates(new Date("2023-01-01"), new Date("2023-12-31")),
    ).toBe(365);
  });
});
