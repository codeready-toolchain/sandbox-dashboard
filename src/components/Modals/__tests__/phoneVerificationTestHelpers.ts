import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

export function getPhoneVerificationDialog() {
  return screen.getByRole("dialog", { name: "Phone verification" });
}

export function queryPhoneVerificationDialog() {
  return screen.queryByRole("dialog", { name: "Phone verification" });
}

export function getCountryCodeInput() {
  return screen.getByRole("combobox", { name: "Country code" });
}

export function getPhoneNumberInput() {
  return screen.getByRole("textbox", { name: "Phone number" });
}

export function getVerificationCodeInput() {
  return screen.getByRole("textbox", { name: "Verification code" });
}

/**
 * Selects a country dial code from the typeahead dropdown.
 * @param user the testing-library user event instance.
 * @param filter text typed to narrow the country list.
 * @param optionLabel the visible option label to click.
 */
export async function selectCountryCode(
  user: UserEvent,
  filter = "United States",
  optionLabel = "United States (+1)",
) {
  const countryCodeInput = getCountryCodeInput();
  await user.click(countryCodeInput);
  await user.clear(countryCodeInput);
  await user.type(countryCodeInput, filter);
  await user.click(screen.getByRole("option", { name: optionLabel }));
}
