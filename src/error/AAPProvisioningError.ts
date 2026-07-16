import type { StatusCondition } from "../types";

/**
 * Defines a class that is used for when the AAP instance is reporting a
 * failure condition.
 */
export class AAPProvisioningError extends Error {
  private readonly condition: StatusCondition;

  constructor(condition: StatusCondition) {
    super(`AAP provisioning failed: ${condition.message}`);
    this.name = "AAPProvisioningError";
    this.condition = condition;
  }

  /**
   * Retrieves the condition message of the failure with all the condition's
   * details interpolated.
   */
  public getFormattedErrorMessage(): string {
    return `AAP provisioning failed: {"type": "${this.condition.type}", "reason": "${this.condition.reason}", "message": "${this.condition.message}", "status": "${this.condition.status}"}`;
  }
}
