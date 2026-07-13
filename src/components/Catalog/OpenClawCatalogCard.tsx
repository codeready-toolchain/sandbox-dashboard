import { AlertVariant } from "@patternfly/react-core";
import { useCallback, useRef, useState } from "react";
import { UserFacingError } from "../../error/UserFacingError";
import { useOpenClawContext } from "../../hooks/OpenClawContext";
import { useUserContext } from "../../hooks/UserContext";
import { useNotifications } from "../../notifications/useNotifications";
import type { Product } from "../../types/product";
import logger from "../../utils/logger";
import type { AddedCredential } from "../../utils/openclaw-providers";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import { OpenClawLaunchInfoModal } from "../Modals";
import { OpenClawDeleteInstanceModal } from "../Modals/OpenClawDeletInstanceModal";
import { CatalogCard } from "./CatalogCard";
import type { EnsureUserIsReadyResult } from "./catalogCardTypes";
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
      return ButtonLabel.PROVISIONING;

    case OpenClawStatus.READY:
      return ButtonLabel.LAUNCH;

    case OpenClawStatus.IDLED:
      return ButtonLabel.REPROVISION;

    case OpenClawStatus.TERMINATING:
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
    case OpenClawStatus.TERMINATING:
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
   * Function to make sure that the user signup is ready before attempting to
   * manage any OpenClaw instances.
   */
  ensureUserIsReady: () => Promise<EnsureUserIsReadyResult>;
  /**
   * Marks the product as "tried".
   * @param product The product to be marked.
   */
  markProductAsTried: (product: Product) => void;
};

export function OpenClawCatalogCard({
  product,
  isGreenCornerVisible,
  ensureUserIsReady,
  markProductAsTried,
}: OpenClawCatalogCardProps) {
  const { userData } = useUserContext();
  const {
    deleteOpenClaw,
    handleOpenClawInstance,
    openclawStatus,
    openclawUILink,
    openClawDeletionErrorDetails,
    openClawProvisioningErrorDetails,
    resetOpenClawDeletionErrorDetails,
    resetOpenClawProvisioningErrorDetails,
  } = useOpenClawContext();

  const { addAlert, addAlertFromError } = useNotifications();

  const defaultUserNamespace = userData?.defaultUserNamespace;

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
  const buttonLabel = getButtonLabel(openclawStatus);
  const statusLabel = getStatusLabel(openclawStatus);
  const isDeleteButtonVisible =
    openclawStatus !== OpenClawStatus.NEW &&
    openclawStatus !== OpenClawStatus.DELETING &&
    openclawStatus !== OpenClawStatus.TERMINATING &&
    openclawStatus !== OpenClawStatus.UNKNOWN &&
    Boolean(userData?.proxyURL && defaultUserNamespace);

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
    const isUserReady = await ensureUserIsReady();
    if (!isUserReady.ready) {
      return;
    }

    switch (openclawStatus) {
      case OpenClawStatus.READY:
        setOpenClawInfoModalOpen(true);
        return;
      case OpenClawStatus.IDLED:
        if (!defaultUserNamespace || openClawUnidleInFlight.current) {
          return;
        }

        openClawUnidleInFlight.current = true;
        try {
          await handleOpenClawInstance(defaultUserNamespace);
        } catch (error) {
          handleOpenClawApiError(
            error,
            "OpenClaw operation failed",
            "An unexpected error occurred while handling your OpenClaw instance. Please try again later.",
          );
        } finally {
          openClawUnidleInFlight.current = false;
        }
        return;
      case OpenClawStatus.PROVISIONING:
      case OpenClawStatus.TERMINATING:
        setOpenClawInfoModalOpen(true);
        return;
      default:
        setOpenClawInfoModalOpen(true);
    }
  }, [
    ensureUserIsReady,
    handleOpenClawApiError,
    handleOpenClawInstance,
    openclawStatus,
    defaultUserNamespace,
  ]);

  /**
   * Handles the provisioning of a new OpenClaw instance once the user signup
   * is available.
   */
  const handleOpenClawProvision = useCallback(
    async (credentials: AddedCredential[]): Promise<boolean> => {
      if (!defaultUserNamespace) {
        return false;
      }

      if (openClawProvisionInFlight.current) {
        return false;
      }

      openClawProvisionInFlight.current = true;
      try {
        const success = await handleOpenClawInstance(
          defaultUserNamespace,
          credentials,
          false,
        );

        if (success) {
          markProductAsTried(product);
        }

        return success;
      } catch (error) {
        handleOpenClawApiError(
          error,
          "OpenClaw provisioning failed",
          "An unexpected error occurred while provisioning your OpenClaw instance. Please try again later.",
        );
        return false;
      } finally {
        openClawProvisionInFlight.current = false;
      }
    },
    [
      defaultUserNamespace,
      handleOpenClawApiError,
      handleOpenClawInstance,
      markProductAsTried,
      product,
    ],
  );

  /**
   * Handles the deletion of the OpenClaw instance once the user signup is
   * available.
   */
  const handleOpenClawDelete = useCallback(async () => {
    if (!defaultUserNamespace) {
      return;
    }

    if (openClawDeleteInFlight.current) {
      return;
    }

    openClawDeleteInFlight.current = true;
    setOpenClawBeingDeleted(true);

    try {
      await deleteOpenClaw(defaultUserNamespace);
    } catch (error) {
      handleOpenClawApiError(
        error,
        "OpenClaw deletion failed",
        "An unexpected error occurred while deleting your OpenClaw instance. Please try again later.",
      );
    } finally {
      openClawDeleteInFlight.current = false;
      setOpenClawBeingDeleted(false);
      setOpenClawDeleteModalOpen(false);
    }
  }, [deleteOpenClaw, defaultUserNamespace, handleOpenClawApiError]);

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
          (buttonLabel === ButtonLabel.TRY_IT && !!openclawUILink)
        }
        isDeleteButtonVisible={isDeleteButtonVisible}
        onClickPrimaryButton={handleOnClickPrimaryButton}
        onClickDeleteButton={() => setOpenClawDeleteModalOpen(true)}
      />
      {userData?.proxyURL && userData?.defaultUserNamespace && (
        <>
          <OpenClawLaunchInfoModal
            isOpen={isOpenClawInfoModalOpen}
            onClose={() => setOpenClawInfoModalOpen(false)}
            product={product}
            openclawStatus={openclawStatus}
            openclawUILink={openclawUILink}
            openClawProvisioningErrorDetails={openClawProvisioningErrorDetails}
            onProvision={handleOpenClawProvision}
            onLaunch={markProductAsTried}
            onProvisioningErrorDismissed={resetOpenClawProvisioningErrorDetails}
          />

          <OpenClawDeleteInstanceModal
            isOpenClawBeingDeleted={isOpenClawBeingDeleted}
            isOpenClawDeleteModalOpen={isOpenClawDeleteModalOpen}
            onErrorModalClose={resetOpenClawDeletionErrorDetails}
            openClawDeletionErrorDetails={openClawDeletionErrorDetails}
            onDeleteModalClose={() => setOpenClawDeleteModalOpen(false)}
            onDeleteButtonClicked={handleOpenClawDelete}
          />
        </>
      )}
    </>
  );
}
