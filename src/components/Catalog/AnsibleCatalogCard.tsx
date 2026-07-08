import { useCallback, useRef, useState } from "react";
import { useSandboxContext } from "../../hooks/SandboxContext";
import type { Product } from "../../hooks/useProductURLs";
import { AnsibleStatus } from "../../utils/aap-utils";
import { AnsibleDeleteInstanceModal, AnsibleLaunchInfoModal } from "../Modals";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel, StatusColor, type StatusLabel } from "./catalogCardTypes";
import type { EnsureUserIsReadyResult } from "./catalogCardTypes";
import type { ProductData } from "./productData";

/**
 * Obtains the main button's label.
 * @param status the status from which determine the button label.
 * @returns the label of the main button.
 */
function getButtonLabel(status: AnsibleStatus): ButtonLabel {
  switch (status) {
    case AnsibleStatus.NEW:
    case AnsibleStatus.NOT_DEPLOYED:
    case AnsibleStatus.UNKNOWN:
      return ButtonLabel.PROVISION;

    case AnsibleStatus.PROVISIONING:
      return ButtonLabel.PROVISIONING;

    case AnsibleStatus.READY:
      return ButtonLabel.LAUNCH;

    case AnsibleStatus.IDLED:
      return ButtonLabel.REPROVISION;

    default:
      return ButtonLabel.TRY_IT;
  }
}

/**
 * Obtains a label, if applicable.
 * @param status the status from which derive the label.
 * @returns a label text and color depending on the given status.
 */
function getStatusLabel(status: AnsibleStatus): StatusLabel | undefined {
  switch (status) {
    case AnsibleStatus.PROVISIONING:
      return { label: "Provisioning", color: StatusColor.BLUE };
    case AnsibleStatus.READY:
      return { label: "Ready", color: StatusColor.GREEN };
    case AnsibleStatus.IDLED:
      return { label: "Idled", color: StatusColor.ORANGE };
    default:
      return undefined;
  }
}

/**
 * Defines the properties for the Ansible card's component.
 */
type AnsibleCatalogCardProps = {
  /** The product to be shown in the card */
  product: ProductData;
  /** Shows or hides the green corner on the top left part of the card. */
  isGreenCornerVisible: boolean;
  /**
   * Function to make sure that the user signup is ready before attempting to
   * manage any AAP instances.
   */
  ensureUserIsReady: () => Promise<EnsureUserIsReadyResult>;
  /**
   * Marks the product as "tried".
   * @param product The product to be marked.
   */
  markProductAsTried: (product: Product) => void;
};

export function AnsibleCatalogCard({
  product,
  isGreenCornerVisible,
  ensureUserIsReady,
  markProductAsTried,
}: AnsibleCatalogCardProps) {
  const {
    ansibleError,
    ansibleStatus,
    ansibleUILink,
    ansibleUIPassword,
    ansibleUIUser,
    handleAAPInstance,
    refetchAAP,
    userData,
  } = useSandboxContext();

  const [isAnsibleInfoModalOpen, setAnsibleInfoModalOpen] =
    useState<boolean>(false);
  const [isAnsibleDeleteModalOpen, setAnsibleDeleteModalOpen] =
    useState<boolean>(false);
  const ansibleProvisionInFlight = useRef(false);
  const ansibleDeleteInFlight = useRef(false);

  // Determine the labels and statuses if applicable, and whether we should be
  // showing the delete button or not.
  const buttonLabel = getButtonLabel(ansibleStatus);
  const statusLabel = getStatusLabel(ansibleStatus);
  const isDeleteButtonVisible =
    ansibleStatus !== AnsibleStatus.NEW &&
    ansibleStatus !== AnsibleStatus.NOT_DEPLOYED &&
    ansibleStatus !== AnsibleStatus.UNKNOWN &&
    Boolean(userData?.proxyURL && userData?.defaultUserNamespace);

  /**
   * Once the user signup is ready, it either un-idles or provisions the
   * Ansible instance.
   */
  const handleOnClickPrimaryButton = useCallback(async () => {
    const isUserReady = await ensureUserIsReady();
    if (!isUserReady.ready) {
      return;
    }

    if (ansibleProvisionInFlight.current) {
      return;
    }

    ansibleProvisionInFlight.current = true;
    try {
      await handleAAPInstance(isUserReady.namespace || "");

      setAnsibleInfoModalOpen(true);
      markProductAsTried(product.id);
    } finally {
      ansibleProvisionInFlight.current = false;
    }
  }, [ensureUserIsReady, handleAAPInstance, markProductAsTried, product]);

  /**
   * Closes the deletion modal and triggers a refetch of the Ansible's
   * instance to update all the statuses.
   */
  const handleAAPDeleted = useCallback(async () => {
    if (ansibleDeleteInFlight.current) {
      return;
    }

    setAnsibleDeleteModalOpen(false);
    ansibleDeleteInFlight.current = true;

    try {
      if (userData?.defaultUserNamespace) {
        await refetchAAP(userData.defaultUserNamespace);
      }
    } finally {
      ansibleDeleteInFlight.current = false;
    }
  }, [refetchAAP, userData]);

  return (
    <>
      <CatalogCard
        product={product}
        statusLabel={statusLabel}
        primaryButtonLabel={buttonLabel}
        isGreenCornerVisible={isGreenCornerVisible}
        isPrimaryButtonDisabled={false}
        isPrimaryButtonSpinnerVisible={buttonLabel === ButtonLabel.PROVISIONING}
        isPrimaryButtonExtIconVisible={false}
        isDeleteButtonVisible={isDeleteButtonVisible}
        onClickPrimaryButton={handleOnClickPrimaryButton}
        onClickDeleteButton={() => setAnsibleDeleteModalOpen(true)}
      />
      <AnsibleLaunchInfoModal
        isOpen={isAnsibleInfoModalOpen}
        onClose={() => setAnsibleInfoModalOpen(false)}
        ansibleUILink={ansibleUILink}
        ansibleUIUser={ansibleUIUser}
        ansibleUIPassword={ansibleUIPassword}
        ansibleStatus={ansibleStatus}
        ansibleError={ansibleError}
      />
      {userData?.proxyURL && userData?.defaultUserNamespace && (
        <AnsibleDeleteInstanceModal
          isOpen={isAnsibleDeleteModalOpen}
          onClose={() => setAnsibleDeleteModalOpen(false)}
          onDeleted={handleAAPDeleted}
          proxyURL={userData.proxyURL}
          userNamespace={userData.defaultUserNamespace}
        />
      )}
    </>
  );
}
