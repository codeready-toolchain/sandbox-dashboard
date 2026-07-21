import type { StatusCondition } from "../types";

/**
 * Checks whether any of the given conditions match the specified criteria.
 * @param conditionType the type of the condition to find.
 * @param conditionStatus the status of the condition to find.
 * @param conditions the list of conditions to check.
 * @param conditionReason optionally, the expected condition's reason to find.
 * @returns a {@link StatusCondition} if found or `undefined` otherwise.
 */
export const anyConditionMatches = (
  conditionType: string,
  conditionStatus: string,
  conditions: StatusCondition[],
  conditionReason?: string,
): StatusCondition | undefined => {
  for (const condition of conditions) {
    if (
      condition.type === conditionType &&
      condition.status === conditionStatus &&
      (!conditionReason || condition.reason === conditionReason)
    ) {
      return condition;
    }
  }

  return undefined;
};
