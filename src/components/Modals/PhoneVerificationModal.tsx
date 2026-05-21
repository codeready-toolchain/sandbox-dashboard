import { useState, type FormEvent } from "react";
import {
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  TextInput,
  Alert,
  Spinner,
  Content,
} from "@patternfly/react-core";
import {
  initiatePhoneVerification,
  completePhoneVerification,
} from "../../api/registration";
import { isValidCountryCode, isValidPhoneNumber, isValidOTP } from "../../utils/phone-utils";
import { errorMessage } from "../../utils/common";

type PhoneVerificationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
};

type Step = "phone" | "code";

export function PhoneVerificationModal({
  isOpen,
  onClose,
  onVerified,
}: PhoneVerificationModalProps) {
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setStep("phone");
    setCountryCode("+1");
    setPhoneNumber("");
    setVerificationCode("");
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidCountryCode(countryCode)) {
      setError("Please enter a valid country code.");
      return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      setError("Please enter a valid phone number.");
      return;
    }

    setSubmitting(true);
    try {
      await initiatePhoneVerification(countryCode, phoneNumber);
      setStep("code");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidOTP(verificationCode) || verificationCode.length === 0) {
      setError("Please enter a valid verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await completePhoneVerification(verificationCode);
      resetState();
      onVerified();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      aria-label="Phone verification"
      variant="small"
      data-testid="phone-verification-modal"
    >
      <ModalHeader title={step === "phone" ? "Verify your phone number" : "Enter verification code"} />
      <ModalBody>
        {error && (
          <Alert
            variant="danger"
            isInline
            isPlain
            title={error}
            style={{ marginBottom: "16px" }}
            data-testid="phone-verification-error"
          />
        )}
        {step === "phone" ? (
          <Form onSubmit={handlePhoneSubmit} id="phone-form">
            <Content component="p">
              We need to verify your phone number before activating your trial.
              Standard SMS rates may apply.
            </Content>
            <FormGroup label="Country code" isRequired fieldId="country-code">
              <TextInput
                id="country-code"
                value={countryCode}
                onChange={(_e, val) => setCountryCode(val)}
                isRequired
                placeholder="+1"
                data-testid="country-code-input"
              />
            </FormGroup>
            <FormGroup label="Phone number" isRequired fieldId="phone-number">
              <TextInput
                id="phone-number"
                value={phoneNumber}
                onChange={(_e, val) => setPhoneNumber(val)}
                isRequired
                placeholder="555-123-4567"
                data-testid="phone-number-input"
              />
            </FormGroup>
          </Form>
        ) : (
          <Form onSubmit={handleCodeSubmit} id="code-form">
            <Content component="p">
              A verification code has been sent to your phone. Please enter it below.
            </Content>
            <FormGroup label="Verification code" isRequired fieldId="verification-code">
              <TextInput
                id="verification-code"
                value={verificationCode}
                onChange={(_e, val) => setVerificationCode(val)}
                isRequired
                placeholder="Enter code"
                data-testid="verification-code-input"
              />
            </FormGroup>
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          key="submit"
          variant="primary"
          type="submit"
          form={step === "phone" ? "phone-form" : "code-form"}
          isDisabled={submitting}
          isLoading={submitting}
          data-testid="phone-verification-submit"
        >
          {step === "phone" ? "Send code" : "Verify"}
        </Button>
        <Button key="cancel" variant="link" onClick={handleClose} isDisabled={submitting}>
          Cancel
        </Button>
        {submitting && <Spinner size="md" />}
      </ModalFooter>
    </Modal>
  );
}
