import "./ThemeSelector.css";

import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownList,
  MenuToggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
} from "@patternfly/react-core";
import {
  RhUiAutoLightDarkModeIcon,
  RhUiDarkModeIcon,
  RhUiLightModeIcon,
} from "@patternfly/react-icons";
import { useRef, useState } from "react";

import { useAnalyticsContext } from "../../hooks/AnalyticsContext";
import { useThemeContext } from "../../hooks/ThemeContext";
import { ColorScheme, ContrastMode, ThemeMode } from "../../types/main";
import { IntentEvent } from "../../utils/analytics";

/**
 * Gets which icon to render for the theme selector.
 * @param colorScheme the color scheme set by the user.
 * @returns the icon to be rendered.
 */
function getThemeIcon(colorScheme: ColorScheme): React.ReactNode {
  switch (colorScheme) {
    case ColorScheme.DARK:
      return <RhUiDarkModeIcon />;
    case ColorScheme.LIGHT:
      return <RhUiLightModeIcon />;
    case ColorScheme.SYSTEM:
      return <RhUiAutoLightDarkModeIcon />;
  }
}

/**
 * A component that renders a dropdown with the corresponding settings to
 * adjust the theme's mode, color scheme and contrast mode.
 *
 * Highly inspired on PatternFly docs' theme selector.
 * {@link https://github.com/patternfly/patternfly-org/blob/bfc67322f655370fea50a80cfc0d5ce8bd3b8eb6/packages/documentation-framework/components/themeSelector/themeSelector.js}
 */
export function ThemeSelector() {
  const {
    changeThemeMode,
    changeColorScheme,
    changeContrastMode,
    themePreferences,
  } = useThemeContext();
  const { trackIntent } = useAnalyticsContext();
  const toggleRef = useRef<HTMLButtonElement>(null);

  /**
   * Records the theme settings after a user change. The snapshot is
   * the current preferences with the field the user just chose, so a
   * value restored from storage on load is not reported.
   */
  const reportThemeChange = (next: {
    themeMode?: ThemeMode;
    colorScheme?: ColorScheme;
    contrastMode?: ContrastMode;
  }) => {
    trackIntent(IntentEvent.themeChanged, "Theme", {
      themeMode: next.themeMode ?? themePreferences.themeMode,
      colorScheme: next.colorScheme ?? themePreferences.colorScheme,
      contrastMode: next.contrastMode ?? themePreferences.contrastMode,
    });
  };

  const [isThemeSelectorOpen, setThemeSelectorOpen] = useState<boolean>(false);

  return (
    <>
      <Dropdown
        id="theme-selector"
        popperProps={{ position: "end" }}
        isOpen={isThemeSelectorOpen}
        onOpenChange={setThemeSelectorOpen}
        toggle={{
          toggleNode: (
            <Tooltip content="Theme settings" position="bottom">
              <MenuToggle
                ref={toggleRef}
                isExpanded={isThemeSelectorOpen}
                onClick={() => setThemeSelectorOpen(!isThemeSelectorOpen)}
                aria-label="Theme selection"
                icon={getThemeIcon(themePreferences.colorScheme)}
              />
            </Tooltip>
          ),
          toggleRef,
        }}
      >
        <DropdownList>
          <DropdownGroup
            label="Theme"
            className="theme-selector__options-group"
          >
            <ToggleGroup>
              <ToggleGroupItem
                text="Default"
                buttonId={ThemeMode.DEFAULT}
                isSelected={themePreferences.themeMode === ThemeMode.DEFAULT}
                onChange={(_event, selected) => {
                  if (selected) {
                    changeThemeMode(ThemeMode.DEFAULT);
                    reportThemeChange({ themeMode: ThemeMode.DEFAULT });
                  }
                }}
              />
              <ToggleGroupItem
                text="Project felt"
                buttonId={ThemeMode.PROJECT_FELT}
                isSelected={
                  themePreferences.themeMode === ThemeMode.PROJECT_FELT
                }
                onChange={(_event, selected) => {
                  if (selected) {
                    changeThemeMode(ThemeMode.PROJECT_FELT);
                    reportThemeChange({ themeMode: ThemeMode.PROJECT_FELT });
                  }
                }}
              />
            </ToggleGroup>
          </DropdownGroup>
          <Divider />
          <DropdownGroup
            label="Color scheme"
            className="theme-selector__options-group"
          >
            <ToggleGroup>
              <ToggleGroupItem
                text="System"
                buttonId={ColorScheme.SYSTEM}
                isSelected={themePreferences.colorScheme === ColorScheme.SYSTEM}
                onChange={(_event, selected) => {
                  if (selected) {
                    changeColorScheme(ColorScheme.SYSTEM);
                    reportThemeChange({ colorScheme: ColorScheme.SYSTEM });
                  }
                }}
              />
              <ToggleGroupItem
                text="Light"
                buttonId={ColorScheme.LIGHT}
                isSelected={themePreferences.colorScheme === ColorScheme.LIGHT}
                onChange={(_event, selected) => {
                  if (selected) {
                    changeColorScheme(ColorScheme.LIGHT);
                    reportThemeChange({ colorScheme: ColorScheme.LIGHT });
                  }
                }}
              />
              <ToggleGroupItem
                text="Dark"
                buttonId={ColorScheme.DARK}
                isSelected={themePreferences.colorScheme === ColorScheme.DARK}
                onChange={(_event, selected) => {
                  if (selected) {
                    changeColorScheme(ColorScheme.DARK);
                    reportThemeChange({ colorScheme: ColorScheme.DARK });
                  }
                }}
              />
            </ToggleGroup>
          </DropdownGroup>
          <Divider />
          <DropdownGroup
            label="Contrast mode"
            className="theme-selector__options-group"
          >
            <ToggleGroup>
              <ToggleGroupItem
                text="System"
                buttonId={ContrastMode.SYSTEM}
                isSelected={
                  themePreferences.contrastMode === ContrastMode.SYSTEM
                }
                onChange={(_event, selected) => {
                  if (selected) {
                    changeContrastMode(ContrastMode.SYSTEM);
                    reportThemeChange({ contrastMode: ContrastMode.SYSTEM });
                  }
                }}
              />
              <ToggleGroupItem
                text="Default"
                buttonId={ContrastMode.DEFAULT}
                isSelected={
                  themePreferences.contrastMode === ContrastMode.DEFAULT
                }
                onChange={(_event, selected) => {
                  if (selected) {
                    changeContrastMode(ContrastMode.DEFAULT);
                    reportThemeChange({ contrastMode: ContrastMode.DEFAULT });
                  }
                }}
              />
              <ToggleGroupItem
                text="High contrast"
                buttonId={ContrastMode.HIGH_CONTRAST}
                isSelected={
                  themePreferences.contrastMode === ContrastMode.HIGH_CONTRAST
                }
                onChange={(_event, selected) => {
                  if (selected) {
                    changeContrastMode(ContrastMode.HIGH_CONTRAST);
                    reportThemeChange({
                      contrastMode: ContrastMode.HIGH_CONTRAST,
                    });
                  }
                }}
              />
              <ToggleGroupItem
                text="Glass"
                buttonId={ContrastMode.GLASS}
                isSelected={
                  themePreferences.contrastMode === ContrastMode.GLASS
                }
                onChange={(_event, selected) => {
                  if (selected) {
                    changeContrastMode(ContrastMode.GLASS);
                    reportThemeChange({ contrastMode: ContrastMode.GLASS });
                  }
                }}
              />
            </ToggleGroup>
          </DropdownGroup>
        </DropdownList>
      </Dropdown>
    </>
  );
}
