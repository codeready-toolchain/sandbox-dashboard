import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionToggle,
  Button,
  Content,
  Flex,
  FlexItem,
  Tooltip,
} from "@patternfly/react-core";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { JsonCredentialSchema } from "../../types";
import {
  PROVIDERS,
  type AddedCredential,
  type ProviderConfig,
} from "../../utils/openclaw-providers";
import { ProviderCredentialForm } from "./ProviderCredentialForm";
import { SelectProvider } from "./SelectProvider";

type CredentialEntry = {
  id: string;
  provider: ProviderConfig | null;
  values: Record<string, string>;
};

export type CredentialAccordionRef = {
  getValidatedCredentials: () => AddedCredential[] | null;
};

export type CredentialAccordionProps = {
  onCredentialCountChange: (count: number) => void;
};

function getCredentialSummary(entry: CredentialEntry): string {
  if (!entry.provider) return "";
  const { provider, values } = entry;

  if (provider.credentialType === "gcp") {
    const project = values["project-id"] || "";
    const region = values["region"] || "";
    return project
      ? `Project: ${project} · Region: ${region}`
      : region
        ? `Region: ${region}`
        : "";
  }

  if (provider.id === "custom") {
    return values["endpoint-url"] || "";
  }

  const apiKey = values["api-key"] || "";
  if (apiKey.length > 4) {
    return `API Key: ····${apiKey.slice(-4)}`;
  }
  return apiKey ? "API Key: ····" : "";
}

function validateFields(
  provider: ProviderConfig,
  values: Record<string, string>,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const field of provider.fields) {
    const value = values[field.key]?.trim();

    if (field.required && !value) {
      errors[field.key] = [`The "${field.label}" field is required`];
      continue;
    }

    if (field.validate) {
      const msgs = field.validate(value ?? "");
      if (msgs.length > 0) {
        errors[field.key] = msgs;
      }
      continue;
    }
  }

  return errors;
}

export function extractGcpProjectId(json: string): string {
  try {
    const parsed: JsonCredentialSchema = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      parsed.type === "service_account" &&
      "project_id" in parsed
    ) {
      return parsed.project_id;
    }
  } catch {
    // Invalid JSON
  }
  return "";
}

export const CredentialAccordion = forwardRef<
  CredentialAccordionRef,
  CredentialAccordionProps
