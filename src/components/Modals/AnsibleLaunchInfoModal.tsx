import {
  Button,
  ClipboardCopy,
  Content,
  Flex,
  FlexItem,
  InputGroup,
  InputGroupItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextInput,
  Tooltip,
} from "@patternfly/react-core";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import CopyIcon from "@patternfly/react-icons/dist/esm/icons/copy-icon";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import EyeIcon from "@patternfly/react-icons/dist/esm/icons/eye-icon";
import EyeSlashIcon from "@patternfly/react-icons/dist/esm/icons/eye-slash-icon";
import { useEffect, useRef, useState } from "react";
import AnsibleIcon from "../../assets/logos/ansible.svg";
import RedHatLogo from "../../assets/logos/red_hat_logo.svg";
import { SUPPORT_EMAIL } from "../../const";
import { UserFacingError } from "../../error/UserFacingError";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useAnsibleContext } from "../../hooks/AnsibleContext";
import type { AAPInstanceCredentials } from "../../types";
import { ErrorModal } from "./ErrorModal";

type AnsibleLaunchInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  provisioningError?: UserFacingError;
};

/**
 * Defines the state of the instance's credentials' fetching in the modal.
 */
type InstanceCredentialsStatus =
  | { kind: "unfetched" }
  | { kind: "ready"; credentials: AAPInstanceCredentials }
  | { kind: "error"; errorMessage: string };

