import { AlertVariant } from "@patternfly/react-core";
import { useCallback, useEffect, useRef, useState } from "react";

import { SUPPORT_EMAIL } from "../../const";
import { UserFacingError } from "../../error/UserFacingError";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useNotifications } from "../../hooks/NotificationContext";
import { useOpenClawContext } from "../../hooks/OpenClawContext";
import { usePhoneVerificationContext } from "../../hooks/PhoneVerificationContext";
import { useSignupAction } from "../../hooks/signupAction/SignupActionContext";
import { useUserContext } from "../../hooks/UserContext";
import { UserSignupPhase } from "../../hooks/userSignupPhase";
import type { Product } from "../../types/product";
import logger from "../../utils/logger";
import type { AddedCredential } from "../../utils/openclaw-providers";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import { OpenClawLaunchInfoModal } from "../Modals";
import { OpenClawDeleteInstanceModal } from "../Modals/OpenClawDeleteInstanceModal";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel, StatusColor, type StatusLabel } from "./catalogCardTypes";

/**
 * Obtains the main button's label.
 * @param status the status from which determine the button label.
 * @returns the label of the main button.
 */
function getButtonLabel(status: OpenClawStatus): ButtonLabel {
  switch (status) {
    case OpenClawStatus.INITIAL_FETCH:
      return ButtonLabel.LOADING;

    case OpenClawStatus.USER_NOT_READY:
    case OpenClawStatus.NEW:
    case OpenClawStatus.FAILED:
      return ButtonLabel.SET_UP;

    case OpenClawStatus.PROVISIONING:
      return ButtonLabel.SETTING_UP;

    case OpenClawStatus.UNIDLING:
      return ButtonLabel.RESUMING;

    case OpenClawStatus.READY:
      return ButtonLabel.LAUNCH;

    case OpenClawStatus.IDLED:
      return ButtonLabel.RESUME;

    case OpenClawStatus.DELETING:
      return ButtonLabel.DELETING;

    default:
      return ButtonLabel.TRY_IT;
  }
}

/**
 * Whether the OpenClaw READY handler can run. The connected provider
 * is a NO-OP (`USER_NOT_READY`) until signup finishes, and
 * `INITIAL_FETCH` means the instance status has not been loaded yet.
 */
function canRunOpenClawReadyAction(status: OpenClawStatus): boolean {
  return (
    status !== OpenClawStatus.USER_NOT_READY &&
    status !== OpenClawStatus.INITIAL_FETCH
  );
}

/**
 * Obtains a label, if applicable.
 * @param status the status from which derive the label.
 * @returns a label text and color depending on the given status.
 */
