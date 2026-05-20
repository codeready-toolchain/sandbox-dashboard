export const isValidCountryCode = (countryCode: string) =>
  /^[+]?[0-9]+$/.test(countryCode);

export const isValidPhoneNumber = (phoneNumber: string) =>
  /^[(]?[0-9]+[)]?[-\s.]?[0-9]+[-\s./0-9]*$/im.test(phoneNumber);

export const isValidOTP = (otp: string) => /^[a-zA-Z0-9]*$/.test(otp);