function PasswordField({ password }: { password: string }) {
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePasswordCopy = () => {
    setPasswordCopied(true);
    navigator.clipboard.writeText(password);
  };

  return (
    <InputGroup>
      <InputGroupItem isFill>
        <TextInput
          value={showPassword ? password : "*".repeat(25)}
          readOnlyVariant="default"
          aria-label="Password"
          data-testid="ansible-password-field"
        />
      </InputGroupItem>
      <InputGroupItem>
        <Tooltip
          content={passwordCopied ? "Password copied!" : "Copy password"}
          onTooltipHidden={() => setPasswordCopied(false)}
          exitDelay={1500}
          entryDelay={300}
        >
          <Button
            variant="control"
            onClick={handlePasswordCopy}
            aria-label="Copy password"
            data-testid="copy-password"
          >
            <CopyIcon />
          </Button>
        </Tooltip>
      </InputGroupItem>
      <InputGroupItem>
        <Tooltip content={showPassword ? "Hide password" : "Show password"}>
          <Button
            variant="control"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label="Show password"
            data-testid="toggle-password-visibility"
          >
            {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
          </Button>
        </Tooltip>
      </InputGroupItem>
    </InputGroup>
  );
}

export function AnsibleLaunchInfoModal({
  isOpen,
  onClose,
  provisioningError,
}: AnsibleLaunchInfoModalProps) {
  const { trackAnalytics } = useAnalyticsContext();
  const { fetchInstanceCredentials, instanceStatus } = useAnsibleContext();

  // Keep track of the status of the instance credentials' fecthing to show
  // proper feedback to the user.
  const [instanceCredentialsStatus, setInstanceCredentialsStatus] =
    useState<InstanceCredentialsStatus>({ kind: "unfetched" });

  // Guard to avoid having multiple credentials' fetching requests.
  const isFetchingCredentials = useRef(false);

  // Helper variables for determining when we should fetch the instance's
  // credentials and which content we should be showing to the user.
  const isInstanceBeingProvisioned: boolean =
    instanceStatus.kind === "provisioning" ||
    instanceStatus.kind === "new" ||
    instanceStatus.kind === "idled";
  const isInstanceBeingUnidled: boolean = instanceStatus.kind === "unidling";
  const isInstanceReady =
    instanceStatus.kind === "ready" &&
    instanceCredentialsStatus.kind === "ready";
  const isCredentialsLoading =
    isOpen &&
    instanceStatus.kind === "ready" &&
    instanceCredentialsStatus.kind === "unfetched";

  // Track previous prop values so we can detect changes during render and
  // reset credential state. This uses React's "store previous props" pattern
  // because the project's lint rules forbid calling setState inside effects
  // (react-hooks/set-state-in-effect) and writing to refs during render
  // (react-hooks/refs), so the work is split across the render body (state)
  // and a small effect (ref).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevStatusKind, setPrevStatusKind] = useState(instanceStatus.kind);

  // When the modal closes or the instance status moves away from "ready",
  // reset credential state to "unfetched" so a subsequent reopen starts a
  // fresh fetch instead of showing stale credentials or errors.
  if (isOpen !== prevIsOpen || instanceStatus.kind !== prevStatusKind) {
    setPrevIsOpen(isOpen);
    setPrevStatusKind(instanceStatus.kind);
    if (!isOpen || instanceStatus.kind !== "ready") {
      setInstanceCredentialsStatus({ kind: "unfetched" });
    }
  }

  // Ref writes are forbidden during render, so the isFetchingCredentials
  // guard is reset in a separate effect that runs on the same triggers.
  useEffect(() => {
    if (!isOpen || instanceStatus.kind !== "ready") {
      isFetchingCredentials.current = false;
    }
  }, [isOpen, instanceStatus.kind]);

  /**
   * Attempts fetching the provisioned instance's credentials once the
   * instance has been provisioned.
   */
  useEffect(() => {
    if (
      !isOpen ||
      instanceStatus.kind !== "ready" ||
      instanceCredentialsStatus.kind !== "unfetched" ||
      isFetchingCredentials.current
    ) {
      return;
    }

    // Flag to cancel or ignore stale requests, like for example when the user
    // closes the modal.
    let cancelled = false;
    isFetchingCredentials.current = true;

    fetchInstanceCredentials()
      .then((credentials: AAPInstanceCredentials) => {
        if (!cancelled) {
          setInstanceCredentialsStatus({
            kind: "ready",
            credentials: credentials,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setInstanceCredentialsStatus({
            kind: "error",
            errorMessage:
              error instanceof UserFacingError
                ? (error.technicalDetails ?? error.detail)
                : error instanceof Error
                  ? error.message
                  : String(error),
          });
        }
      });

    // Cancel any inflight requests.
    return () => {
      cancelled = true;
      isFetchingCredentials.current = false;
    };
  }, [
    fetchInstanceCredentials,
    instanceCredentialsStatus.kind,
    instanceStatus.kind,
    isOpen,
  ]);

  const titleContent = isInstanceReady ? (
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
          Ansible Automation Platform instance provisioned
        </span>
      </FlexItem>
    </Flex>
  ) : (
    "Ansible Automation Platform"
  );

  // Show an error modal when a provisioning error occurs.
  if (provisioningError) {
    return (
      <ErrorModal
        headerTitle="Provision AAP instance"
        productName="ansible-automation-platform"
        alertTitle={provisioningError.title}
        alertText={provisioningError.detail}
        copyableTechnicalDetails={provisioningError.technicalDetails}
        isErrorModalOpen={isOpen}
        onErrorModalClose={onClose}
      />
    );
  }

  // Show an error modal when the credentials' fetching had an error.
  if (instanceCredentialsStatus.kind === "error") {
    return (
      <ErrorModal
        headerTitle="Provision AAP instance"
        productName="ansible-automation-platform"
        alertTitle="Unable to obtain the credentials for your instance"
        alertText={`Your instance has been provisioned, but an error occurred while attempting to fetch your instance's credentials. Please try again later and if the issue persists, please contact ${SUPPORT_EMAIL}.`}
        copyableTechnicalDetails={instanceCredentialsStatus.errorMessage}
        isErrorModalOpen={isOpen}
        onErrorModalClose={() => {
          isFetchingCredentials.current = false;
          setInstanceCredentialsStatus({ kind: "unfetched" });
          onClose();
        }}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-label="Ansible Automation Platform"
      variant="medium"
      data-testid="ansible-launch-info-modal"
    >
      <ModalHeader title={titleContent} />
      <ModalBody>
        {isInstanceBeingProvisioned && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner size="lg" />
            <Content component="p" style={{ marginTop: "16px" }}>
              Your Ansible Automation Platform instance is being provisioned.
              This can take up to 30 minutes. You can close this dialog and come
              back later.
            </Content>
          </div>
        )}
        {isCredentialsLoading && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner size="lg" />
            <Content component="p" style={{ marginTop: "16px" }}>
              We are obtaining your provisioned instance's credentials. Please
              wait a few seconds.
            </Content>
          </div>
        )}
        {isInstanceBeingUnidled && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner size="lg" />
            <Content component="p" style={{ marginTop: "16px" }}>
              Your instance is being reprovisioned. Please wait a few seconds.
            </Content>
          </div>
        )}
        {isInstanceReady && (
          <div>
            <Content component="p" style={{ marginBottom: "24px" }}>
              To get started with your AAP instance, you will need{" "}
              <strong>two different accounts</strong>:
            </Content>

            {/* Step 1: AAP admin account */}
            <Flex
              alignItems={{ default: "alignItemsCenter" }}
              gap={{ default: "gapMd" }}
              style={{ marginBottom: "16px" }}
            >
              <FlexItem>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                    minWidth: "20px",
                  }}
                >
                  1.
                </span>
              </FlexItem>
              <FlexItem>
                <img
                  src={AnsibleIcon}
                  alt="Ansible"
                  style={{
                    width: "40px",
                    height: "40px",
                  }}
                />
              </FlexItem>
              <FlexItem>
                <strong style={{ fontSize: "16px" }}>AAP admin account</strong>
              </FlexItem>
            </Flex>

            <Content component="p" style={{ marginBottom: "16px" }}>
              Log in to your AAP admin account within the new tab. Use the
              provided username and password to access your AAP instance.
            </Content>

            <div style={{ marginBottom: "8px" }}>
              <Flex
                alignItems={{ default: "alignItemsCenter" }}
                gap={{ default: "gapMd" }}
                style={{ marginBottom: "8px" }}
              >
                <FlexItem style={{ minWidth: "80px" }}>
                  <span>Username:</span>
                </FlexItem>
                <FlexItem>
                  <ClipboardCopy
                    isReadOnly
                    hoverTip="Copy username"
                    clickTip="Username copied!"
                    data-testid="ansible-username"
                  >
                    {instanceCredentialsStatus.credentials.username}
                  </ClipboardCopy>
                </FlexItem>
              </Flex>
              <Flex
                alignItems={{ default: "alignItemsCenter" }}
                gap={{ default: "gapMd" }}
              >
                <FlexItem style={{ minWidth: "80px" }}>Password:</FlexItem>
                <FlexItem>
                  <PasswordField
                    password={instanceCredentialsStatus.credentials.password}
                  />
                </FlexItem>
              </Flex>
            </div>

            {/* Step 2: Red Hat account */}
            <div
              style={{
                borderTop:
                  "1px solid var(--pf-t--global--border--color--default)",
                marginTop: "24px",
                paddingTop: "24px",
              }}
            >
              <Flex
                alignItems={{ default: "alignItemsCenter" }}
                gap={{ default: "gapMd" }}
                style={{ marginBottom: "16px" }}
              >
                <FlexItem>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "16px",
                      minWidth: "20px",
                    }}
                  >
                    2.
                  </span>
                </FlexItem>
                <FlexItem>
                  <img
                    src={RedHatLogo}
                    alt="Red Hat"
                    style={{ width: "40px", height: "40px" }}
                  />
                </FlexItem>
                <FlexItem>
                  <strong style={{ fontSize: "16px" }}>Red Hat account</strong>
                </FlexItem>
              </Flex>

              <Content component="p">
                Once logged in, you&apos;ll need to activate your subscription.
                On the activation form, select &quot;username and password&quot;
                and then enter your Red Hat account credentials.
              </Content>
            </div>

            <Content
              component="p"
              style={{
                marginTop: "24px",
                color: "var(--pf-t--global--text--color--subtle)",
                fontSize: "14px",
              }}
            >
              Access this information again by clicking the{" "}
              <strong>Launch</strong> button on the Ansible Automation Platform
              sandbox card.
            </Content>
          </div>
        )}
        {(instanceStatus.kind === "unknown" ||
          (instanceStatus.kind === "error" && !provisioningError)) && (
          <Content component="p">
            Unable to determine the status of your Ansible Automation Platform
            instance. Please try again later.
          </Content>
        )}
      </ModalBody>
      <ModalFooter>
        {isInstanceReady && (
          <Button
            variant="primary"
            component="a"
            href={instanceCredentialsStatus.credentials.url}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExternalLinkAltIcon />}
            iconPosition="end"
            data-testid="get-started-button"
            onClick={() =>
              trackAnalytics(
                "Get Started - Ansible",
                "Catalog",
                instanceCredentialsStatus.credentials.url,
                "cta",
              )
            }
          >
            Get started
          </Button>
        )}
        {!isInstanceReady && (
          <Button variant="link" onClick={onClose}>
            Close
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