function getStatusLabel(status: OpenClawStatus): StatusLabel | undefined {
  switch (status) {
    case OpenClawStatus.INITIAL_FETCH:
      return { label: "Loading", color: StatusColor.BLUE };
    case OpenClawStatus.PROVISIONING:
      return { label: "Setting up", color: StatusColor.BLUE };
    case OpenClawStatus.READY:
      return { label: "Ready", color: StatusColor.GREEN };
    case OpenClawStatus.IDLED:
      return { label: "Stopped", color: StatusColor.ORANGE };
    case OpenClawStatus.UNIDLING:
      return { label: "Resuming", color: StatusColor.BLUE };
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
  /**
   * Shows or hides the hint in the card that hints that the product
   * has been tried.
   */
  isTriedProductHintVisible: boolean;
  /**
   * Marks the product as "tried".
   * @param product The product to be marked.
   */
  markProductAsTried: (product: Product) => void;
};

export function OpenClawCatalogCard({
  product,
  isTriedProductHintVisible,
  markProductAsTried,
}: OpenClawCatalogCardProps) {
  const { trackProductAction } = useAnalyticsContext();
  const { userSignupPhase } = useUserContext();
  const { isSignupInProgress, signupAndRun, registerAction } =
    useSignupAction();
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

  // Determine the labels and statuses.
  const buttonLabel = getButtonLabel(status);
  const statusLabel = getStatusLabel(status);

  // Determine the status of the interactive buttons.
  const isPrimaryButtonDisabled =
    isSignupInProgress ||
    buttonLabel === ButtonLabel.LOADING ||
    buttonLabel === ButtonLabel.DELETING ||
    userSignupPhase === UserSignupPhase.INITIAL_FETCH;
  const isPrimaryButtonSpinnerVisible =
    buttonLabel === ButtonLabel.LOADING ||
    buttonLabel === ButtonLabel.DELETING ||
    buttonLabel === ButtonLabel.SETTING_UP ||
    buttonLabel === ButtonLabel.RESUMING ||
    userSignupPhase === UserSignupPhase.INITIAL_FETCH;
  const isPrimaryButtonExtIconVisible =
    buttonLabel === ButtonLabel.LAUNCH ||
    (buttonLabel === ButtonLabel.TRY_IT && !!uiURL);
  const isDeleteButtonVisible =
    userSignupPhase !== UserSignupPhase.INITIAL_FETCH &&
    status !== OpenClawStatus.INITIAL_FETCH &&
    status !== OpenClawStatus.USER_NOT_READY &&
    status !== OpenClawStatus.NEW &&
    status !== OpenClawStatus.DELETING &&
    status !== OpenClawStatus.UNIDLING &&
    status !== OpenClawStatus.UNKNOWN;

  /**
   * Routes caught errors to the appropriate notification mechanism:
   * user-facing errors are shown via their own alert, while
   * unexpected exceptions are logged and surfaced as a generic danger
   * notification.
   * @param error the caught exception.
   * @param fallbackTitle the alert title for non-user-facing errors.
   * @param fallbackMessage the alert description for
   *                        non-user-facing errors.
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
   * Once the user signup is ready, it handles opening the OpenClaw
   * instance's URL, resuming the instance if it is stopped, or
   * opens the modal to set it up otherwise.
   */
  const handleReadyPrimaryAction = useCallback(async () => {
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
            "Unable to resume your instance",
            `An unexpected error occurred while resuming your OpenClaw instance. Please try again later, and if the issue persists, contact ${SUPPORT_EMAIL}.`,
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
  }, [handleOpenClawApiError, status, unidleInstance]);

  // Register the action for the OpenClaw catalog card in case the
  // user signup takes longer than expected.
  useEffect(() => {
    registerAction({
      product,
      requiresUserGesture: false,
      canEnable:
        userSignupPhase === UserSignupPhase.READY &&
        canRunOpenClawReadyAction(status),
      onReady: () => {
        void handleReadyPrimaryAction();
      },
    });
  }, [
    handleReadyPrimaryAction,
    product,
    registerAction,
    status,
    userSignupPhase,
  ]);

  /**
   * Routes the catalog primary button through signup continuation or
   * the ready-state OpenClaw actions.
   */
  const handleOnClickPrimaryButton = useCallback(() => {
    switch (userSignupPhase) {
      case UserSignupPhase.NOT_STARTED:
      case UserSignupPhase.SIGNING_UP:
      case UserSignupPhase.PROVISIONING:
        signupAndRun(product.type);
        return;
      case UserSignupPhase.PENDING_PHONE_VERIFICATION:
        openPhoneVerificationModal();
        return;
      case UserSignupPhase.READY:
        void handleReadyPrimaryAction();
        return;
      case UserSignupPhase.BLOCKED:
      default:
        return;
    }
  }, [
    signupAndRun,
    handleReadyPrimaryAction,
    openPhoneVerificationModal,
    product.type,
    userSignupPhase,
  ]);

  /**
   * Handles the provisioning of a new OpenClaw instance once the user
   * signup is available.
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
        await startProvisioning(credentials, true);
        trackProductAction(product, "set-up");
        markProductAsTried(product);
      } catch (error) {
        handleOpenClawApiError(
          error,
          "Unable to set up your OpenClaw instance",
          `An unexpected error occurred while setting up your OpenClaw instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}.`,
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
      trackProductAction,
    ],
  );

  /**
   * Handles the deletion of the OpenClaw instance once the user
   * signup is available.
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
        isTriedProductHintVisible={isTriedProductHintVisible}
        isPrimaryButtonDisabled={isPrimaryButtonDisabled}
        isPrimaryButtonSpinnerVisible={isPrimaryButtonSpinnerVisible}
        isPrimaryButtonExtIconVisible={isPrimaryButtonExtIconVisible}
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
