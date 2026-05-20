import { useEffect } from "react";
import { getConfig } from "../config/config";
import { loadRecaptchaScript } from "../utils/recaptcha";

export const useRecaptcha = (enabled = true) => {
  useEffect(() => {
    if (enabled) {
      loadRecaptchaScript(getConfig().recaptchaSiteKey);
    }
  }, [enabled]);
};
