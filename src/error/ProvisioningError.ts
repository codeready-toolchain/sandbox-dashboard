import type { StatusCondition } from "../types";

/**
 * Defines a class that is used for when an instance is reporting a failure
 * condition.
 */
export class ProvisioningError extends Error {
  private readonly condition: StatusCondition;
  private readonly product: "AAP" | "OpenClaw";

  constructor(product: "AAP" | "OpenClaw", condition: StatusCondition) {
    super(`${product} provisioning failed: ${condition.message}`);
    this.name = "ProvisioningError";
    this.condition = condition;
    this.product = product;
  }

  /**
   * Retrieves the condition message of the failure with all the condition's
   * details interpolated.
   */
  public getFormattedErrorMessage(): string {
    return `${this.product} provisioning failed: ${JSON.stringify({ type: this.condition.type, reason: this.condition.reason, message: this.condition.message, status: this.condition.status })}`;
  }
}
