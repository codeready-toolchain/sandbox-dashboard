import {
  Alert,
  AlertActionCloseButton,
  AlertActionLink,
  AlertGroup,
  AlertVariant,
} from "@patternfly/react-core";
import { type ReactNode, useCallback, useRef, useState } from "react";

import { ErrorSeverity, UserFacingError } from "../error/UserFacingError";
import logger from "../utils/logger";
import { NotificationContext } from "./NotificationContext";
import { useCopyToClipboard } from "./useCopyToClipboard";

/**
 * Defines the structure for an alert.
 */
interface AlertEntry {
  /** An ID for the entry. */
  key: number;
  /** The kind or type of alert. */
  variant: AlertVariant;
  /** The title that will be shown in the alert. */
  title: string;
  /** The description that will be shown in the alert. */
  description: string;
  /**
   * Optionally, the technical details that we want the user to be able to
   * copy.
   */
  technicalDetails?: string;
}

/**
 * Defines a notifications' provider to show alerts to users.
 * @param param0 the children to be notification-aware.
 * @returns the notification context which render alerts.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { copyToClipboard, getLabel } = useCopyToClipboard();

  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const keyRef = useRef(0);

  /**
   * Adds a new alert to be shown to the user.
   *
   * @param variant the type of alert to be shown.
   * @param title the title of the alert.
   * @param description the text description or the alert, or the message
   * itself.
   * @param technicalDetails optionally, the technical details so that the
   * user can copy them.
   */
  const addAlert = useCallback(
    (
      variant: AlertVariant,
      title: string,
      description: string,
      technicalDetails?: string,
    ) => {
      const key = keyRef.current++;
      setAlerts((prev) => [
        ...prev,
        { key, variant, title, description, technicalDetails },
      ]);
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

        addAlert(variant, error.title, error.detail, error.technicalDetails);
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
        {alerts.map(
          ({ key, variant, title, description, technicalDetails }) => (
            <Alert
              key={key}
              variant={variant}
              title={title}
              onTimeout={
                variant === AlertVariant.danger
                  ? undefined
                  : () => removeAlert(key)
              }
              actionLinks={
                technicalDetails && (
                  <AlertActionLink
                    onClick={() => copyToClipboard(technicalDetails, key)}
                  >
                    {getLabel(key)}
                  </AlertActionLink>
                )
              }
              actionClose={
                <AlertActionCloseButton onClose={() => removeAlert(key)} />
              }
            >
              {description}
            </Alert>
          ),
        )}
      </AlertGroup>
      {children}
    </NotificationContext.Provider>
  );
}
