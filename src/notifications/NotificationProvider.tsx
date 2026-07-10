import {
  Alert,
  AlertActionCloseButton,
  AlertGroup,
  AlertVariant,
} from "@patternfly/react-core";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { ErrorSeverity, UserFacingError } from "../error/UserFacingError";
import logger from "../utils/logger";
import { NotificationContext } from "./NotificationContext";

/**
 * Defines the structure for an alert.
 */
interface AlertEntry {
  key: number;
  variant: AlertVariant;
  title: string;
  description?: string;
}

/**
 * Defines a notifications' provider to show alerts to users.
 * @param param0 the children to be notification-aware.
 * @returns the notification context which render alerts.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const keyRef = useRef(0);

  /**
   * Adds a new alert to be shown to the user.
   */
  const addAlert = useCallback(
    (variant: AlertVariant, title: string, description: string) => {
      const key = keyRef.current++;
      setAlerts((prev) => [...prev, { key, variant, title, description }]);
    },
    [],
  );

  /**
   * Maps the given error to a new alert.
   * @param error the error to be mapped.
   */
  const addAlertFromError = useCallback(
    (error: Error) => {
      if (error instanceof UserFacingError) {
        const variant =
          error.severity === ErrorSeverity.WARNING
            ? AlertVariant.warning
            : AlertVariant.danger;

        addAlert(variant, error.title, error.detail);
      } else {
        logger.error(
          `Unexpected exception sent to "addAlertFromError":`,
          error,
        );
      }
    },
    [addAlert],
  );

  /**
   * Removes an alert from the collection.
   */
  const removeAlert = useCallback((key: number) => {
    setAlerts((prev) => prev.filter((a) => a.key !== key));
  }, []);

  return (
    <NotificationContext.Provider value={{ addAlert, addAlertFromError }}>
      <AlertGroup isToast isLiveRegion>
        {alerts.map(({ key, variant, title, description }) => (
          <Alert
            key={key}
            variant={variant}
            title={title}
            timeout={8000}
            onTimeout={() => removeAlert(key)}
            actionClose={
              <AlertActionCloseButton onClose={() => removeAlert(key)} />
            }
          >
            {description}
          </Alert>
        ))}
      </AlertGroup>
      {children}
    </NotificationContext.Provider>
  );
}
