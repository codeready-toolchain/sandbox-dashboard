import { AlertVariant } from "@patternfly/react-core";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import { PhoneVerificationModal } from "../components/Modals/PhoneVerificationModal";
import { useNotifications } from "../notifications/useNotifications";
import logger from "../utils/logger";
import { PhoneVerificationContext } from "./PhoneVerificationContext";
import { useUserContext } from "./UserContext";

/**
 * A simple component to handle the phone verification process.
 */
export function PhoneVerificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { refetchUserData } = useUserContext();
  const { addAlert } = useNotifications();

  const [isPhoneModalOpen, setPhoneModalOpen] = useState<boolean>(false);

  /**
   * Opens the phone verification modal.
   */
  const openPhoneVerificationModal = useCallback(() => {
    setPhoneModalOpen(true);
  }, []);

  // Memoize the contents of the context to avoid rerenders on any function
  // changes.
  const contextValue = useMemo(
    () => ({ openPhoneVerificationModal }),
    [openPhoneVerificationModal],
  );

  /**
   * Once the phone has been verified, make sure to close the modal and to
   * trigger a refetch of the data, so that any underlying components can have
   * the latest signup status.
   */
  const handlePhoneVerified = useCallback(async () => {
    setPhoneModalOpen(false);

    refetchUserData().catch((error) => {
      logger.warn(
        "Refetching the user's signup after verifying the user's phone threw an error",
        error,
      );

      addAlert(
        AlertVariant.warning,
        "Unable to refresh your user's details",
        "The phone was successfuly verified, but we were unable to refresh your user's details at the moment. You might have to refresh the page in order to start using the product trials. Sorry for the inconvenience.",
      );
    });
  }, [addAlert, refetchUserData]);

  return (
    <PhoneVerificationContext.Provider value={contextValue}>
      {children}
      <PhoneVerificationModal
        isOpen={isPhoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        onVerified={handlePhoneVerified}
      />
    </PhoneVerificationContext.Provider>
  );
}
