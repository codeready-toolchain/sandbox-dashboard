import {
  Button,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";

import { ButtonLabel } from "../Catalog/catalogCardTypes";

/**
 * Defines the properties for the signup-in-progress continuation modal.
 */
export type SignupInProgressModalProps = {
  /** Controls whether the modal is visible. */
  isOpen: boolean;
  /** Closes the modal without running the original catalog CTA. */
  onClose: () => void;
  /** Label copied from the catalog card that started signup. */
  buttonLabel: ButtonLabel;
  /** Enables the footer button once the original CTA can run. */
  isActionEnabled: boolean;
  /** Runs the original catalog CTA (open URL, provision, or settings). */
  onContinue: () => void;
};

/**
 * Shown when a catalog primary click started signup but the user
 * gesture expired before the account became `READY`. The footer button
 * stays disabled until the original action can run, then a fresh click
 * resumes it.
 */
export function SignupInProgressModal({
  isOpen,
  onClose,
  buttonLabel,
  isActionEnabled,
  onContinue,
}: SignupInProgressModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-label="User signup is in progress"
      variant="small"
    >
      <ModalHeader title="User signup is in progress" />
      <ModalBody>
        <Content component="p">
          We are setting up your Developer Sandbox access. This can take a few
          moments.
        </Content>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="secondary"
          onClick={onContinue}
          isDisabled={!isActionEnabled}
          isLoading={!isActionEnabled}
          icon={
            buttonLabel === ButtonLabel.TRY_IT ? (
              <ExternalLinkAltIcon />
            ) : undefined
          }
          iconPosition="end"
        >
          {buttonLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
