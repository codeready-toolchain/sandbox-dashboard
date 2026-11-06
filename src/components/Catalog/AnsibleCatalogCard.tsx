import { AlertVariant } from "@patternfly/react-core";
import { useCallback, useEffect, useRef, useState } from "react";

import { SUPPORT_EMAIL } from "../../const";
import { UserFacingError } from "../../error/UserFacingError";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useAnsibleContext } from "../../hooks/AnsibleContext";
import { useNotifications } from "../../hooks/NotificationContext";
import { usePhoneVerificationContext } from "../../hooks/PhoneVerificationContext";
import { useSignupAction } from "../../hooks/signupAction/SignupActionContext";
import { useUserContext } from "../../hooks/UserContext";
import { UserSignupPhase } from "../../hooks/userSignupPhase";
import type { Product } from "../../types/product";
import type { AAPInstanceStatus } from "../../utils/aap-utils";
import logger from "../../utils/logger";
import { AnsibleDeleteInstanceModal, AnsibleLaunchInfoModal } from "../Modals";
import { CatalogCard } from "./CatalogCard";
import { ButtonLabel, StatusColor, type StatusLabel } from "./catalogCardTypes";

/**
 * Obtains the main button's label.
 * @param status the status from which determine the button label.
 * @returns the label of the main button.
 */
function getButtonLabel(status: AAPInstanceStatus): ButtonLabel {
  switch (status.kind) {
    case "initialFetch":
      return ButtonLabel.LOADING;

    case "userNotReady":
    case "new":
    case "notDeployed":
    case "unknown":
    case "error":
      return ButtonLabel.SET_UP;

    case "provisioning":
      return ButtonLabel.SETTING_UP;

    case "unidling":
      return ButtonLabel.RESUMING;

    case "ready":
      return ButtonLabel.LAUNCH;

    case "idled":
      return ButtonLabel.RESUME;

    case "deleting":
    case "deleted":
      return ButtonLabel.DELETING;

    default:
      return ButtonLabel.TRY_IT;
  }
}

/**
 * Whether the Ansible READY handler can run. The connected provider is
 * a NO-OP (`userNotReady`) until signup finishes, and `initialFetch`
 * means the instance status has not been loaded yet.
 */
function canRunAnsibleReadyAction(status: AAPInstanceStatus): boolean {
  return status.kind !== "userNotReady" && status.kind !== "initialFetch";
}

/**
 * Obtains a label, if applicable.
 * @param status the status from which derive the label.
 * @returns a label text and color depending on the given status.
 */
function getStatusLabel(status: AAPInstanceStatus): StatusLabel | undefined {
  switch (status.kind) {
    case "initialFetch":
      return { label: "Loading", color: StatusColor.BLUE };
    case "provisioning":
      return { label: "Setting up", color: StatusColor.BLUE };
    case "unidling":
      return { label: "Resuming", color: StatusColor.BLUE };
    case "ready":
      return { label: "Ready", color: StatusColor.GREEN };
    case "idled":
      return { label: "Stopped", color: StatusColor.ORANGE };
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

export function AnsibleCatalogCard({
  product,
  isTriedProductHintVisible,
  markProductAsTried,
}: AnsibleCatalogCardProps) {
  const { deleteInstance, instanceStatus, provisionInstance, unidleInstance } =
    useAnsibleContext();

  const { userSignupPhase } = useUserContext();
  const { isSignupInProgress, signupAndRun, registerAction } =
    useSignupAction();
  const { addAlert, addAlertFromError } = useNotifications();
  const { openPhoneVerificationModal } = usePhoneVerificationContext();
  const { trackProductAction } = useAnalyticsContext();

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

  // Determine the labels and statuses.
  const buttonLabel = getButtonLabel(instanceStatus);
  const statusLabel = getStatusLabel(instanceStatus);

  // Determine the status of the interactive buttons.
  const isPrimaryButtonDisabled =
    isSignupInProgress ||
    buttonLabel === ButtonLabel.LOADING ||
    buttonLabel === ButtonLabel.DELETING ||
    userSignupPhase === UserSignupPhase.INITIAL_FETCH;
  const isPrimaryButtonSpinnerVisible =
    buttonLabel === ButtonLabel.LOADING ||
    buttonLabel === ButtonLabel.SETTING_UP ||
    buttonLabel === ButtonLabel.RESUMING ||
    buttonLabel === ButtonLabel.DELETING ||
    userSignupPhase === UserSignupPhase.INITIAL_FETCH;
  const isDeleteButtonVisible =
    userSignupPhase !== UserSignupPhase.INITIAL_FETCH &&
    instanceStatus.kind !== "initialFetch" &&
    instanceStatus.kind !== "userNotReady" &&
    instanceStatus.kind !== "new" &&
    instanceStatus.kind !== "notDeployed" &&
    instanceStatus.kind !== "unknown" &&
    instanceStatus.kind !== "deleted";

  /**
   * Once the user signup is ready, it either un-idles or provisions
   * the Ansible instance.
   */
  const handleReadyPrimaryAction = useCallback(async () => {
    switch (instanceStatus.kind) {
      case "userNotReady":
      case "unknown":
      case "deleting":
      case "deleted":
      case "notDeployed":
        return;

      case "ready":
        setAnsibleInfoModalOpen(true);
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
            addAlertFromError(error);
          } else {
            const fallbackError = new UserFacingError(
              "Unable to resume your instance",
              `We were unable to resume your instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
              error,
              `${error}`,
            );
            setProvisioningError(fallbackError);
            addAlertFromError(fallbackError);
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
                "Unable to set up your instance",
                `We were unable to set up your instance. Please try again later, and if the issue persists, please contact ${SUPPORT_EMAIL}`,
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
        trackProductAction(product, "set-up");
        markProductAsTried(product);
    }
  }, [
    addAlertFromError,
    instanceStatus.kind,
    markProductAsTried,
    product,
    provisionInstance,
    trackProductAction,
    unidleInstance,
  ]);

  // Register the action to perform in case the user signup takes
  // longer than anticipated. Basically it will trigger the AAP
  // instance provisioning and open the Ansible information modal.
  useEffect(() => {
    registerAction({
      product,
      requiresUserGesture: false,
      canEnable:
        userSignupPhase === UserSignupPhase.READY &&
        canRunAnsibleReadyAction(instanceStatus),
      onReady: () => {
        void handleReadyPrimaryAction();
      },
    });
  }, [
    handleReadyPrimaryAction,
    instanceStatus,
    product,
    registerAction,
    userSignupPhase,
  ]);

  /**
   * Routes the catalog primary button through signup continuation or
   * the ready-state Ansible actions.
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
   * Clears any errors that are clearable before switching the modal's
   * status to "closed".
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
        isTriedProductHintVisible={isTriedProductHintVisible}
        isPrimaryButtonDisabled={isPrimaryButtonDisabled}
        isPrimaryButtonSpinnerVisible={isPrimaryButtonSpinnerVisible}
        isPrimaryButtonExtIconVisible={false}
        isDeleteButtonVisible={isDeleteButtonVisible}
        onClickPrimaryButton={handleOnClickPrimaryButton}
        onClickDeleteButton={() => setAnsibleDeleteModalOpen(true)}
      />
      <AnsibleLaunchInfoModal
        isOpen={isAnsibleInfoModalOpen}
        onClose={onLaunchInfoModalClose}
        product={product}
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
