/**
 * Defines the different states the mocked AAP instance can be in.
 *
 * Kept in an MSW-free module so Playwright tests can import the members
 * without constructing the mock handlers.
 */
export enum AAPMockPhase {
  FAILED,
  NOT_CREATED,
  PROVISIONING,
  READY,
  IDLED,
  DELETING,
}
