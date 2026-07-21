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
import { useOpenClawContext } from "../../hooks/OpenClawContext";
import type { Product } from "../../types/product";
import type { AddedCredential } from "../../utils/openclaw-providers";
import { OpenClawStatus } from "../../utils/openclaw-utils";
import {
  CredentialAccordion,
  type CredentialAccordionRef,
} from "./CredentialAccordion";
import { ErrorModal } from "./ErrorModal";

type OpenClawLaunchInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  openClawProvisioningErrorDetails: string | null;
  onLaunch: (product: Product) => void;
  onProvisioningErrorDismissed: () => void;
  onClickProvision: (credentials: AddedCredential[]) => Promise<void>;
  provisioningError?: UserFacingError;
};

export function OpenClawLaunchInfoModal({
  isOpen,
  onClose,
  product,
  openClawProvisioningErrorDetails,
  onLaunch,
  onProvisioningErrorDismissed,
  onClickProvision,
  provisioningError,
}: OpenClawLaunchInfoModalProps) {
  const { openclawStatus, openclawUILink } = useOpenClawContext();

  const accordionRef = useRef<CredentialAccordionRef>(null);
  const [previousStatus, setPreviousStatus] =
    useState<OpenClawStatus>(openclawStatus);
  const [credentialCount, setCredentialCount] = useState(0);
  const [accordionKey, setAccordionKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the form in case that the status of the instance changes to
  // "failed".
  if (previousStatus !== openclawStatus) {
    setPreviousStatus(openclawStatus);
    if (openclawStatus === OpenClawStatus.FAILED) {
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
    if (!credentials || credentials.length === 0) return;

    setIsSubmitting(true);
    try {
      await onClickProvision(credentials);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show an error modal if any error has occurred during provisioning.
  if (provisioningError) {
    return (
      <ErrorModal
        headerTitle="Provision OpenClaw instance"
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

  // Show an error modal if any error has occurred during unidling or
  // resolving the status of the instance.
  if (openClawProvisioningErrorDetails) {
    return (
      <ErrorModal
        headerTitle="Provision OpenClaw instance"
        productName="OpenClaw"
        alertTitle="Unable to provision your OpenClaw instance"
        alertText="An error occurred while provisioning your OpenClaw instance."
        copyableTechnicalDetails={openClawProvisioningErrorDetails}
        isErrorModalOpen
        onErrorModalClose={() => {
          onProvisioningErrorDismissed();
          handleClose();
        }}
      />
    );
  }

  if (openclawStatus === OpenClawStatus.READY) {
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
                  OpenClaw instance provisioned
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
          {openclawUILink ? (
            <Button
              variant="primary"
              component="a"
              href={openclawUILink}
              target="_blank"
              rel="noopener noreferrer"
              icon={<ExternalLinkAltIcon />}
              iconPosition="end"
              onClick={() => {
                onLaunch(product);
              }}
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

  if (openclawStatus === OpenClawStatus.TERMINATING) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        aria-label="Cleaning up previous OpenClaw instance"
        variant="medium"
        data-testid="openclaw-launch-modal"
      >
        <ModalHeader title="Cleaning up previous OpenClaw instance" />
        <ModalBody>
          <Content component="p" style={{ marginBottom: "24px" }}>
            Waiting for the previous instance to be fully removed before
            provisioning a new one.
          </Content>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Spinner size="xl" />
          </div>
          <Alert variant="info" isInline title="You can close this modal">
            Follow the status of your instance on the OpenClaw sandbox card.
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

  if (
    openclawStatus === OpenClawStatus.PROVISIONING ||
    openclawStatus === OpenClawStatus.UNIDLING
  ) {
    const verb =
      openclawStatus === OpenClawStatus.PROVISIONING
        ? "Provisioning"
        : "Reprovisioning";

    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        aria-label={`${verb} your OpenClaw instance`}
        variant="medium"
        data-testid="openclaw-launch-modal"
      >
        <ModalHeader title={`${verb} OpenClaw instance`} />
        <ModalBody>
          <Content component="p" style={{ marginBottom: "24px" }}>
            {verb} is in progress. When ready, your instance will be available
            for use.
          </Content>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Spinner size="xl" />
          </div>
          <Alert variant="info" isInline title={`${verb} can take 1-5 minutes`}>
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
      aria-label="Provision OpenClaw instance"
      variant="medium"
      data-testid="openclaw-launch-modal"
    >
      <ModalHeader title="Provision OpenClaw instance" />
      <ModalBody>
        <Content component="p" style={{ marginBottom: "16px" }}>
          Configure your AI provider credentials to provision an OpenClaw
          instance.
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
              ? "Please add an AI provider credential to provision your OpenClaw instance"
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
            Provision
          </Button>
        </Tooltip>
        <Button variant="link" onClick={handleClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
