import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getUIConfig } from "../api/registration";
import logger from "../utils/logger";
import { UIConfigurationContext } from "./UIConfigurationContext";

export function UIConfigurationProvider({ children }: { children: ReactNode }) {
  const [disabledIntegrations, setDisabledIntegrations] = useState<
    string[] | undefined
  >();
  const [marketoWebhookURL, setMarketoWebhookURL] = useState<
    string | undefined
  >();

  // Fetches the UI configuration.
  useEffect(() => {
    const fetchUIConfigData = async () => {
      try {
        const uiConfig = await getUIConfig();
        if (uiConfig.workatoWebHookURL) {
          setMarketoWebhookURL(uiConfig.workatoWebHookURL);
        }
        setDisabledIntegrations(
          Array.isArray(uiConfig.disabledIntegrations)
            ? uiConfig.disabledIntegrations
            : [],
        );
      } catch (err) {
        logger.error("Error fetching UI config:", err);
        setDisabledIntegrations([]);
      }
    };
    fetchUIConfigData();
  }, []);

  // Memoize the contents of the context to avoid rerenders on any state or
  // function changes.
  const contextValue = useMemo(
    () => ({
      disabledIntegrations,
      marketoWebhookURL,
    }),
    [disabledIntegrations, marketoWebhookURL],
  );

  return (
    <UIConfigurationContext.Provider value={contextValue}>
      {children}
    </UIConfigurationContext.Provider>
  );
}
