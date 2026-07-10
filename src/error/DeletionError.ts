import { errorMessage } from "../utils/common";
import { ApiError } from "./ApiError";

/**
 * Defines the operation that failed and the details of why it did.
 */
export interface DeletionFailure {
  operation: string;
  detail: string;
}

/**
 * Defines a class that helps with processing the deletion errors from
 * cleanups.
 */
export class DeletionError extends Error {
  readonly failures: DeletionFailure[];
  readonly productName: string;

  constructor(productName: string, failures: DeletionFailure[]) {
    super(`Deletion of ${productName} had ${failures.length} failure(s)`);

    this.name = "DeletionError";
    this.failures = failures;
    this.productName = productName;
  }

  /**
   * Formats the errors in a user-friendly and support-friendly way.
   * @returns a string containing a list of errors that happened during the
   * deletion.
   */
  public toString(): string {
    // The intended format is:
    //
    // ProductFoo
    //
    // [1]: OperationFoo: 401 1nauthorized
    //
    // [2]: Bar: {"kubernetesFailure": "reasonForFailure"}
    //
    // ...
    //
    // [n]: FooBar: Another error reason.
    let result = `${this.productName}\n\n`;

    for (let i = 0; i < this.failures.length; i++) {
      const failure = this.failures[i];

      result += `[${i + 1}]: ${failure.operation}: ${failure.detail}`;
      result += "\n\n";
    }
    return result;
  }

  /**
   * Processes the results from the operations and creates a new
   * {@link DeletionError}.
   * @param productName the name of the product the errors were generated in.
   * @param operationLabels the labels of the operations that failed.
   * @param results the results of those operations.
   * @returns a {@link DeletionError} if there are any failures, `undefined`
   * otherwise.
   */
  static fromSettledResults(
    productName: string,
    operationLabels: string[],
    results: PromiseSettledResult<void>[],
  ): DeletionError | undefined {
    const failures: DeletionFailure[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.status === "rejected") {
        const reason = result.reason;

        failures.push({
          operation: operationLabels[i],
          detail:
            reason instanceof ApiError
              ? `${reason.statusCode} ${reason.body}`
              : errorMessage(reason),
        });
      }
    }

    if (failures.length === 0) {
      return undefined;
    }

    return new DeletionError(productName, failures);
  }
}
