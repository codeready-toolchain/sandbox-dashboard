import {
  Alert,
  Button,
  Content,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextInput,
} from "@patternfly/react-core";
import { useRef, useState, type FormEvent } from "react";
import {
  completePhoneVerification,
  initiatePhoneVerification,
} from "../../api/registration";
import { SUPPORT_EMAIL } from "../../const";
import { ApiError } from "../../error/ApiError";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { mapApiErrorMessage } from "../../error/mapApiErrorMessage";
import logger from "../../utils/logger";
import {
  isValidCountryCode,
  isValidOTP,
  isValidPhoneNumber,
} from "../../utils/phone-utils";

const PHONE_FALLBACK = `Unable to verify your phone number. Please contact ${SUPPORT_EMAIL}`;

const PHONE_SUBMIT_ERROR_RULES = [
  {
    match: "Invalid 'To' Phone Number",
    message:
      "Invalid phone number. Please verify the country code and number format, then try again.",
  },
  {
    match: "'To' number cannot be a Short Code:",
    message:
      "Invalid phone number. Please verify the country code and number format, then try again.",
  },
  {
    match: "Message cannot be sent with the current combination of 'To'",
    message:
      "Invalid phone number. Please verify the country code and number format, then try again.",
  },
  {
    match: "is not a valid mobile number",
    message:
      "Invalid phone number. Please verify the country code and number format, then try again.",
  },
  {
    match: "phone number already in use",
    message:
      "This phone number is already in use. Please use a different number.",
  },
] as const;

const CODE_SUBMIT_ERROR_RULES = [
  {
    match: "the provided code is invalid",
    message:
      "The verification code you entered is incorrect. Please try again.",
  },
  {
    match: "verification code expired",
    message: "Your verification code has expired. Please request a new one.",
  },
  {
    match: "phone number already in use",
    message: "This phone number is already in use by another account.",
  },
  {
    match: "too many verification attempts",
    message: "Too many verification attempts. Please try again later.",
  },
  {
    match: "verification is not available at this time",
    message:
      "Verification is not available at this time. Please try again later.",
  },
] as const;

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
  const { trackAnalytics } = useAnalyticsContext();
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const resetState = () => {
    setStep("phone");
    setCountryCode("+1");
    setPhoneNumber("");
    setVerificationCode("");
    setError(null);
    setSubmitting(false);
    inFlightRef.current = false;
  };

  const handleClose = () => {
    trackAnalytics("Cancel Verification", "Verification");
    resetState();
    onClose();
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;

    setError(null);

    if (!isValidCountryCode(countryCode)) {
      setError("Please enter a valid country code.");
      return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      setError("Please enter a valid phone number.");
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    trackAnalytics("Send Code", "Verification");
    try {
      await initiatePhoneVerification(countryCode, phoneNumber);
      setStep("code");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          mapApiErrorMessage(err, PHONE_SUBMIT_ERROR_RULES, PHONE_FALLBACK),
        );
      } else {
        logger.error("Unexpected error when verifying the phone number", err);
        setError(PHONE_FALLBACK);
      }
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  /**
   * Handles the OTP code submitting flow.
   * @param e the triggered event.
   */
  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) {
      return;
    }

    setError(null);

    if (!isValidOTP(verificationCode) || verificationCode.length === 0) {
      setError("Please enter a valid verification code.");
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    trackAnalytics("Start Trial", "Verification");
    try {
      await completePhoneVerification(verificationCode);
      resetState();
      onVerified();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          mapApiErrorMessage(err, CODE_SUBMIT_ERROR_RULES, PHONE_FALLBACK),
        );
      } else {
        logger.error(
          "Unexpected error when completing the phone verification process",
          err,
        );
        setError(PHONE_FALLBACK);
      }
    } finally {
      inFlightRef.current = false;
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
      <ModalHeader
        title={
          step === "phone"
            ? "Verify your phone number"
            : "Enter verification code"
        }
      />
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
              A verification code has been sent to your phone. Please enter it
              below.
            </Content>
            <FormGroup
              label="Verification code"
              isRequired
              fieldId="verification-code"
            >
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
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={submitting}
        >
          Cancel
        </Button>
        {submitting && <Spinner size="md" />}
      </ModalFooter>
    </Modal>
  );
}
