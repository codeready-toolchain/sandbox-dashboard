import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import {
  ThemeContext,
  type ThemeContextType,
} from "../../../hooks/ThemeContext";
import { ColorScheme, ContrastMode, ThemeMode } from "../../../types/main";
import { IntentEvent } from "../../../utils/analytics";
import { ThemeSelector } from "../ThemeSelector";

/**
 * Builds a mock ThemeContextType with sensible defaults. Individual
 * fields can be overridden through the `overrides` parameter.
 */
function makeThemeContext(
  overrides: Partial<ThemeContextType> = {},
): ThemeContextType {
  return {
    changeColorScheme: vi.fn(),
    changeContrastMode: vi.fn(),
    changeThemeMode: vi.fn(),
    themePreferences: {
      themeMode: ThemeMode.DEFAULT,
      colorScheme: ColorScheme.SYSTEM,
      contrastMode: ContrastMode.SYSTEM,
    },
    ...overrides,
  };
}

function renderSelector(overrides: Partial<ThemeContextType> = {}) {
  const ctx = makeThemeContext(overrides);
  const trackIntent = vi.fn();
  return {
    ctx,
    trackIntent,
    ...render(
      <AnalyticsContext.Provider
        value={{ ...noopAnalyticsContext, trackIntent }}
      >
        <ThemeContext.Provider value={ctx}>
          <ThemeSelector />
        </ThemeContext.Provider>
      </AnalyticsContext.Provider>,
    ),
  };
}

describe("ThemeSelector", () => {
  it("renders the toggle button with the correct aria label", () => {
    renderSelector();
    expect(
      screen.getByRole("button", { name: "Theme selection" }),
    ).toBeInTheDocument();
  });

  it("opens the dropdown when the toggle is clicked", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Color scheme")).toBeInTheDocument();
    expect(screen.getByText("Contrast mode")).toBeInTheDocument();
  });

  it("shows the theme mode toggle items", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));

    // "Default" appears in both the theme mode and the contrast mode
    // groups, so use the group heading to scope the assertion.
    const themeGroup = screen
      .getByText("Theme")
      .closest(".theme-selector__options-group")!;
    expect(
      within(themeGroup as HTMLElement).getByRole("button", {
        name: "Default",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Project felt" }),
    ).toBeInTheDocument();
  });

  it("shows the color scheme toggle items", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));

    // There are two "System" buttons (color scheme and contrast
    // mode), so we just check that "Light" and "Dark" are present.
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  it("shows the contrast mode toggle items", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));

    expect(
      screen.getByRole("button", { name: "High contrast" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Glass" })).toBeInTheDocument();
  });

  it("calls changeThemeMode when Project felt is selected", async () => {
    const user = userEvent.setup();
    const { ctx } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));
    await user.click(screen.getByRole("button", { name: "Project felt" }));

    expect(ctx.changeThemeMode).toHaveBeenCalledWith(ThemeMode.PROJECT_FELT);
  });

  it("calls changeColorScheme when Dark is selected", async () => {
    const user = userEvent.setup();
    const { ctx } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));
    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(ctx.changeColorScheme).toHaveBeenCalledWith(ColorScheme.DARK);
  });

  it("calls changeColorScheme when Light is selected", async () => {
    const user = userEvent.setup();
    const { ctx } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));
    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(ctx.changeColorScheme).toHaveBeenCalledWith(ColorScheme.LIGHT);
  });

  it("calls changeContrastMode when High contrast is selected", async () => {
    const user = userEvent.setup();
    const { ctx } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));
    await user.click(screen.getByRole("button", { name: "High contrast" }));

    expect(ctx.changeContrastMode).toHaveBeenCalledWith(
      ContrastMode.HIGH_CONTRAST,
    );
  });

  it("calls changeContrastMode when Glass is selected", async () => {
    const user = userEvent.setup();
    const { ctx } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));
    await user.click(screen.getByRole("button", { name: "Glass" }));

    expect(ctx.changeContrastMode).toHaveBeenCalledWith(ContrastMode.GLASS);
  });

  it("highlights the currently selected theme mode", async () => {
    const user = userEvent.setup();
    renderSelector({
      themePreferences: {
        themeMode: ThemeMode.PROJECT_FELT,
        colorScheme: ColorScheme.SYSTEM,
        contrastMode: ContrastMode.SYSTEM,
      },
    });

    await user.click(screen.getByRole("button", { name: "Theme selection" }));

    const themeGroup = screen
      .getByText("Theme")
      .closest(".theme-selector__options-group")!;

    expect(
      screen.getByRole("button", { name: "Project felt" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(themeGroup as HTMLElement).getByRole("button", {
        name: "Default",
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("highlights the currently selected color scheme", async () => {
    const user = userEvent.setup();
    renderSelector({
      themePreferences: {
        themeMode: ThemeMode.DEFAULT,
        colorScheme: ColorScheme.DARK,
        contrastMode: ContrastMode.SYSTEM,
      },
    });

    await user.click(screen.getByRole("button", { name: "Theme selection" }));

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("highlights the currently selected contrast mode", async () => {
    const user = userEvent.setup();
    renderSelector({
      themePreferences: {
        themeMode: ThemeMode.DEFAULT,
        colorScheme: ColorScheme.SYSTEM,
        contrastMode: ContrastMode.GLASS,
      },
    });

    await user.click(screen.getByRole("button", { name: "Theme selection" }));

    expect(screen.getByRole("button", { name: "Glass" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "High contrast" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it(
    "does not call changeThemeMode when the already selected " +
      "theme mode is clicked",
    async () => {
      const user = userEvent.setup();
      const { ctx, trackIntent } = renderSelector({
        themePreferences: {
          themeMode: ThemeMode.DEFAULT,
          colorScheme: ColorScheme.SYSTEM,
          contrastMode: ContrastMode.SYSTEM,
        },
      });

      await user.click(screen.getByRole("button", { name: "Theme selection" }));

      // "Default" is already the active theme mode. Scope to the
      // Theme group to avoid the duplicate in the contrast group.
      const themeGroup = screen
        .getByText("Theme")
        .closest(".theme-selector__options-group")!;
      await user.click(
        within(themeGroup as HTMLElement).getByRole("button", {
          name: "Default",
        }),
      );

      expect(ctx.changeThemeMode).not.toHaveBeenCalled();
      expect(trackIntent).not.toHaveBeenCalled();
    },
  );

  it("reports the full theme snapshot when the user changes it", async () => {
    const user = userEvent.setup();
    const { trackIntent } = renderSelector();

    await user.click(screen.getByRole("button", { name: "Theme selection" }));
    await user.click(screen.getByRole("button", { name: "Project felt" }));

    expect(trackIntent).toHaveBeenCalledWith(
      IntentEvent.themeChanged,
      "Theme",
      {
        themeMode: ThemeMode.PROJECT_FELT,
        colorScheme: ColorScheme.SYSTEM,
        contrastMode: ContrastMode.SYSTEM,
      },
    );
  });
});
