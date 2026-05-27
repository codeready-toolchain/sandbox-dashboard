import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import {
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Button,
  Alert,
  Content,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import { verifyActivationCode } from "../../api/registration";
import { errorMessage } from "../../utils/common";

const CODE_LENGTH = 5;

type AccessCodeInputModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
};

function CodeBoxes({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (newValues: string[]) => void;
  disabled: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusIndex = useCallback((i: number) => {
    inputRefs.current[i]?.focus();
  }, []);

  const handleChange = (index: number, raw: string) => {
    const char = raw
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-1)
      .toUpperCase();
    const next = [...values];
    next[index] = char;
    onChange(next);
    if (char && index < CODE_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!values[index] && index > 0) {
        const next = [...values];
        next[index - 1] = "";
        onChange(next);
        focusIndex(index - 1);
      } else {
        const next = [...values];
        next[index] = "";
        onChange(next);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      focusIndex(index - 1);
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = [...values];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    onChange(next);
    focusIndex(Math.min(pasted.length, CODE_LENGTH - 1));
  };

  return (
    <Flex gap={{ default: "gapSm" }}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <FlexItem key={i}>
          <input
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="text"
            maxLength={1}
            value={values[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={disabled}
            aria-label={`Activation code character ${i + 1}`}
            data-testid={`code-box-${i}`}
            style={{
              width: "48px",
              height: "56px",
              textAlign: "center",
              fontSize: "24px",
              fontWeight: 400,
              border: "1px solid var(--pf-t--global--border--color--default)",
              borderRadius: "4px",
              outline: "none",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => {
              if (document.activeElement !== e.target) {
                e.currentTarget.style.borderColor = "#000";
              }
            }}
            onMouseLeave={(e) => {
              if (document.activeElement !== e.target) {
                e.currentTarget.style.borderColor =
                  "var(--pf-t--global--border--color--default)";
              }
            }}
            onFocus={(e) => {
              e.target.style.borderColor =
                "var(--pf-t--global--border--color--clicked)";
              e.target.style.boxShadow =
                "0 0 0 1px var(--pf-t--global--border--color--clicked)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor =
                "var(--pf-t--global--border--color--default)";
              e.target.style.boxShadow = "none";
            }}
          />
        </FlexItem>
      ))}
    </Flex>
  );
}

export function AccessCodeInputModal({
  isOpen,
  onClose,
  onVerified,
}: AccessCodeInputModalProps) {
  const [codeChars, setCodeChars] = useState<string[]>(
    Array(CODE_LENGTH).fill(""),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setCodeChars(Array(CODE_LENGTH).fill(""));
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    const code = codeChars.join("");

    if (code.length < CODE_LENGTH) {
      setError("Please enter all 5 characters of your activation code.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyActivationCode(code);
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
      aria-label="Enter the activation code"
      variant="small"
      data-testid="access-code-modal"
    >
      <ModalHeader title="Enter the activation code" />
      <ModalBody>
        {error && (
          <Alert
            variant="danger"
            isInline
            isPlain
            title={error}
            style={{ marginBottom: "16px" }}
            data-testid="access-code-error"
          />
        )}
        <Content component="p" style={{ marginBottom: "16px" }}>
          If you have an activation code, enter it now.
        </Content>
        <CodeBoxes
          values={codeChars}
          onChange={setCodeChars}
          disabled={submitting}
        />
      </ModalBody>
      <ModalFooter>
        <Button
          key="submit"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={submitting}
          isLoading={submitting}
          data-testid="access-code-submit"
        >
          {submitting ? "Starting..." : "Start trial"}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={submitting}
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
