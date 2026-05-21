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
import { resetWorkspaces } from "../../api/registration";
import { errorMessage } from "../../utils/common";

type WorkspaceResetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
};

type ResetStage = "initial" | "confirmed" | "submitting";

export function WorkspaceResetModal({
  isOpen,
  onClose,
  onReset,
}: WorkspaceResetModalProps) {
  const [stage, setStage] = useState<ResetStage>("initial");
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStage("initial");
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleClick = async () => {
    if (stage === "initial") {
      setStage("confirmed");
      return;
    }

    if (stage === "confirmed") {
      setStage("submitting");
      setError(null);
      try {
        await resetWorkspaces();
        resetState();
        onReset();
      } catch (err) {
        setError(errorMessage(err));
        setStage("confirmed");
      }
    }
  };

  const buttonLabel = () => {
    switch (stage) {
      case "initial":
        return "I understand and I want to reset";
      case "confirmed":
        return "Reset my workspaces";
      case "submitting":
        return "Resetting...";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      aria-label="Reset workspaces"
      variant="small"
      data-testid="workspace-reset-modal"
    >
      <ModalHeader title="Reset Workspaces" />
      <ModalBody>
        {error && (
          <Alert
            variant="danger"
            isInline
            isPlain
            title={error}
            style={{ marginBottom: "16px" }}
            data-testid="workspace-reset-error"
          />
        )}
        <Content component="p">
          This will delete all your workspaces, projects, and data in your
          Developer Sandbox. This action cannot be undone.
        </Content>
        {stage !== "initial" && (
          <Alert
            variant="warning"
            isInline
            title="You are about to delete all your data"
            style={{ marginTop: "16px" }}
          >
            All projects and resources in your namespace will be permanently
            deleted.
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          key="reset"
          variant="danger"
          onClick={handleClick}
          isDisabled={stage === "submitting"}
          isLoading={stage === "submitting"}
          data-testid="workspace-reset-button"
        >
          {buttonLabel()}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={stage === "submitting"}
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
