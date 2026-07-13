import { useEffect, useState, type ReactNode } from "react";
import { getSegmentWriteKey } from "../api/registration";
import { Environment, getConfig } from "../config/config";
import { AnalyticsContext } from "./AnalyticsContext";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [segmentWriteKey, setSegmentWriteKey] = useState<string>();

  const isProd = getConfig().environment === Environment.PRODUCTION;

  // Fetch Segment write key (placeholder for Phase 5)
  useEffect(() => {
    if (!isProd) return;
    const fetchKey = async () => {
      try {
        const writeKey = await getSegmentWriteKey();
        setSegmentWriteKey(writeKey);
      } catch {
        // Continue without Segment tracking
      }
    };
    fetchKey();
  }, [isProd]);

  // segmentWriteKey will be consumed in Phase 5
  void segmentWriteKey;

  return (
    <AnalyticsContext.Provider value={{}}>{children}</AnalyticsContext.Provider>
  );
}
