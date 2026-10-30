import type { MenuToggleElement } from "@patternfly/react-core";
import {
  Button,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from "@patternfly/react-core";
import RhMicronsCloseIcon from "@patternfly/react-icons/dist/esm/icons/rh-microns-close-icon";
import { useMemo, useRef, useState } from "react";

import {
  type CountryCodeEntry,
  countryCodes,
  formatCountryCodeLabel,
  resolveCountryCodeEntry,
} from "./phone-verification-country-codes";

type PhoneVerificationModalCountryCodeInputProps = {
  /** Called with the dial code when the user selects or clears a country. */
  onChange: (countryCode: string) => void;
};

/**
 * Typeahead select that lets the user search for and pick a country dial
 * code. The selected dial code is reported to the parent via onChange.
 * Typing a known dial code (for example "+34") and leaving the field
 * auto-selects the matching country.
 */
export const PhoneVerificationModalCountryCodeInput: React.FunctionComponent<
  PhoneVerificationModalCountryCodeInputProps
> = ({ onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(undefined);

  /**
   * Memoized filtered entries, which change depending on the value that the
   * user inputted.
   */
  const filteredEntries = useMemo(() => {
    if (!filterValue) {
      return countryCodes;
    }

    return countryCodes.filter((entry) =>
      formatCountryCodeLabel(entry)
        .toLowerCase()
        .includes(filterValue.toLowerCase()),
    );
  }, [filterValue]);

  /**
   * Sets the active and focused item.
   * @param itemIndex the item's index.
   */
  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem: CountryCodeEntry = filteredEntries[itemIndex];
    setActiveItemId(createItemId(focusedItem.name, focusedItem.code));
  };

  /**
   * Resets the active and focused item.
   */
  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  /**
   * Closes the menu.
   */
  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
  };

  /**
   * Opens the menu on input click, or closes it when the input is empty
   * and already open.
   */
  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  /**
   * Commits a country entry as the current selection.
   */
  const selectEntry = (entry: CountryCodeEntry) => {
    const itemId = createItemId(entry.name, entry.code);
    setInputValue(formatCountryCodeLabel(entry));
    setFilterValue("");
    setSelected(itemId);
    onChange(entry.code);
    closeMenu();
  };

  /**
   * If the user typed a known dial code without clicking an option,
   * resolve and select the matching country.
   * @returns true when a country was auto-selected.
   */
  const commitTypedCountryCodeIfKnown = (): boolean => {
    if (selected) {
      return false;
    }

    const entry = resolveCountryCodeEntry(inputValue);
    if (!entry) {
      return false;
    }

    selectEntry(entry);
    return true;
  };

  /**
   * Handles the selection of an entry in the dropdown menu.
   */
  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    itemValue: string | number | undefined,
  ) => {
    if (!itemValue) {
      return;
    }

    const entry = countryCodes.find(
      (e) => createItemId(e.name, e.code) === itemValue,
    );
    if (!entry) {
      return;
    }

    selectEntry(entry);
  };

  /**
   * Handles input changes.
   */
  const onTextInputChange = (
    _event: React.FormEvent<HTMLInputElement>,
    nextValue: string,
  ) => {
    setInputValue(nextValue);
    setFilterValue(nextValue);
    // Keep the menu open while filtering; typing can otherwise close it.
    setIsOpen(true);

    resetActiveAndFocusedItem();

    // Clear the parent value while the user is typing a new filter so
    // a stale dial code is not submitted before a fresh selection.
    if (selected) {
      setSelected("");
      onChange("");
    }
  };

  /**
   * Handles arrow key navigation through the filtered menu items.
   */
  const handleMenuArrowKeys = (key: string) => {
    if (filteredEntries.length === 0) {
      return;
    }

    let indexToFocus = 0;

    if (!isOpen) {
      setIsOpen(true);
    }

    if (key === "ArrowUp") {
      // When no index is set or at the first index, focus to the last,
      // otherwise decrement focus index.
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        indexToFocus = filteredEntries.length - 1;
      } else {
        indexToFocus = focusedItemIndex - 1;
      }
    }

    if (key === "ArrowDown") {
      // When no index is set or at the last index, focus to the first,
      // otherwise increment focus index.
      if (
        focusedItemIndex === null ||
        focusedItemIndex === filteredEntries.length - 1
      ) {
        indexToFocus = 0;
      } else {
        indexToFocus = focusedItemIndex + 1;
      }
    }

    setActiveAndFocusedItem(indexToFocus);
  };

  /**
   * Handles key presses in the typeahead input.
   */
  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem =
      focusedItemIndex !== null ? filteredEntries[focusedItemIndex] : null;

    switch (event.key) {
      case "Enter":
        // Prevent the surrounding form from submitting on Enter.
        event.preventDefault();
        if (isOpen && focusedItem) {
          onSelect(undefined, createItemId(focusedItem.name, focusedItem.code));
        } else if (!commitTypedCountryCodeIfKnown() && !isOpen) {
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

  /**
   * On blur, auto-select a known dial code when the user typed one
   * without picking from the list.
   */
  const handleInputBlur = () => {
    commitTypedCountryCodeIfKnown();
  };

  /**
   * Handle clicking on the toggle to open or close the dropdown.
   */
  const onToggleClick = () => {
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  /**
   * Handle the user hitting the "X" button to clear the input area.
   */
  const onClearButtonClick = () => {
    setSelected("");
    setInputValue("");
    setFilterValue("");
    onChange("");
    resetActiveAndFocusedItem();
    textInputRef?.current?.focus();
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      aria-haspopup="listbox"
      ref={toggleRef}
      variant="typeahead"
      aria-label="Country code toggle"
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
          onBlur={handleInputBlur}
          id="country-code"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder="Type a country or a country code"
          aria-label="Country code"
          {...(activeItemId && { "aria-activedescendant": activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-country-code-listbox"
        />

        <TextInputGroupUtilities
          {...(!inputValue ? { style: { display: "none" } } : {})}
        >
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label="Clear country code"
            icon={<RhMicronsCloseIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      id="country-code-select"
      isOpen={isOpen}
      selected={selected}
      onSelect={onSelect}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          // Menu dismiss counts as leaving the field; try to commit a
          // typed dial code before closing.
          commitTypedCountryCodeIfKnown();
          closeMenu();
        }
      }}
      toggle={toggle}
      variant="typeahead"
      isScrollable
      maxMenuHeight="200px"
    >
      <SelectList
        id="select-country-code-listbox"
        // Keep the typeahead input focused while clicking an option so
        // blur does not run before onSelect.
        onMouseDown={(event) => {
          event.preventDefault();
        }}
      >
        {filteredEntries.map((entry, index) => (
          <SelectOption
            key={createItemId(entry.name, entry.code)}
            value={createItemId(entry.name, entry.code)}
            isFocused={focusedItemIndex === index}
            id={createItemId(entry.name, entry.code)}
          >
            {formatCountryCodeLabel(entry)}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};

/**
 * Creates a unique ID for a country code entry.
 * @param entryName the name of the country.
 * @param entryCode the country code.
 * @returns a unique ID for the entry.
 */
function createItemId(entryName: string, entryCode: string) {
  return `select-typeahead-${entryName.replaceAll(" ", "-")}-${entryCode.replace("+", "")}`;
}
