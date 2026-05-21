import { useState } from "react";
import {
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Button,
  Content,
  Alert,
} from "@patternfly/react-core";
import { deleteAAPCR } from "../../api/aap";
import {
  getDeployments,
  getStatefulSets,
  deleteSecretsAndPVCs,
  deletePVCsForSTS,
} from "../../api/kube";
import { errorMessage } from "../../utils/common";

type AnsibleDeleteInstanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  proxyURL: string;
  userNamespace: string;
};

const AAP_LABEL_SELECTOR = "app.kubernetes.io%2Fmanaged-by%3Daap-operator";

export function AnsibleDeleteInstanceModal({
  isOpen,
  onClose,
  onDeleted,
  proxyURL,
  userNamespace,
}: AnsibleDeleteInstanceModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const [deployments, statefulSets] = await Promise.all([
        getDeployments(proxyURL, userNamespace, AAP_LABEL_SELECTOR),
        getStatefulSets(proxyURL, userNamespace, AAP_LABEL_SELECTOR),
      ]);

      await deleteAAPCR(proxyURL, userNamespace);

      await Promise.all([
        deleteSecretsAndPVCs(proxyURL, deployments, userNamespace),
        deleteSecretsAndPVCs(proxyURL, statefulSets, userNamespace),
        deletePVCsForSTS(proxyURL, statefulSets, userNamespace),
      ]);

      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      aria-label="Delete Ansible Automation Platform instance"
      variant="small"
      data-testid="ansible-delete-modal"
    >
      <ModalHeader title="Delete AAP Instance" />
      <ModalBody>
        {error && (
          <Alert
            variant="danger"
            isInline
            isPlain
            title={error}
            style={{ marginBottom: "16px" }}
            data-testid="ansible-delete-error"
          />
        )}
        <Content component="p">
          Are you sure you want to delete your Ansible Automation Platform
          instance? This action cannot be undone and all AAP data will be lost.
        </Content>
      </ModalBody>
      <ModalFooter>
        <Button
          key="delete"
          variant="danger"
          onClick={handleDelete}
          isDisabled={deleting}
          isLoading={deleting}
          data-testid="confirm-delete-aap"
        >
          {deleting ? "Deleting..." : "Delete"}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={deleting}
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
