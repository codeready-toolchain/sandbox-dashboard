import { createContext, useContext } from "react";

export interface UIConfigurationContextType {
  disabledIntegrations?: string[];
  marketoWebhookURL?: string;
}

export const UIConfigurationContext = createContext<
  UIConfigurationContextType | undefined
>(undefined);

export const useUIConfigurationContext = (): UIConfigurationContextType => {
  const context = useContext(UIConfigurationContext);
  if (!context) {
    throw new Error("Context useUIConfigurationContext is not defined");
  }

  return context;
};
