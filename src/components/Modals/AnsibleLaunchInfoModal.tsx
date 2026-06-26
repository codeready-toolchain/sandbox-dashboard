import {
  Alert,
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
import { useState } from "react";
import AnsibleIcon from "../../assets/logos/ansible.svg";
import RedHatLogo from "../../assets/logos/logo_hat-only.svg";
import { AnsibleStatus } from "../../utils/aap-utils";

type AnsibleLaunchInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ansibleUILink: string | undefined;
  ansibleUIUser: string | undefined;
  ansibleUIPassword: string;
  ansibleStatus: AnsibleStatus;
  ansibleError: string | null;
};

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
  ansibleUILink,
  ansibleUIUser,
  ansibleUIPassword,
  ansibleStatus,
  ansibleError,
}: AnsibleLaunchInfoModalProps) {
  const isProvisioning =
    ansibleStatus === AnsibleStatus.PROVISIONING ||
    ansibleStatus === AnsibleStatus.NEW ||
    ansibleStatus === AnsibleStatus.IDLED;

  const isReady = ansibleStatus === AnsibleStatus.READY;

  const titleContent = isReady ? (
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
        {ansibleError && (
          <Alert
            variant="danger"
            isInline
            isPlain
            title={ansibleError}
            style={{ marginBottom: "16px" }}
            data-testid="ansible-error"
          />
        )}
        {isProvisioning && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner size="lg" />
            <Content component="p" style={{ marginTop: "16px" }}>
              Your Ansible Automation Platform instance is being provisioned.
              This can take up to 30 minutes. You can close this dialog and come
              back later.
            </Content>
          </div>
        )}
        {isReady && (
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
                    {ansibleUIUser || "—"}
                  </ClipboardCopy>
                </FlexItem>
              </Flex>
              <Flex
                alignItems={{ default: "alignItemsCenter" }}
                gap={{ default: "gapMd" }}
              >
                <FlexItem style={{ minWidth: "80px" }}>Password:</FlexItem>
                <FlexItem>
                  <PasswordField password={ansibleUIPassword} />
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
        {ansibleStatus === AnsibleStatus.UNKNOWN && !ansibleError && (
          <Content component="p">
            Unable to determine the status of your Ansible Automation Platform
            instance. Please try again later.
          </Content>
        )}
      </ModalBody>
      <ModalFooter>
        {isReady && ansibleUILink && (
          <Button
            variant="primary"
            component="a"
            href={ansibleUILink}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExternalLinkAltIcon />}
            iconPosition="end"
            data-testid="get-started-button"
          >
            Get started
          </Button>
        )}
        {!isReady && (
          <Button variant="link" onClick={onClose}>
            Close
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
