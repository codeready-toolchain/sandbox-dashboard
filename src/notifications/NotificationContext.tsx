import {
  createContext,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  AlertGroup,
  AlertActionCloseButton,
  type AlertVariant,
} from "@patternfly/react-core";

interface AlertEntry {
  key: number;
  variant: AlertVariant;
  title: string;
  description?: string;
}

export interface NotificationContextValue {
  addAlert: (
    variant: AlertVariant,
    title: string,
    description?: string,
  ) => void;
}

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const keyRef = useRef(0);

  const addAlert = useCallback(
    (variant: AlertVariant, title: string, description?: string) => {
      const key = keyRef.current++;
      setAlerts((prev) => [...prev, { key, variant, title, description }]);
    },
    [],
  );

  const removeAlert = useCallback((key: number) => {
    setAlerts((prev) => prev.filter((a) => a.key !== key));
  }, []);

  return (
    <NotificationContext.Provider value={{ addAlert }}>
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
