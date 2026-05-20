export const errorMessage = (e: unknown): string => {
  if (typeof e === "string") {
    return e;
  }

  if (e instanceof Error) {
    return e.message;
  }

  if (typeof e === "object" && e !== null) {
    const maybeMessage = (e as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
    return JSON.stringify(e);
  }

  return "An unknown error occurred";
};

export const calculateDaysBetweenDates = (
  startDate: Date,
  endDate: Date,
): number => {
  const millisecondsInDay = 1000 * 60 * 60 * 24;
  const differenceInMs = Math.abs(
    endDate.getTime() + millisecondsInDay - startDate.getTime(),
  );
  return Math.floor(differenceInMs / millisecondsInDay);
};
