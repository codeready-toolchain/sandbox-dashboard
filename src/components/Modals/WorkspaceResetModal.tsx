import {
  Alert,
  AlertActionLink,
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import { useRef, useState } from "react";
import { resetWorkspaces } from "../../api/registration";
import { SUPPORT_EMAIL } from "../../const";
import { ApiError } from "../../error/ApiError";
import { errorMessage } from "../../utils/common";
import logger from "../../utils/logger";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";

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
  const [technicalDetails, setTechnicalDetails] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const resetState = () => {
    setStage("initial");
    setError(null);
    setTechnicalDetails(null);
  };

  const { copyToClipboard, copyToClipboardLabel } =
    useCopyToClipboard(technicalDetails);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleClick = async () => {
    if (inFlightRef.current) {
      return;
    }

    if (stage === "initial") {
      setStage("confirmed");
      return;
    }

    if (stage === "confirmed") {
      inFlightRef.current = true;
      setStage("submitting");
      setError(null);
      try {
        await resetWorkspaces();
        resetState();
        onReset();
      } catch (err) {
        if (!(err instanceof ApiError)) {
          logger.error("Unexpected error resetting workspaces:", err);
        }
        setError(
          `Unable to reset your workspaces. Please, try again later, and if your issue persists, contact support at ${SUPPORT_EMAIL}`,
        );
        if (err instanceof ApiError) {
          setTechnicalDetails(`${err.statusCode} ${err.body}`);
        } else {
          setTechnicalDetails(errorMessage(err));
        }
        setStage("confirmed");
      } finally {
        inFlightRef.current = false;
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
            actionLinks={
              technicalDetails && (
                <AlertActionLink onClick={copyToClipboard}>
                  {copyToClipboardLabel}
                </AlertActionLink>
              )
            }
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
