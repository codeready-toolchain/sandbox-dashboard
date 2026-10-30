export const isValidCountryCode = (countryCode: string) =>
  /^[+]?[0-9]+$/.test(countryCode);

export const isValidPhoneNumber = (phoneNumber: string) =>
  /^[(]?[0-9]+[)]?[-\s.]?[0-9]+[-\s./0-9]*$/im.test(phoneNumber);

export const isValidOTP = (otp: string) => /^[a-zA-Z0-9]*$/.test(otp);

/**
 * Returns a user-facing validation message for the phone step, or null
 * when both the country code and phone number are valid.
 */
export function getPhoneStepValidationError(
  countryCode: string,
  phoneNumber: string,
): string | null {
  if (!isValidCountryCode(countryCode)) {
    return "Please enter a valid country code.";
  }
  if (!isValidPhoneNumber(phoneNumber)) {
    return "Please enter a valid phone number.";
  }
  return null;
}
