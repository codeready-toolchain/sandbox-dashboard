import { AlertVariant } from "@patternfly/react-core";
import { useCallback, useRef, useState } from "react";
import { SUPPORT_EMAIL } from "../../const";
import { UserFacingError } from "../../error/UserFacingError";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useOpenClawContext } from "../../hooks/OpenClawContext";
import { usePhoneVerificationContext } from "../../hooks/PhoneVerificationContext";
import { UserSignupPhase, useUserContext } from "../../hooks/UserContext";
import { useNotifications } from "../../notifications/useNotifications";
import type { Product } from "../../types/product";
import logger from "../../utils/logger";
import type { AddedCredential } from "../../utils/openclaw-providers";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import { OpenClawLaunchInfoModal } from "../Modals";
import { OpenClawDeleteInstanceModal } from "../Modals/OpenClawDeletInstanceModal";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel, StatusColor, type StatusLabel } from "./catalogCardTypes";

/**
 * Obtains the main button's label.
 * @param status the status from which determine the button label.
 * @returns the label of the main button.
 */
function getButtonLabel(status: OpenClawStatus): ButtonLabel {
  switch (status) {
    case OpenClawStatus.NEW:
    case OpenClawStatus.FAILED:
      return ButtonLabel.PROVISION;

    case OpenClawStatus.PROVISIONING:
    case OpenClawStatus.UNIDLING:
      return ButtonLabel.PROVISIONING;

    case OpenClawStatus.READY:
      return ButtonLabel.LAUNCH;

    case OpenClawStatus.IDLED:
      return ButtonLabel.REPROVISION;

    case OpenClawStatus.DELETING:
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
function getStatusLabel(status: OpenClawStatus): StatusLabel | undefined {
  switch (status) {
    case OpenClawStatus.PROVISIONING:
      return { label: "Provisioning", color: StatusColor.BLUE };
    case OpenClawStatus.READY:
      return { label: "Ready", color: StatusColor.GREEN };
    case OpenClawStatus.IDLED:
      return { label: "Idled", color: StatusColor.ORANGE };
    case OpenClawStatus.UNIDLING:
      return { label: "Provisioning", color: StatusColor.BLUE };
    case OpenClawStatus.DELETING:
      return { label: "Deleting", color: StatusColor.RED };
    case OpenClawStatus.FAILED:
      return { label: "Failed", color: StatusColor.RED };
    default:
      return undefined;
  }
}

/**
 * Defines the properties for the OpenClaw card.
 */
type OpenClawCatalogCardProps = {
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

export function OpenClawCatalogCard({
  product,
  isGreenCornerVisible,
  markProductAsTried,
}: OpenClawCatalogCardProps) {
  const { trackAnalytics } = useAnalyticsContext();
  const { signupUser, userSignupPhase } = useUserContext();
  const {
    clearDeletionError,
    clearProvisioningError,
    deleteInstance,
    deletionError,
    uiURL,
    provisioningError,
    startProvisioning,
    status,
    unidleInstance,
  } = useOpenClawContext();

  const { addAlert, addAlertFromError } = useNotifications();
  const { openPhoneVerificationModal } = usePhoneVerificationContext();

  const [isOpenClawInfoModalOpen, setOpenClawInfoModalOpen] =
    useState<boolean>(false);
  const [isOpenClawBeingDeleted, setOpenClawBeingDeleted] =
    useState<boolean>(false);
  const [isOpenClawDeleteModalOpen, setOpenClawDeleteModalOpen] =
    useState<boolean>(false);
  const openClawProvisionInFlight = useRef(false);
  const openClawUnidleInFlight = useRef(false);
  const openClawDeleteInFlight = useRef(false);

  // Determine the labels and statuses if applicable, and whether we should be
  // showing the delete button or not.
  const buttonLabel = getButtonLabel(status);
  const statusLabel = getStatusLabel(status);
  const isDeleteButtonVisible =
    status !== OpenClawStatus.USER_NOT_READY &&
    status !== OpenClawStatus.NEW &&
    status !== OpenClawStatus.DELETING &&
    status !== OpenClawStatus.UNIDLING &&
    status !== OpenClawStatus.UNKNOWN;

  /**
   * Routes caught errors to the appropriate notification mechanism: user-facing
   * errors are shown via their own alert, while unexpected exceptions are
   * logged and surfaced as a generic danger notification.
   * @param error the caught exception.
   * @param fallbackTitle the alert title used for non-user-facing errors.
   * @param fallbackMessage the alert description used for non-user-facing errors.
   */
  const handleOpenClawApiError = useCallback(
    (error: unknown, fallbackTitle: string, fallbackMessage: string): void => {
      if (error instanceof UserFacingError) {
        addAlertFromError(error);
      } else {
        logger.error(fallbackTitle, error);
        addAlert(AlertVariant.danger, fallbackTitle, fallbackMessage);
      }
    },
    [addAlert, addAlertFromError],
  );

  /**
   * Once the user signup is ready, it handles opening the OpenClaw instance's
   * URL, reprovisioning the instance if it's idled or opens the modal to
   * provision it otherwise.
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

    switch (status) {
      case OpenClawStatus.USER_NOT_READY:
        return;
      case OpenClawStatus.IDLED:
        setOpenClawInfoModalOpen(true);

        if (openClawUnidleInFlight.current) {
          return;
        }

        openClawUnidleInFlight.current = true;
        try {
          await unidleInstance();
        } catch (error) {
          handleOpenClawApiError(
            error,
            "Unable to reprovision your instance",
            `An unexpected error occurred while reprovisioning your OpenClaw instance. Please try again later, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
          );
        } finally {
          openClawUnidleInFlight.current = false;
        }
        return;
      case OpenClawStatus.READY:
      case OpenClawStatus.PROVISIONING:
      default:
        setOpenClawInfoModalOpen(true);
    }
  }, [
    handleOpenClawApiError,
    openPhoneVerificationModal,
    signupUser,
    status,
    userSignupPhase,
    unidleInstance,
  ]);

  /**
   * Handles the provisioning of a new OpenClaw instance once the user signup
   * is available.
   */
  const handleOnClickProvision = useCallback(
    async (credentials: AddedCredential[]): Promise<void> => {
      if (
        openClawProvisionInFlight.current ||
        status === OpenClawStatus.USER_NOT_READY
      ) {
        return;
      }

      openClawProvisionInFlight.current = true;
      try {
        await startProvisioning(credentials, false);
        trackAnalytics(product, "Catalog", undefined, "cta");
        markProductAsTried(product);
      } catch (error) {
        handleOpenClawApiError(
          error,
          "Unable to provision your OpenClaw instance",
          `An unexpected error occurred while provisioning your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}.`,
        );
      } finally {
        openClawProvisionInFlight.current = false;
      }
    },
    [
      handleOpenClawApiError,
      markProductAsTried,
      product,
      startProvisioning,
      status,
      trackAnalytics,
    ],
  );

  /**
   * Handles the deletion of the OpenClaw instance once the user signup is
   * available.
   */
  const handleOpenClawDelete = useCallback(async () => {
    if (
      openClawDeleteInFlight.current ||
      status === OpenClawStatus.USER_NOT_READY
    ) {
      return;
    }

    openClawDeleteInFlight.current = true;
    setOpenClawBeingDeleted(true);

    try {
      await deleteInstance();
    } catch (error) {
      handleOpenClawApiError(
        error,
        "Unable to delete your OpenClaw instance",
        `We were unable to delete your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
      );
    } finally {
      openClawDeleteInFlight.current = false;
      setOpenClawBeingDeleted(false);
      setOpenClawDeleteModalOpen(false);
    }
  }, [deleteInstance, handleOpenClawApiError, status]);

  return (
    <>
      <CatalogCard
        product={product}
        statusLabel={statusLabel}
        primaryButtonLabel={buttonLabel}
        isGreenCornerVisible={isGreenCornerVisible}
        isPrimaryButtonDisabled={buttonLabel === ButtonLabel.DELETING}
        isPrimaryButtonSpinnerVisible={
          buttonLabel === ButtonLabel.DELETING ||
          buttonLabel === ButtonLabel.PROVISIONING
        }
        isPrimaryButtonExtIconVisible={
          buttonLabel === ButtonLabel.LAUNCH ||
          (buttonLabel === ButtonLabel.TRY_IT && !!uiURL)
        }
        isDeleteButtonVisible={isDeleteButtonVisible}
        onClickPrimaryButton={handleOnClickPrimaryButton}
        onClickDeleteButton={() => setOpenClawDeleteModalOpen(true)}
      />
      <OpenClawLaunchInfoModal
        isOpen={isOpenClawInfoModalOpen}
        onClose={() => setOpenClawInfoModalOpen(false)}
        product={product}
        provisioningError={provisioningError}
        onLaunch={markProductAsTried}
        onProvisioningErrorDismissed={clearProvisioningError}
        onClickProvision={handleOnClickProvision}
      />

      <OpenClawDeleteInstanceModal
        deletionError={deletionError}
        isOpenClawBeingDeleted={isOpenClawBeingDeleted}
        isOpenClawDeleteModalOpen={isOpenClawDeleteModalOpen}
        onErrorModalClose={clearDeletionError}
        onDeleteModalClose={() => setOpenClawDeleteModalOpen(false)}
        onDeleteButtonClicked={handleOpenClawDelete}
      />
    </>
  );
}
