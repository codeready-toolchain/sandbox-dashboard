import { createContext, useContext } from "react";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AnalyticsContextType {}

export const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
  undefined,
);

export const useAnalyticsContext = (): AnalyticsContextType => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("Context useAnalyticsContext is not defined");
  }
  return context;
};
