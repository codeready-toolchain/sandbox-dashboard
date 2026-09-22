/**
 * Overrides `navigator.userActivation` for unit tests. Pass `undefined`
 * to simulate browsers that do not implement the User Activation API.
 */
export function mockUserActivation(isActive: boolean | undefined): void {
  if (isActive === undefined) {
    Object.defineProperty(navigator, "userActivation", {
      configurable: true,
      value: undefined,
    });
    return;
  }

  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: { isActive, hasBeenActive: true },
  });
}
