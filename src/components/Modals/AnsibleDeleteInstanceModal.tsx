import {
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import { UserFacingError } from "../../error/UserFacingError";
import { useAnsibleContext } from "../../hooks/AnsibleContext";
import { ErrorModal } from "./ErrorModal";

type AnsibleDeleteInstanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onClickDelete: () => void;
  deletionError?: UserFacingError;
};

export function AnsibleDeleteInstanceModal({
  isOpen,
  onClose,
  onClickDelete,
  deletionError,
}: AnsibleDeleteInstanceModalProps) {
  const { instanceStatus } = useAnsibleContext();

  const isDeleting = instanceStatus.kind === "deleting";

  if (deletionError) {
    return (
      <ErrorModal
        headerTitle="Delete AAP instance"
        productName="ansible-automation-platform"
        alertTitle={deletionError.title}
        alertText={deletionError.detail}
        copyableTechnicalDetails={deletionError.technicalDetails}
        isErrorModalOpen
        onErrorModalClose={onClose}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-label="Delete Ansible Automation Platform instance"
      variant="small"
      data-testid="ansible-delete-modal"
    >
      <ModalHeader title="Delete AAP Instance" />
      <ModalBody>
        <Content component="p">
          Are you sure you want to delete your Ansible Automation Platform
          instance? This action cannot be undone and all AAP data will be lost.
        </Content>
      </ModalBody>
      <ModalFooter>
        <Button
          key="delete"
          variant="danger"
          onClick={onClickDelete}
          isDisabled={isDeleting || !!deletionError}
          isLoading={isDeleting}
          data-testid="confirm-delete-aap"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={onClose}
          isDisabled={isDeleting}
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
