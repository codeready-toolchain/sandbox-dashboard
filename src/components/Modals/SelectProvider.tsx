import {
  Button,
  MenuToggle,
  type MenuToggleElement,
  Select,
  SelectGroup,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from "@patternfly/react-core";
import RhMicronsCloseIcon from "@patternfly/react-icons/dist/esm/icons/rh-microns-close-icon";
import { useMemo, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  type ProviderCategory,
  type ProviderConfig,
} from "../../utils/openclaw-providers";

export type SelectProviderProps = {
  availableProviders: ProviderConfig[];
  onProviderSelected: (provider: ProviderConfig | null) => void;
};

export function SelectProvider({
  availableProviders,
  onProviderSelected,
}: SelectProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ProviderConfig | null>(null);
  const [inputValue, setInputValue] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [focusedProviderId, setFocusedProviderId] = useState<
    string | undefined
  >(undefined);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(undefined);

  // Filter the available providers if the user has typed any filter value in
  // the input.
  const selectOptions = useMemo(() => {
    if (!filterValue || filterValue === "") {
      return availableProviders;
    }

    return availableProviders.filter((provider: ProviderConfig) => {
      return provider.name.toLowerCase().includes(filterValue.toLowerCase());
    });
  }, [availableProviders, filterValue]);

  // Once we've got the filtered providers, group them by category to be able
  // to render the options nicely for the user.
  const groupedProvidersByCategory = useMemo(() => {
    const groups: Record<string, ProviderConfig[]> = {};
    for (const provider of selectOptions) {
      const label = CATEGORY_LABELS[provider.category as ProviderCategory];
      if (!groups[label]) {
        groups[label] = [];
      }

      groups[label].push(provider);
    }
    return groups;
  }, [selectOptions]);

  // Keep track of the order of the providers in the groupping to be able to
  // easily work with arrow up, down and enter keystrokes.
  const renderOrderProviders = useMemo(() => {
    return Object.values(groupedProvidersByCategory).flat();
  }, [groupedProvidersByCategory]);

  const NO_RESULTS = "no results";

  const createItemId = (value: string) =>
    `select-providers-${value.replaceAll(" ", "-")}`;

  const resetActiveAndFocusedItem = () => {
    setFocusedProviderId(undefined);
    setActiveItemId(null);
  };

  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
  };

  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  const selectOption = (
    provider: ProviderConfig | null,
    content: string | number,
  ) => {
    setInputValue(String(content));
    setFilterValue("");
    setSelected(provider);
    onProviderSelected(provider);

    closeMenu();
  };

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    if (value && value !== NO_RESULTS) {
      const provider = selectOptions.find(
        (provider: ProviderConfig) => provider.id === value,
      );

      selectOption(provider ? provider : null, provider ? provider.name : "");
    }
  };

  const onTextInputChange = (
    _event: React.FormEvent<HTMLInputElement>,
    value: string,
  ) => {
    setInputValue(value);
    setFilterValue(value);

    resetActiveAndFocusedItem();

    if (
      !availableProviders.find((provider: ProviderConfig) =>
        provider.name.toLocaleLowerCase().includes(value.toLowerCase()),
      )
    ) {
      setSelected(null);
    }
  };

  const handleMenuArrowKeys = (key: string) => {
    if (!isOpen) {
      setIsOpen(true);
    }

    if (renderOrderProviders.length === 0) return;

    const currentIndex: number = renderOrderProviders.findIndex(
      (provider: ProviderConfig) => {
        return provider.id === focusedProviderId;
      },
    );

    let nextIndex: number = 0;
    if (key === "ArrowUp") {
      if (currentIndex <= 0) {
        nextIndex = renderOrderProviders.length - 1;
      } else {
        nextIndex = currentIndex - 1;
      }
    }

    if (key === "ArrowDown") {
      if (
        currentIndex === -1 ||
        currentIndex === renderOrderProviders.length - 1
      ) {
        nextIndex = 0;
      } else {
        nextIndex = currentIndex + 1;
      }
    }

    const nextProvider = renderOrderProviders[nextIndex];
    if (!nextProvider) return;
    setFocusedProviderId(nextProvider.id);
    setActiveItemId(nextProvider.id);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = renderOrderProviders.find(
      (provider: ProviderConfig) => {
        return provider.id === focusedProviderId;
      },
    );

    switch (event.key) {
      case "Enter":
        if (isOpen && focusedItem && focusedItem.name !== NO_RESULTS) {
          selectOption(focusedItem, focusedItem.name);
        }

        if (!isOpen) {
          setIsOpen(true);
        }

        break;
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        handleMenuArrowKeys(event.key);
        break;
    }
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const onClearButtonClick = () => {
    setSelected(null);
    setInputValue("");
    setFilterValue("");
    resetActiveAndFocusedItem();
    textInputRef?.current?.focus();
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={onToggleClick}
      isExpanded={isOpen}
      isFullWidth
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="typeahead-select-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder="Select or type an AI provider"
          aria-activedescendant={activeItemId || undefined}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-typeahead-listbox"
        />

        <TextInputGroupUtilities
          {...(!inputValue ? { style: { display: "none" } } : {})}
        >
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label="Clear input value"
            icon={<RhMicronsCloseIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      id="typeahead-select"
      isOpen={isOpen}
      selected={selected}
      onSelect={onSelect}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeMenu();
      }}
      toggle={toggle}
      variant="typeahead"
    >
      <SelectList id="select-providers-listbox">
        {Object.entries(groupedProvidersByCategory).map(
          ([groupLabel, providers]) => {
            if (providers.length === 0) {
              return null;
            }

            return (
              <SelectGroup key={groupLabel} label={groupLabel}>
                {providers.map((provider: ProviderConfig) => (
                  <SelectOption
                    id={createItemId(provider.id)}
                    key={provider.id}
                    value={provider.id}
                    isFocused={provider.id === focusedProviderId}
                  >
                    {provider.name}
                  </SelectOption>
                ))}
              </SelectGroup>
            );
          },
        )}
      </SelectList>
    </Select>
  );
}
