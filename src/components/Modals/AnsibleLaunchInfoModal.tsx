import { useState } from "react";
import {
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Button,
  ClipboardCopy,
  Content,
  Alert,
  Flex,
  FlexItem,
  Spinner,
  InputGroup,
  InputGroupItem,
  InputGroupText,
  TextInput,
} from "@patternfly/react-core";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import EyeIcon from "@patternfly/react-icons/dist/esm/icons/eye-icon";
import EyeSlashIcon from "@patternfly/react-icons/dist/esm/icons/eye-slash-icon";
import CopyIcon from "@patternfly/react-icons/dist/esm/icons/copy-icon";
import { AnsibleStatus } from "../../utils/aap-utils";
import AnsibleIcon from "../../assets/logos/ansible.svg";
import RedHatLogo from "../../assets/logos/logo_hat-only.svg";

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
  const [showPassword, setShowPassword] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
  };

  return (
    <InputGroup>
      <InputGroupItem isFill>
        <TextInput
          value={showPassword ? password : "•".repeat(password.length || 16)}
          type="text"
          readOnly
          aria-label="Password"
          data-testid="ansible-password-field"
        />
      </InputGroupItem>
      <InputGroupText>
        <Button
          variant="plain"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((prev) => !prev)}
          data-testid="toggle-password-visibility"
        >
          {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
        </Button>
      </InputGroupText>
      <InputGroupText>
        <Button
          variant="plain"
          aria-label="Copy password"
          onClick={handleCopy}
          data-testid="copy-password"
        >
          <CopyIcon />
        </Button>
      </InputGroupText>
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
      <ModalHeader title={titleContent as unknown as string} />
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
                    borderRadius: "50%",
                    backgroundColor: "#1a1a1a",
                    padding: "4px",
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
                <FlexItem
                  grow={{ default: "grow" }}
                  style={{ maxWidth: "320px" }}
                >
                  <ClipboardCopy
                    readOnly
                    hoverTip="Copy"
                    clickTip="Copied"
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
                <FlexItem style={{ minWidth: "80px" }}>
                  <span>Password:</span>
                </FlexItem>
                <FlexItem
                  grow={{ default: "grow" }}
                  style={{ maxWidth: "320px" }}
                >
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