>(function CredentialAccordion({ onCredentialCountChange }, ref) {
  const [entries, setEntries] = useState<CredentialEntry[]>([
    { id: "cred-1", provider: null, values: {} },
  ]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const nextIdRef = useRef(1);

  const credentialCount = useMemo(
    () => entries.filter((e) => e.provider !== null).length,
    [entries],
  );

  useEffect(() => {
    onCredentialCountChange(credentialCount);
  }, [credentialCount, onCredentialCountChange]);

  const availableProviders = useMemo(() => {
    const usedIds = new Set(
      entries.filter((e) => e.provider !== null).map((e) => e.provider!.id),
    );
    return PROVIDERS.filter((p) => !usedIds.has(p.id));
  }, [entries]);

  const generateId = useCallback(() => {
    nextIdRef.current += 1;
    return `cred-${nextIdRef.current}`;
  }, []);

  const handleAddEntry = useCallback(() => {
    const newId = generateId();
    setExpandedIds(new Set([newId]));
    setEntries((prev) => [...prev, { id: newId, provider: null, values: {} }]);
  }, [generateId]);

  const handleDeleteEntry = useCallback((entryId: string) => {
    setEntries((prev) => {
      if (prev.length === 1) {
        return [{ id: prev[0].id, provider: null, values: {} }];
      }
      return prev.filter((entry) => entry.id !== entryId);
    });
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  }, []);

  const handleToggleExpand = useCallback((entryId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const handleFieldChange = useCallback(
    (entryId: string, fieldKey: string, fieldValue: string) => {
      const entry = entries.find((e) => e.id === entryId);
      const field = entry?.provider?.fields.find((f) => f.key === fieldKey);

      const valuesUpdate: Record<string, string> = { [fieldKey]: fieldValue };
      if (field?.type === "serviceAccountJson") {
        valuesUpdate["project-id"] = extractGcpProjectId(fieldValue);
      }

      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, values: { ...e.values, ...valuesUpdate } }
            : e,
        ),
      );

      setErrors((prev) => {
        if (field?.validate) {
          const msgs = field.validate(fieldValue.trim());
          if (msgs.length > 0) {
            return {
              ...prev,
              [entryId]: { ...prev[entryId], [fieldKey]: msgs },
            };
          }

          const entryClone = { ...prev[entryId] };
          delete entryClone[fieldKey];
          if (Object.keys(entryClone).length === 0) {
            const parentClone = { ...prev };
            delete parentClone[entryId];
            return parentClone;
          }
          return { ...prev, [entryId]: entryClone };
        }

        if (!prev[entryId]?.[fieldKey]) return prev;
        const entryErrors = { ...prev[entryId] };
        delete entryErrors[fieldKey];
        if (Object.keys(entryErrors).length === 0) {
          const parentClone = { ...prev };
          delete parentClone[entryId];
          return parentClone;
        }
        return { ...prev, [entryId]: entryErrors };
      });
    },
    [entries],
  );

  const handleProviderSelected = useCallback(
    (entryId: string, provider: ProviderConfig | null) => {
      const initialValues: Record<string, string> = {};
      if (provider) {
        for (const field of provider.fields) {
          if (field.defaultValue !== undefined) {
            initialValues[field.key] = field.defaultValue;
          }
        }
      }

      setEntries((prev: CredentialEntry[]) =>
        prev.map((entry: CredentialEntry) => {
          if (entry.id === entryId) {
            return { ...entry, provider, values: initialValues };
          } else {
            return entry;
          }
        }),
      );

      if (provider) {
        setExpandedIds((prev) => new Set([...prev, entryId]));
      }

      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [entryId]: _, ...rest } = prev;
        return rest;
      });
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      getValidatedCredentials: () => {
        const withProvider = entries.filter(
          (e): e is CredentialEntry & { provider: ProviderConfig } =>
            e.provider !== null,
        );
        if (withProvider.length === 0) return null;

        let hasErrors = false;
        const newErrors: Record<string, Record<string, string[]>> = {};
        const newExpandedIds = new Set(expandedIds);

        for (const entry of withProvider) {
          const entryErrors = validateFields(entry.provider, entry.values);
          if (Object.keys(entryErrors).length > 0) {
            newErrors[entry.id] = entryErrors;
            newExpandedIds.add(entry.id);
            hasErrors = true;
          }
        }

        if (hasErrors) {
          setErrors((prev) => ({ ...prev, ...newErrors }));
          setExpandedIds(newExpandedIds);
          return null;
        }

        setErrors({});
        return withProvider.map((e) => ({
          provider: e.provider,
          values: { ...e.values },
        }));
      },
    }),
    [entries, expandedIds],
  );

  const hasEmptyEntry = entries.some((e) => e.provider === null);

  return (
    <div>
      <Accordion isBordered className="credential-accordion">
        {entries.map((entry) => {
          const hasProvider = entry.provider !== null;
          const isExpanded = hasProvider ? expandedIds.has(entry.id) : true;
          const entryErrors = errors[entry.id] ?? {};
          const summary = hasProvider ? getCredentialSummary(entry) : "";

          return (
            <AccordionItem key={entry.id} isExpanded={isExpanded}>
              <AccordionToggle
                id={`toggle-${entry.id}`}
                onClick={() => {
                  if (hasProvider) handleToggleExpand(entry.id);
                }}
              >
                <Flex alignItems={{ default: "alignItemsCenter" }}>
                  <FlexItem grow={{ default: "grow" }}>
                    <strong>
                      {hasProvider ? entry.provider!.name : "New credential"}
                    </strong>
                  </FlexItem>
                  {hasProvider && !isExpanded && summary && (
                    <FlexItem>
                      <Content
                        component="small"
                        style={{
                          color: "var(--pf-t--global--text--color--subtle)",
                        }}
                      >
                        {summary}
                      </Content>
                    </FlexItem>
                  )}
                  {(entries.length > 1 || hasProvider) && (
                    <FlexItem>
                      <Tooltip content="Delete credential">
                        <Button
                          variant="plain"
                          aria-label="Delete credential"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(entry.id);
                          }}
                        >
                          <TrashIcon />
                        </Button>
                      </Tooltip>
                    </FlexItem>
                  )}
                </Flex>
              </AccordionToggle>
              <AccordionContent>
                {!hasProvider && (
                  <SelectProvider
                    availableProviders={availableProviders}
                    onProviderSelected={(provider: ProviderConfig | null) =>
                      handleProviderSelected(entry.id, provider)
                    }
                  />
                )}
                {hasProvider && (
                  <>
                    <ProviderCredentialForm
                      provider={entry.provider!}
                      values={entry.values}
                      errors={entryErrors}
                      onChange={(key, value) =>
                        handleFieldChange(entry.id, key, value)
                      }
                    />
                    {entry.provider!.keyUrl && (
                      <Content
                        component="p"
                        style={{
                          marginTop: "12px",
                          fontSize: "14px",
                        }}
                      >
                        <a
                          href={entry.provider!.keyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          Get a key for {entry.provider!.name}
                          <ExternalLinkAltIcon style={{ fontSize: "12px" }} />
                        </a>
                      </Content>
                    )}
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Button
        variant="link"
        icon={<PlusCircleIcon />}
        onClick={handleAddEntry}
        isDisabled={hasEmptyEntry || availableProviders.length === 0}
        style={{ marginTop: "8px" }}
      >
        Add another AI provider credential
      </Button>
    </div>
  );
});
