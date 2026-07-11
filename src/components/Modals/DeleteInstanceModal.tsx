import {
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import WarningTriangleIcon from "@patternfly/react-icons/dist/esm/icons/warning-triangle-icon";

type DeleteInstanceModalProps = {
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  deleting?: boolean;
};

export function DeleteInstanceModal({
  productName,
  isOpen,
  onClose,
  onDelete,
  deleting = false,
}: DeleteInstanceModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-label={`Delete ${productName} instance`}
      variant="small"
      data-testid="delete-instance-modal"
    >
      <ModalHeader
        title={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <WarningTriangleIcon
              color="var(--pf-t--global--color--status--warning--default)"
              style={{ fontSize: "24px" }}
            />
            Delete instance?
          </span>
        }
      />
      <ModalBody>
        <Content component="p">
          Your {productName} instance will be deleted. Consider backing up your
          work before continuing.
        </Content>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="danger"
          onClick={onDelete}
          isDisabled={deleting}
          isLoading={deleting}
          data-testid="confirm-delete-instance"
        >
          Delete instance
        </Button>
        <Button variant="link" onClick={onClose} isDisabled={deleting}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
