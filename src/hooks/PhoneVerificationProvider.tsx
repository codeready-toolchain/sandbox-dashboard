import { useCallback, useMemo, useState, type ReactNode } from "react";
import { PhoneVerificationModal } from "../components/Modals/PhoneVerificationModal";
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
    await refetchUserData();
  }, [refetchUserData]);

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
