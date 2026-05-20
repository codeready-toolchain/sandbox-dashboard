import { useContext } from "react";
import { NotificationContext } from "./NotificationContext";
import type { NotificationContextValue } from "./NotificationContext";

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};
