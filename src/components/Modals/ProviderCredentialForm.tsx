import {
  Button,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  TextArea,
  TextInput,
} from "@patternfly/react-core";
import EyeIcon from "@patternfly/react-icons/dist/esm/icons/eye-icon";
import EyeSlashIcon from "@patternfly/react-icons/dist/esm/icons/eye-slash-icon";
import { useState } from "react";
import type {
  ProviderConfig,
  ProviderCredentialField,
} from "../../utils/openclaw-providers";

const API_FORMAT_LABELS: Record<string, string> = {
  "openai-completions": "OpenAI Completions",
  "openai-responses": "OpenAI Responses",
  ollama: "Ollama",
};

type ProviderCredentialFormProps = {
  provider: ProviderConfig;
  values: Record<string, string>;
  errors: Record<string, string[]>;
  onChange: (key: string, value: string) => void;
};

function ApiKeyField({
  field,
  value,
  fieldErrors,
  onChange,
}: {
  field: ProviderCredentialField;
  value: string;
  fieldErrors: string[];
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const hasError = fieldErrors.length > 0;

  return (
    <FormGroup label={field.label} fieldId={`field-${field.key}`}>
      <InputGroup>
        <InputGroupItem isFill>
          <TextInput
            id={`field-${field.key}`}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(_e, val) => onChange(val)}
            placeholder={field.placeholder}
            validated={hasError ? "error" : "default"}
            aria-label={field.label}
          />
        </InputGroupItem>
        <InputGroupItem>
          <Button
            variant="plain"
            aria-label={`toggle ${field.label} visibility`}
            onClick={() => setVisible((prev) => !prev)}
          >
            {visible ? <EyeSlashIcon /> : <EyeIcon />}
          </Button>
        </InputGroupItem>
      </InputGroup>
      {hasError && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error">
              {fieldErrors.join(" ")}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
}

export function ProviderCredentialForm({
  provider,
  values,
  errors,
  onChange,
}: ProviderCredentialFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {provider.fields.map((field) => {
        const value = values[field.key] ?? "";
        const fieldErrors = errors[field.key] ?? [];
        const hasError = fieldErrors.length > 0;

        if (field.type === "apiKey") {
          return (
            <ApiKeyField
              key={field.key}
              field={field}
              value={value}
              fieldErrors={fieldErrors}
              onChange={(v) => onChange(field.key, v)}
            />
          );
        }

        if (field.type === "serviceAccountJson") {
          return (
            <FormGroup
              key={field.key}
              label={field.label}
              fieldId={`field-${field.key}`}
            >
              <TextArea
                id={`field-${field.key}`}
                value={value}
                onChange={(_e, val) => onChange(field.key, val)}
                placeholder={field.placeholder}
                validated={hasError ? "error" : "default"}
                rows={11}
                resizeOrientation="vertical"
                aria-label={field.label}
              />
              {hasError && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="error">
                      {fieldErrors.join(" ")}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          );
        }

        if (field.type === "select") {
          return (
            <FormGroup
              key={field.key}
              label={field.label}
              fieldId={`field-${field.key}`}
            >
              <FormSelect
                id={`field-${field.key}`}
                value={value || field.defaultValue || ""}
                onChange={(_e, val) => onChange(field.key, val)}
                validated={hasError ? "error" : "default"}
                aria-label={field.label}
              >
                {(field.options ?? []).map((option) => (
                  <FormSelectOption
                    key={option}
                    value={option}
                    label={API_FORMAT_LABELS[option] ?? option}
                  />
                ))}
              </FormSelect>
              {hasError && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="error">
                      {fieldErrors.join(" ")}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          );
        }

        if (field.type === "combobox") {
          return (
            <FormGroup
              key={field.key}
              label={field.label}
              fieldId={`field-${field.key}`}
            >
              <TextInput
                id={`field-${field.key}`}
                value={value}
                onChange={(_e, val) => onChange(field.key, val)}
                placeholder={field.placeholder}
                validated={hasError ? "error" : "default"}
                aria-label={field.label}
                list={`datalist-${field.key}`}
              />
              {field.options && (
                <datalist id={`datalist-${field.key}`}>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              )}
              {hasError && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="error">
                      {fieldErrors.join(" ")}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          );
        }

        return (
          <FormGroup
            key={field.key}
            label={field.label}
            fieldId={`field-${field.key}`}
          >
            <TextInput
              id={`field-${field.key}`}
              value={value}
              onChange={(_e, val) => onChange(field.key, val)}
              placeholder={field.placeholder}
              validated={hasError ? "error" : "default"}
              aria-label={field.label}
            />
            {hasError && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    {fieldErrors.join(" ")}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        );
      })}
    </div>
  );
}
