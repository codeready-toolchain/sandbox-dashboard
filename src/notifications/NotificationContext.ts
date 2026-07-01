import { createContext } from "react";
import type { AlertVariant } from "@patternfly/react-core";

export interface NotificationContextValue {
  addAlert: (
    variant: AlertVariant,
    title: string,
    description?: string,
  ) => void;
}

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);
