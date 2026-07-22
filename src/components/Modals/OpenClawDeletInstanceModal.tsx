import type { UserFacingError } from "../../error/UserFacingError";
import { DeleteInstanceModal } from "./DeleteInstanceModal";
import { ErrorModal } from "./ErrorModal";

/**
 * The properties for the modals.
 */
export type OpenClawDeleteInstanceModalProps = {
  /** The deletion error details. */
  deletionError?: UserFacingError;
  /** Signals if OpenClaw is currently being deleted. */
  isOpenClawBeingDeleted: boolean;
  /** SIgnals if the delete modal should be open. */
  isOpenClawDeleteModalOpen: boolean;
  /** Function to execute when the delete button is clicked. */
  onDeleteButtonClicked: () => void;
  /** Function to execute when the error modal closes. */
  onErrorModalClose: () => void;
  /** Function to execute when the delete modal closes. */
  onDeleteModalClose: () => void;
};

/**
 * A deletion instance modal or an error one if there is any to report.
 */
export function OpenClawDeleteInstanceModal({
  deletionError,
  isOpenClawBeingDeleted,
  isOpenClawDeleteModalOpen,
  onDeleteButtonClicked,
  onErrorModalClose,
  onDeleteModalClose,
}: OpenClawDeleteInstanceModalProps) {
  if (deletionError) {
    return (
      <ErrorModal
        headerTitle="Delete OpenClaw instance"
        productName="OpenClaw"
        alertTitle={deletionError.title}
        alertText={deletionError.detail}
        copyableTechnicalDetails={deletionError.technicalDetails}
        isErrorModalOpen
        onErrorModalClose={onErrorModalClose}
      />
    );
  }

  return (
    <DeleteInstanceModal
      productName="OpenClaw"
      isOpen={isOpenClawDeleteModalOpen}
      onClose={onDeleteModalClose}
      onDelete={onDeleteButtonClicked}
      deleting={isOpenClawBeingDeleted}
    />
  );
}
