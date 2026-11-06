import {
  Alert,
  Button,
  Content,
  Flex,
  FlexItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tooltip,
} from "@patternfly/react-core";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import { useRef, useState } from "react";

import type { UserFacingError } from "../../error/UserFacingError";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useOpenClawContext } from "../../hooks/OpenClawContext";
import type { Product } from "../../types/product";
import type { AddedCredential } from "../../utils/openclaw-providers";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import { catalogProductOpenAttributes } from "../Catalog/productData";
import {
  CredentialAccordion,
  type CredentialAccordionRef,
} from "./CredentialAccordion";
import { ErrorModal } from "./ErrorModal";

type OpenClawLaunchInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  provisioningError?: UserFacingError;
  onLaunch: (product: Product) => void;
  onProvisioningErrorDismissed: () => void;
  onClickProvision: (credentials: AddedCredential[]) => Promise<void>;
};

export function OpenClawLaunchInfoModal({
  isOpen,
  onClose,
  product,
  provisioningError,
  onLaunch,
  onProvisioningErrorDismissed,
  onClickProvision,
}: OpenClawLaunchInfoModalProps) {
  const { trackProductAction } = useAnalyticsContext();
  const { status, uiURL } = useOpenClawContext();

  const accordionRef = useRef<CredentialAccordionRef>(null);
  const [previousStatus, setPreviousStatus] = useState<OpenClawStatus>(status);
  const [credentialCount, setCredentialCount] = useState(0);
  const [accordionKey, setAccordionKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the form in case that the status of the instance changes to
  // "failed".
  if (previousStatus !== status) {
    setPreviousStatus(status);
    if (status === OpenClawStatus.FAILED) {
      setCredentialCount(0);
      setAccordionKey((k) => k + 1);
    }
  }

  // Resets the form whe the modal is closed.
  const handleClose = () => {
    setCredentialCount(0);
    setAccordionKey((k) => k + 1);
    onClose();
  };

  // Make sure the credentials are there before delegating the handle to the
  // parent component.
  const handleOnClickProvision = async () => {
    const credentials = accordionRef.current?.getValidatedCredentials();
    if (!credentials || credentials.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onClickProvision(credentials);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show an error modal if any error has occurred during the provisioning or
  // the unidling of the instance. A failed resume moves the instance to
  // FAILED, so the error title is what still identifies that action.
  if (provisioningError) {
    const isResumeFailure =
      provisioningError.title === "Unable to resume your OpenClaw instance";
    const headerTitle =
      status === OpenClawStatus.IDLED ||
      status === OpenClawStatus.UNIDLING ||
      isResumeFailure
        ? "Resume OpenClaw instance"
        : "Set up OpenClaw instance";

    return (
      <ErrorModal
        headerTitle={headerTitle}
        productName="OpenClaw"
        alertTitle={provisioningError.title}
        alertText={provisioningError.detail}
        copyableTechnicalDetails={provisioningError.technicalDetails}
        isErrorModalOpen
        onErrorModalClose={() => {
          onProvisioningErrorDismissed();
          handleClose();
        }}
      />
    );
  }

  if (status === OpenClawStatus.READY) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        aria-label="OpenClaw instance ready"
        variant="medium"
        data-testid="openclaw-launch-modal"
      >
        <ModalHeader
          title={
            <Flex
              alignItems={{ default: "alignItemsFlexStart" }}
              gap={{ default: "gapSm" }}
            >
              <FlexItem>
                <CheckCircleIcon
                  color="var(--pf-t--global--color--status--success--default)"
                  style={{ fontSize: "28px", marginTop: "2px" }}
                />
              </FlexItem>
              <FlexItem>
                <span style={{ fontSize: "24px", fontWeight: 700 }}>
                  OpenClaw instance is ready
                </span>
              </FlexItem>
            </Flex>
          }
        />
        <ModalBody>
          <Content component="p">
            Your OpenClaw instance is ready to use.
          </Content>
        </ModalBody>
        <ModalFooter>
          {uiURL ? (
            <Button
              variant="primary"
              component="a"
              href={uiURL}
              target="_blank"
              rel="noopener noreferrer"
              icon={<ExternalLinkAltIcon />}
              iconPosition="end"
              onClick={() => {
                trackProductAction(product, "opened", uiURL);
                onLaunch(product);
              }}
              {...catalogProductOpenAttributes(product)}
              data-testid="openclaw-launch-button"
            >
              Launch
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                onLaunch(product);
              }}
            >
              Launch
            </Button>
          )}
        </ModalFooter>
      </Modal>
    );
  }

  if (
    status === OpenClawStatus.PROVISIONING ||
    status === OpenClawStatus.UNIDLING
  ) {
    const progressLabel =
      status === OpenClawStatus.PROVISIONING ? "Setting up" : "Resuming";

    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        aria-label={`${progressLabel} your OpenClaw instance`}
        variant="medium"
        data-testid="openclaw-launch-modal"
      >
        <ModalHeader title={`${progressLabel} OpenClaw instance`} />
        <ModalBody>
          <Content component="p" style={{ marginBottom: "24px" }}>
            {progressLabel} is in progress. When ready, your instance will be
            available for use.
          </Content>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Spinner size="xl" />
          </div>
          <Alert
            variant="info"
            isInline
            title={`${progressLabel} can take 1-5 minutes`}
          >
            You can close this modal in the meantime, and follow the status of
            your instance on the OpenClaw sandbox card.
          </Alert>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={handleClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      aria-label="Set up OpenClaw instance"
      variant="medium"
      data-testid="openclaw-launch-modal"
    >
      <ModalHeader title="Set up OpenClaw instance" />
      <ModalBody>
        <Content component="p" style={{ marginBottom: "16px" }}>
          Configure your AI provider credentials to set up an OpenClaw instance.
        </Content>
        <CredentialAccordion
          key={accordionKey}
          ref={accordionRef}
          onCredentialCountChange={setCredentialCount}
        />
      </ModalBody>
      <ModalFooter>
        <Tooltip
          content={
            credentialCount === 0
              ? "Please add an AI provider credential to set up your OpenClaw instance"
              : ""
          }
          trigger={credentialCount === 0 ? "mouseenter" : "manual"}
        >
          <Button
            variant="primary"
            onClick={handleOnClickProvision}
            isDisabled={credentialCount === 0}
            isLoading={isSubmitting}
            data-testid="openclaw-provision-button"
          >
            Set up
          </Button>
        </Tooltip>
        <Button variant="link" onClick={handleClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
