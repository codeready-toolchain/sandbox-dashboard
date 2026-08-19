import { screen } from "@testing-library/react";

export function getPhoneVerificationDialog() {
  return screen.getByRole("dialog", { name: "Phone verification" });
}

export function queryPhoneVerificationDialog() {
  return screen.queryByRole("dialog", { name: "Phone verification" });
}

export function getPhoneNumberInput() {
  return screen.getByRole("textbox", { name: "Phone number" });
}

export function getVerificationCodeInput() {
  return screen.getByRole("textbox", { name: "Verification code" });
}
