import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectProvider } from "../SelectProvider";
import type { ProviderConfig } from "../../../utils/openclaw-providers";

const mockProvider: ProviderConfig = {
  id: "gemini",
  name: "Google Gemini",
  provider: "google",
  category: "primary",
  credentialType: "apiKey",
  fields: [
    { key: "api-key", label: "API Key", type: "apiKey", required: true },
  ],
};

const mockOnProviderSelected = vi.fn();

describe("SelectProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the select input", () => {
    render(
      <SelectProvider
        availableProviders={[mockProvider]}
        onProviderSelected={mockOnProviderSelected}
      />,
    );
    expect(
      screen.getByPlaceholderText("Select or type an AI provider"),
    ).toBeInTheDocument();
  });

  it("does not crash on ArrowDown with an empty provider list", async () => {
    const user = userEvent.setup();
    render(
      <SelectProvider
        availableProviders={[]}
        onProviderSelected={mockOnProviderSelected}
      />,
    );

    const input = screen.getByPlaceholderText("Select or type an AI provider");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");

    expect(mockOnProviderSelected).not.toHaveBeenCalled();
  });

  it("does not crash on ArrowDown when filter yields no results", async () => {
    const user = userEvent.setup();
    render(
      <SelectProvider
        availableProviders={[mockProvider]}
        onProviderSelected={mockOnProviderSelected}
      />,
    );

    const input = screen.getByPlaceholderText("Select or type an AI provider");
    await user.click(input);
    await user.type(input, "zzzzz-no-match");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");

    expect(mockOnProviderSelected).not.toHaveBeenCalled();
  });

  it("navigates providers with ArrowDown and selects with Enter", async () => {
    const user = userEvent.setup();
    render(
      <SelectProvider
        availableProviders={[mockProvider]}
        onProviderSelected={mockOnProviderSelected}
      />,
    );

    const input = screen.getByPlaceholderText("Select or type an AI provider");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(mockOnProviderSelected).toHaveBeenCalledWith(mockProvider);
  });
});
