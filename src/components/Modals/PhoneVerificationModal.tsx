import "./PhoneVerificationModal.css";

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
import { type FormEvent, useRef, useState } from "react";

import {
  completePhoneVerification,
  initiatePhoneVerification,
} from "../../api/registration";
import { SUPPORT_EMAIL } from "../../const";
import { ApiError } from "../../error/ApiError";
import { mapApiErrorMessage } from "../../error/mapApiErrorMessage";
import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useUserContext } from "../../hooks/UserContext";
import logger from "../../utils/logger";
import {
  getPhoneStepValidationError,
  isValidOTP,
} from "../../utils/phone-utils";
import { PhoneVerificationModalCountryCodeInput } from "./PhoneVerificationModalCountryCodeInput";

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
  /** Called when the user dismisses the modal. */
  onClose: () => void;
};

type Step = "phone" | "code";

export function PhoneVerificationModal({
  isOpen,
  onClose,
}: PhoneVerificationModalProps) {
  const { trackAnalytics } = useAnalyticsContext();
  const { refetchUserData } = useUserContext();

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  /** Tracks whether the phone was already verified so that a retry
   *  after a refetch failure skips the verification call. */
  const phoneVerifiedRef = useRef(false);

  /** Soft-gate: require both fields to have a value before Send is enabled. */
  const hasPhoneStepInput =
    countryCode.trim() !== "" && phoneNumber.trim() !== "";
  /** Soft-gate: require a verification code before Verify is enabled. */
  const hasVerificationCodeInput = verificationCode.trim() !== "";

  const resetState = () => {
    setStep("phone");
    setCountryCode("");
    setPhoneNumber("");
    setVerificationCode("");
    setError(null);
    setSubmitting(false);
    inFlightRef.current = false;
    phoneVerifiedRef.current = false;
  };

  const handleClose = () => {
    trackAnalytics("Cancel Verification", "Verification");
    onClose();
    resetState();
  };

  const handleCountryCodeChange = (nextCountryCode: string) => {
    setError(null);
    setCountryCode(nextCountryCode);
  };

  const handlePhoneNumberChange = (
    _event: FormEvent<HTMLInputElement>,
    value: string,
  ) => {
    setError(null);
    setPhoneNumber(value);
  };

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) {
      return;
    }

    const validationError = getPhoneStepValidationError(
      countryCode,
      phoneNumber,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
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
      // Skip the verification call when the phone was already verified
      // on a previous attempt but the refetch failed.
      if (!phoneVerifiedRef.current) {
        await completePhoneVerification(verificationCode);
        phoneVerifiedRef.current = true;
      }

      // Once the phone has been verified, refetch the user data so
      // the UI transitions to the ready state. On error, inform the
      // user about what happened.
      try {
        await refetchUserData();
        handleClose();
      } catch (refetchErr) {
        logger.warn(
          "Refetching the user's signup after verifying the user's phone threw an error",
          refetchErr,
        );

        setError(
          "The phone was successfully verified, but we were unable to refresh your user's details at the moment. You might have to refresh the page in order to start using the product trials. Sorry for the inconvenience.",
        );
      }
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
      className="pf-v6-theme-dark"
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
            className="phone-verification-modal__alert"
            variant="danger"
            isInline
            isPlain
            title={error}
          />
        )}
        {step === "phone" ? (
          <Form onSubmit={handlePhoneSubmit} id="phone-form">
            <Content component="p">
              We need to verify your phone number before activating your trial.
              Standard SMS rates may apply.
            </Content>
            <FormGroup label="Country code" isRequired fieldId="country-code">
              {/* Remount when the modal reopens so the typeahead
                  starts empty after a cancel/reset. */}
              <PhoneVerificationModalCountryCodeInput
                key={String(isOpen)}
                onChange={handleCountryCodeChange}
              />
            </FormGroup>
            <FormGroup label="Phone number" isRequired fieldId="phone-number">
              <TextInput
                id="phone-number"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                isRequired
                placeholder="555-123-4567"
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
          isDisabled={
            submitting ||
            (step === "phone" ? !hasPhoneStepInput : !hasVerificationCodeInput)
          }
          isLoading={submitting}
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
