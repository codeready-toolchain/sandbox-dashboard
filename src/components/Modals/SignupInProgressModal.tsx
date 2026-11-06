import {
  Button,
  Content,
  ContentVariants,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";

import type { DpalClickAttributes } from "../../utils/analytics";

/**
 * Defines the properties for the signup continuation modal.
 */
export type SignupInProgressModalProps = {
  /** Controls whether the modal is visible. */
  isOpen: boolean;
  /** Closes the modal without running the original catalog CTA. */
  onClose: () => void;
  /** Product title shown in the continuation button. */
  productTitle: string;
  /** Enables the footer button once the original CTA can run. */
  isActionEnabled: boolean;
  /**
   * Adobe attributes for the continuation click. Present only when
   * that click opens a product URL.
   */
  clickAnalytics?: DpalClickAttributes;
  /** Runs the original catalog CTA (open URL). */
  onContinue: () => void;
};

/**
 * Shown when a catalog primary click started signup but the user gesture
 * expired before the account became `READY`. While signup is still running the
 * modal shows a progress message. Once the account is ready it switches to a
 * completion message and enables the product button.
 *
 * Only products whose action requires a user gesture, like opening a link in
 * a new tab go through this modal. Stateful products like AAP and OpenClaw
 * auto-execute instead.
 */
export function SignupInProgressModal({
  isOpen,
  onClose,
  productTitle,
  isActionEnabled,
  clickAnalytics,
  onContinue,
}: SignupInProgressModalProps) {
  const title = isActionEnabled ? "Signup completed" : "Signup in progress";
  const description = isActionEnabled
    ? "Your Developer Sandbox account is ready. " +
      "Click the button below to get started with the product you selected."
    : "We are setting up your Developer Sandbox " +
      "access. This can take a few moments.";

  return (
    <Modal isOpen={isOpen} onClose={onClose} aria-label={title} variant="small">
      <ModalHeader title={title} />
      <ModalBody>
        <Content component={ContentVariants.p}>{description}</Content>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="secondary"
          onClick={onContinue}
          isDisabled={!isActionEnabled}
          isLoading={!isActionEnabled}
          icon={<ExternalLinkAltIcon />}
          iconPosition="end"
          {...clickAnalytics}
        >
          {`Try ${productTitle}`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
