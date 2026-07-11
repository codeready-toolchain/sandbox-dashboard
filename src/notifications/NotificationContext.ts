import { createContext } from "react";
import type { AlertVariant } from "@patternfly/react-core";

/**
 * Defines the functions which the NotificationContext provides to show
 * notifications to users.
 */
export interface NotificationContextValue {
  addAlert: (variant: AlertVariant, title: string, description: string) => void;
  addAlertFromError: (error: Error) => void;
}

/**
 * Sets up the context for the notifications' provider.
 */
export const NotificationContext =
  createContext<NotificationContextValue | null>(null);
