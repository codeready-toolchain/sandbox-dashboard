import { Environment, getConfig } from "../config/config";
import { ApiError } from "../error/ApiError";
import type { SignupData, UIConfig } from "../types";
import logger from "../utils/logger";
import { authFetch } from "./authFetch";

function getBaseURL(): string {
  return `${getConfig().registrationServiceURL}/api/v1`;
}

/**
 * Fetches the user's signup data.
 * @returns the signup data or `undefined` if we get a "not found" error.
 * @throws {ApiError} if any errors occur.
 */
export async function getSignupData(): Promise<SignupData | undefined> {
  const response = await authFetch(`${getBaseURL()}/signup`, {
    method: "GET",
  });
  if (!response.ok) {
    if (response.status === 404) {
      // It is fine for the user to not exist in our systems, since that means
      // that there is not a user signup yet.
      return undefined;
    }

    throw await ApiError.fromResponse("getSignupData failed", response);
  }
  return response.json();
}

export async function getRecaptchaToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiKey = getConfig().recaptchaSiteKey;
    let timeout = false;
    const captchaTimeout = setTimeout(() => {
      timeout = true;
      logger.error("Recaptcha timed out");
      reject(new Error("Recaptcha timeout."));
    }, 10000);
    if (grecaptcha?.enterprise) {
      grecaptcha.enterprise.ready(async () => {
        if (!timeout) {
          try {
            const token = await grecaptcha.enterprise.execute(apiKey, {
              action: "SIGNUP",
            });
            clearTimeout(captchaTimeout);
            resolve(token);
          } catch (error) {
            clearTimeout(captchaTimeout);
            logger.error("Unable to resolve the recaptcha", error);
            reject(new Error("Recaptcha failure."));
          }
        }
      });
    } else {
      clearTimeout(captchaTimeout);
      logger.error("Not using recaptcha enterprise");
      reject(new Error("Recaptcha failure."));
    }
  });
}

/**
 * Creates a user signup for the user in the back end.
 * @throws {Error} for a recaptcha error.
 * @throws {ApiError} if the creation of the signup fails.
 */
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

  const response = await authFetch(`${getBaseURL()}/signup`, {
    method: "POST",
    headers,
    body: null,
  });

  if (!response.ok) {
    throw await ApiError.fromResponse("signup failed", response);
  }
}

/**
 * Initiates the phone verification flow.
 * @param countryCode the country code of the phone number.
 * @param phoneNumber the phone number itself.
 * @throws {ApiError} if any error occurs, including country code or phone
 * number input errors.
 */
export async function initiatePhoneVerification(
  countryCode: string,
  phoneNumber: string,
): Promise<void> {
  const response = await authFetch(`${getBaseURL()}/signup/verification`, {
    method: "PUT",
    body: JSON.stringify({
      country_code: countryCode,
      phone_number: phoneNumber,
    }),
  });

  if (!response.ok) {
    throw await ApiError.fromResponse(
      "initiatePhoneVerification failed",
      response,
    );
  }
}

/**
 * Completes the phone verification process.
 * @param code the code the user entered.
 */
export async function completePhoneVerification(code: string): Promise<void> {
  const response = await authFetch(
    `${getBaseURL()}/signup/verification/${code}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw await ApiError.fromResponse(
      "completePhoneVerification failed",
      response,
    );
  }
}

/**
 * Verifies the activation code for groups or special events.
 * @param code the code provided by the user.
 */
export async function verifyActivationCode(code: string): Promise<void> {
  const response = await authFetch(
    `${getBaseURL()}/signup/verification/activation-code`,
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
  );

  if (!response.ok) {
    throw await ApiError.fromResponse("verifyActivationCode failed", response);
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

/**
 * Fetches the UI configuration from the back end.
 * @returns the populated UI configuration or an empty one in case of error.
 */
export async function getUIConfig(): Promise<UIConfig> {
  try {
    const response = await authFetch(`${getBaseURL()}/uiconfig`, {
      method: "GET",
    });

    if (!response.ok) {
      // We purposely do not throw the error to take advantage of the error
      // structure's safe body unmarshalling and logging mechanisms, instead
      // of having a manual log and the safe unmarshalling dance.
      await ApiError.fromResponse(
        "Unexpected error when fetching the UI configuration",
        response,
      );

      return {};
    }

    return response.json();
  } catch {
    return {};
  }
}

/**
 * Resets the user's workspaces by requesting the backend to delete and
 * recreate the namespaces.
 * @throws {ApiError} if the reset request fails.
 */
export async function resetWorkspaces(): Promise<void> {
  const response = await authFetch(`${getBaseURL()}/reset-namespaces`, {
    method: "POST",
  });

  if (!response.ok) {
    throw await ApiError.fromResponse("resetWorkspaces failed", response);
  }
}
