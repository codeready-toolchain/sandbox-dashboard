import type { StatusCondition } from "../types";

export const isConditionTrue = (
  condType: string,
  conditions: StatusCondition[],
): [boolean, StatusCondition | null] => {
  for (const condition of conditions) {
    if (condition.type === condType && condition.status === "True") {
      return [true, condition];
    }
  }
  return [false, null];
};

export const isConditionFalse = (
  condType: string,
  conditions: StatusCondition[],
): [boolean, StatusCondition | null] => {
  for (const condition of conditions) {
    if (condition.type === condType && condition.status === "False") {
      return [true, condition];
    }
  }
  return [false, null];
};
