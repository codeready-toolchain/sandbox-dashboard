import {
  Alert,
  AlertActionLink,
  Modal,
  ModalBody,
  ModalHeader,
} from "@patternfly/react-core";
import { SUPPORT_EMAIL } from "../../const";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";

export type ErrorModalProps = {
  /** The modal header's title. */
  headerTitle: string;
  /** The name of the product for the `data-testid` field. */
  productName: string;
  /** The title of the alert. */
  alertTitle: string;
  /** The main text of the alert. */
  alertText: string;
  /** The technical details to be copied to the clipboard. */
  copyableTechnicalDetails?: string;
  /** Controls whether the modal is open or not. */
  isErrorModalOpen: boolean;
  /** Handler function for when the modal closes. */
  onErrorModalClose: () => void;
};

/**
 * An error modal with a link that copies the error details to the clipboard.
 */
export function ErrorModal({
  headerTitle,
  productName,
  alertTitle,
  alertText,
  copyableTechnicalDetails,
  isErrorModalOpen,
  onErrorModalClose,
}: ErrorModalProps) {
  const { copyToClipboard, copyToClipboardLabel } = useCopyToClipboard(
    copyableTechnicalDetails,
  );

  const fullAlertText = copyableTechnicalDetails
    ? `${alertText} Please copy the technical details and contact ${SUPPORT_EMAIL} for support.`
    : alertText;

  return (
    <Modal
      isOpen={isErrorModalOpen}
      onClose={onErrorModalClose}
      aria-label={headerTitle}
      variant="small"
      data-testid={`${productName}-error-modal`}
    >
      <ModalHeader title={headerTitle} />
      <ModalBody>
        <Alert
          variant="danger"
          isInline
          isPlain
          title={alertTitle}
          actionLinks={
            copyableTechnicalDetails && (
              <AlertActionLink onClick={copyToClipboard}>
                {copyToClipboardLabel}
              </AlertActionLink>
            )
          }
          data-testid={`${productName}-error`}
        >
          {fullAlertText}
        </Alert>
      </ModalBody>
    </Modal>
  );
}
