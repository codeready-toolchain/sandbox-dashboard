import {
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import { useState } from "react";
import { deleteAAPCR } from "../../api/aap";
import {
  deletePVCsForSTS,
  deleteSecretsAndPVCs,
  getDeployments,
  getStatefulSets,
} from "../../api/kube";
import { ApiError } from "../../error/ApiError";
import { DeletionError } from "../../error/DeletionError";
import logger from "../../utils/logger";
import { ErrorModal } from "./ErrorModal";

type AnsibleDeleteInstanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  proxyURL: string;
  userNamespace: string;
};

const AAP_LABEL_SELECTOR = "app.kubernetes.io/managed-by=aap-operator";

export function AnsibleDeleteInstanceModal({
  isOpen,
  onClose,
  onDeleted,
  proxyURL,
  userNamespace,
}: AnsibleDeleteInstanceModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  /**
   * Deletes the Ansible Automation Platform and all of its related resources.
   */
  const handleDelete = async () => {
    setDeleting(true);
    setDeletionError(null);

    try {
      // Get the related resources we might have to delete.
      const [deployments, statefulSets] = await Promise.all([
        getDeployments(proxyURL, userNamespace, AAP_LABEL_SELECTOR),
        getStatefulSets(proxyURL, userNamespace, AAP_LABEL_SELECTOR),
      ]);

      // Delete AAP itself.
      await deleteAAPCR(proxyURL, userNamespace);

      // Delete all the related resources and capture the results and any
      // errors via "allSettled".
      const cleanupResults = await Promise.allSettled([
        deleteSecretsAndPVCs(proxyURL, deployments, userNamespace),
        deleteSecretsAndPVCs(proxyURL, statefulSets, userNamespace),
        deletePVCsForSTS(proxyURL, statefulSets, userNamespace),
      ]);

      // Prepare the error structure so that the user can copy it nicely
      // for support.
      const cleanupError = DeletionError.fromSettledResults(
        "Ansible Automation Platform",
        [
          "Delete deployment secrets/PVCs",
          "Delete statefulset secrets/PVCs",
          "Delete statefulset PVCs",
        ],
        cleanupResults,
      );

      onDeleted();

      if (cleanupError) {
        setDeletionError(cleanupError.toString());
        return;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setDeletionError(`${err.statusCode} ${err.body}`);
      } else {
        logger.error(
          "Unexpected exception occurred when deleting the AAP instance:",
          err,
        );
        setDeletionError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setDeletionError(null);
    onClose();
  };

  if (deletionError) {
    return (
      <ErrorModal
        headerTitle="Delete AAP instance"
        productName="ansible-automation-platform"
        alertTitle="Unable to delete your Ansible Automation Platform instance"
        alertText="An error occurred while deleting your Ansible Automation Platform instance."
        copyableTechnicalDetails={deletionError}
        isErrorModalOpen
        onErrorModalClose={handleClose}
      />
    );
  }

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
          isDisabled={deleting || !!deletionError}
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
