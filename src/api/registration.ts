import { Environment, getConfig } from "../config/config";
import type { CommonResponse, SignupData, UIConfig } from "../types";
import { isValidCountryCode, isValidPhoneNumber } from "../utils/phone-utils";
import { authFetch } from "./authFetch";

function getBaseURL(): string {
  return `${getConfig().registrationServiceURL}/api/v1`;
}

export async function getSignupData(): Promise<SignupData | undefined> {
  const response = await authFetch(`${getBaseURL()}/signup`, {
    method: "GET",
  });
  if (!response.ok) {
    if (response.status === 404) {
      return undefined;
    }
    throw new Error(
      `Unexpected status code: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

export async function getRecaptchaToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiKey = getConfig().recaptchaSiteKey;
    let timeout = false;
    const captchaTimeout = setTimeout(() => {
      timeout = true;
      reject(new Error("Recaptcha timeout."));
    }, 10000);
    if (grecaptcha?.enterprise) {
      grecaptcha.enterprise.ready(async () => {
        if (!timeout) {
          clearTimeout(captchaTimeout);
          try {
            resolve(
              await grecaptcha.enterprise.execute(apiKey, {
                action: "SIGNUP",
              }),
            );
          } catch {
            reject(new Error("Recaptcha failure."));
          }
        }
      });
    } else {
      reject(new Error("Recaptcha failure."));
    }
  });
}

export async function signup(): Promise<void> {
  const env = getConfig().environment;
  const headers: Record<string, string> = {};

  if (env === Environment.PRODUCTION) {
    try {
      headers["Recaptcha-Token"] = await getRecaptchaToken();
    } catch (err) {
      throw new Error(`Error getting recaptcha token: ${err}`, {
        cause: err,
      });
    }
  }

  await authFetch(`${getBaseURL()}/signup`, {
    method: "POST",
    headers,
    body: null,
  });
}

export async function initiatePhoneVerification(
  countryCode: string,
  phoneNumber: string,
): Promise<void> {
  if (!isValidCountryCode(countryCode)) {
    throw new Error("Invalid country code.");
  }
  if (!isValidPhoneNumber(phoneNumber)) {
    throw new Error("Invalid phone number.");
  }

  const response = await authFetch(`${getBaseURL()}/signup/verification`, {
    method: "PUT",
    body: JSON.stringify({
      country_code: countryCode,
      phone_number: phoneNumber,
    }),
  });

  if (!response.ok) {
    const error: CommonResponse = await response.json();
    if (
      error?.message.includes("Invalid 'To' Phone Number") ||
      error?.message.includes("'To' number cannot be a Short Code:") ||
      error?.message.includes(
        "Message cannot be sent with the current combination of 'To'",
      ) ||
      error?.message.includes("is not a valid mobile number")
    ) {
      throw new Error(
        "Invalid phone number. Please verify the country code and number format, then try again.",
      );
    } else if (error?.message.includes("phone number already in use")) {
      throw new Error(
        "This phone number is already in use. Please use a different number.",
      );
    } else {
      throw new Error(error?.message);
    }
  }
}

export async function completePhoneVerification(code: string): Promise<void> {
  const response = await authFetch(
    `${getBaseURL()}/signup/verification/${code}`,
    { method: "GET" },
  );

  if (!response.ok) {
    const error: CommonResponse = await response.json();
    throw new Error(error?.message);
  }
}

export async function verifyActivationCode(code: string): Promise<void> {
  const response = await authFetch(
    `${getBaseURL()}/signup/verification/activation-code`,
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
  );

  if (!response.ok) {
    const error: CommonResponse = await response.json();
    throw new Error(error?.message);
  }
}

export async function getSegmentWriteKey(): Promise<string> {
  const response = await authFetch(
    `${getBaseURL()}/analytics/segment-write-key`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Segment write key: ${response.status}`);
  }

  const writeKey = await response.text();
  return writeKey.trim();
}

export async function getUIConfig(): Promise<UIConfig> {
  try {
    const response = await authFetch(`${getBaseURL()}/uiconfig`, {
      method: "GET",
    });

    if (!response.ok) {
      return {};
    }

    return response.json();
  } catch {
    return {};
  }
}

export async function resetWorkspaces(): Promise<void> {
  const genericError =
    "Unable to reset your workspaces. Please, try again later, and if your issue persists, contact support at devsandbox@redhat.com";

  let response: Response;
  try {
    response = await authFetch(`${getBaseURL()}/reset-namespaces`, {
      method: "POST",
    });
  } catch {
    throw new Error(genericError);
  }

  if (!response.ok) {
    let details: string | undefined;
    try {
      const body: CommonResponse = await response.json();
      details = body?.details;
    } catch {
      // JSON parsing failed
    }
    throw new Error(details || genericError);
  }
}
