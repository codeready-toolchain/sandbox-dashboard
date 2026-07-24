import { AlertVariant } from "@patternfly/react-core";
import { useCallback, useRef, useState } from "react";
import { UserFacingError } from "../../error/UserFacingError";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useAnsibleContext } from "../../hooks/AnsibleContext";
import { usePhoneVerificationContext } from "../../hooks/PhoneVerificationContext";
import { UserSignupPhase, useUserContext } from "../../hooks/UserContext";
import { useNotifications } from "../../notifications/useNotifications";
import type { Product } from "../../types/product";
import type { AAPInstanceStatus } from "../../utils/aap-utils";
import logger from "../../utils/logger";
import { AnsibleDeleteInstanceModal, AnsibleLaunchInfoModal } from "../Modals";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel, StatusColor, type StatusLabel } from "./catalogCardTypes";
import { SUPPORT_EMAIL } from "../../const";

/**
 * Obtains the main button's label.
 * @param status the status from which determine the button label.
 * @returns the label of the main button.
 */
function getButtonLabel(status: AAPInstanceStatus): ButtonLabel {
  switch (status.kind) {
    case "userNotReady":
    case "new":
    case "notDeployed":
    case "unknown":
    case "error":
      return ButtonLabel.PROVISION;

    case "provisioning":
    case "unidling":
      return ButtonLabel.PROVISIONING;

    case "ready":
      return ButtonLabel.LAUNCH;

    case "idled":
      return ButtonLabel.REPROVISION;

    case "deleting":
    case "deleted":
      return ButtonLabel.DELETING;

    default:
      return ButtonLabel.TRY_IT;
  }
}

/**
 * Obtains a label, if applicable.
 * @param status the status from which derive the label.
 * @returns a label text and color depending on the given status.
 */
function getStatusLabel(status: AAPInstanceStatus): StatusLabel | undefined {
  switch (status.kind) {
    case "provisioning":
    case "unidling":
      return { label: "Provisioning", color: StatusColor.BLUE };
    case "ready":
      return { label: "Ready", color: StatusColor.GREEN };
    case "idled":
      return { label: "Idled", color: StatusColor.ORANGE };
    case "deleting":
    case "deleted":
      return { label: "Deleting", color: StatusColor.BLUE };
    case "error":
      return { label: "Failed", color: StatusColor.RED };
    default:
      return undefined;
  }
}

/**
 * Defines the properties for the Ansible card's component.
 */
type AnsibleCatalogCardProps = {
  /** The product to be shown in the card */
  product: Product;
  /** Shows or hides the green corner on the top left part of the card. */
  isGreenCornerVisible: boolean;
  /**
   * Marks the product as "tried".
   * @param product The product to be marked.
   */
  markProductAsTried: (product: Product) => void;
};

export function AnsibleCatalogCard({
  product,
  isGreenCornerVisible,
  markProductAsTried,
}: AnsibleCatalogCardProps) {
  const { deleteInstance, instanceStatus, provisionInstance, unidleInstance } =
    useAnsibleContext();

  const { signupUser, userSignupPhase } = useUserContext();
  const { addAlert, addAlertFromError } = useNotifications();
  const { openPhoneVerificationModal } = usePhoneVerificationContext();
  const { trackAnalytics } = useAnalyticsContext();

  const [deletionError, setDeletionError] = useState<
    UserFacingError | undefined
  >();
  const [isAnsibleInfoModalOpen, setAnsibleInfoModalOpen] =
    useState<boolean>(false);
  const [isAnsibleDeleteModalOpen, setAnsibleDeleteModalOpen] =
    useState<boolean>(false);
  const [provisioningError, setProvisioningError] = useState<
    UserFacingError | undefined
  >();

  const provisionInFlight = useRef(false);
  const unidleInFlight = useRef(false);
  const deleteInFlight = useRef(false);

  // Determine the labels and statuses if applicable, and whether we should be
  // showing the delete button or not.
  const buttonLabel = getButtonLabel(instanceStatus);
  const statusLabel = getStatusLabel(instanceStatus);
  const isDeleteButtonVisible =
    instanceStatus.kind !== "userNotReady" &&
    instanceStatus.kind !== "new" &&
    instanceStatus.kind !== "notDeployed" &&
    instanceStatus.kind !== "unknown" &&
    instanceStatus.kind !== "deleted";

  /**
   * Once the user signup is ready, it either un-idles or provisions the
   * Ansible instance.
   */
  const handleOnClickPrimaryButton = useCallback(async () => {
    switch (userSignupPhase) {
      case UserSignupPhase.NOT_STARTED:
        signupUser();
        return;
      case UserSignupPhase.PENDING_PHONE_VERIFICATION:
        openPhoneVerificationModal();
        return;
      case UserSignupPhase.READY:
        break;
      default:
        return;
    }

    switch (instanceStatus.kind) {
      case "userNotReady":
      case "unknown":
      case "deleting":
      case "deleted":
      case "notDeployed":
        return;

      case "ready":
        setAnsibleInfoModalOpen(true);
        trackAnalytics(product, "Catalog", undefined, "cta");
        markProductAsTried(product);
        return;

      case "provisioning":
      case "unidling":
        setAnsibleInfoModalOpen(true);
        return;

      case "idled":
        if (unidleInFlight.current) {
          return;
        }

        unidleInFlight.current = true;
        try {
          await unidleInstance();
          setAnsibleInfoModalOpen(true);
        } catch (error) {
          if (error instanceof UserFacingError) {
            setProvisioningError(error);
          } else {
            setProvisioningError(
              new UserFacingError(
                "Unable to reprovision your instance",
                `We were unable to reprovision your instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                error,
                `${error}`,
              ),
            );
          }
        } finally {
          unidleInFlight.current = false;
        }

        return;

      case "new":
      case "error":
        if (provisionInFlight.current) {
          return;
        }

        provisionInFlight.current = true;
        try {
          await provisionInstance();
        } catch (error) {
          if (error instanceof UserFacingError) {
            setProvisioningError(error);
          } else {
            setProvisioningError(
              new UserFacingError(
                "Unable to provision your instance",
                `We were unable to provision your instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
                error,
                `${error}`,
              ),
            );
          }
          setAnsibleInfoModalOpen(true);
          return;
        } finally {
          provisionInFlight.current = false;
        }
        setAnsibleInfoModalOpen(true);
        trackAnalytics(product, "Catalog", undefined, "cta");
        markProductAsTried(product);
    }
    return;
  }, [
    instanceStatus.kind,
    markProductAsTried,
    openPhoneVerificationModal,
    product,
    provisionInstance,
    signupUser,
    trackAnalytics,
    unidleInstance,
    userSignupPhase,
  ]);

  /**
   * Deletes the Ansible instance.
   */
  const handleOnClickDelete = useCallback(async () => {
    if (deleteInFlight.current || instanceStatus.kind === "userNotReady") {
      return;
    }

    deleteInFlight.current = true;
    try {
      await deleteInstance();
      setAnsibleDeleteModalOpen(false);
    } catch (error) {
      if (error instanceof UserFacingError) {
        setDeletionError(error);
        addAlertFromError(error);
      } else {
        logger.error(
          "Unexpected exception occurred when handling AAP instance:",
          error,
        );
        addAlert(
          AlertVariant.danger,
          "Unable to delete your instance",
          "An unexpected error occurred while deleting your AAP instance. Please try again later.",
        );
      }
    } finally {
      deleteInFlight.current = false;
    }
  }, [addAlert, addAlertFromError, deleteInstance, instanceStatus.kind]);

  /**
   * Closes the deletion modal and triggers a refetch of the Ansible's
   * instance to update all the statuses.
   */
  const onDeleteModalClose = useCallback(async () => {
    if (deletionError) {
      setDeletionError(undefined);
    }

    setAnsibleDeleteModalOpen(false);
  }, [deletionError]);

  /**
   * Clears any errors that are clearable before switching the modal's status
   * to "closed".
   */
  const onLaunchInfoModalClose = useCallback(() => {
    if (provisioningError) {
      setProvisioningError(undefined);
    }

    setAnsibleInfoModalOpen(false);
  }, [provisioningError]);

  return (
    <>
      <CatalogCard
        product={product}
        statusLabel={statusLabel}
        primaryButtonLabel={buttonLabel}
        isGreenCornerVisible={isGreenCornerVisible}
        isPrimaryButtonDisabled={buttonLabel === ButtonLabel.DELETING}
        isPrimaryButtonSpinnerVisible={
          buttonLabel === ButtonLabel.PROVISIONING ||
          buttonLabel === ButtonLabel.DELETING
        }
        isPrimaryButtonExtIconVisible={false}
        isDeleteButtonVisible={isDeleteButtonVisible}
        onClickPrimaryButton={handleOnClickPrimaryButton}
        onClickDeleteButton={() => setAnsibleDeleteModalOpen(true)}
      />
      <AnsibleLaunchInfoModal
        isOpen={isAnsibleInfoModalOpen}
        onClose={onLaunchInfoModalClose}
        provisioningError={provisioningError}
      />
      <AnsibleDeleteInstanceModal
        isOpen={isAnsibleDeleteModalOpen}
        onClose={onDeleteModalClose}
        onClickDelete={handleOnClickDelete}
        deletionError={deletionError}
      />
    </>
  );
}
