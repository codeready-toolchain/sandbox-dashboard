import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SUPPORT_EMAIL } from "../../../const";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import { IntentEvent } from "../../../utils/analytics";
import { SupportBanner } from "../SupportBanner";

const trackIntent = vi.fn();

function renderBanner() {
  return render(
    <AnalyticsContext.Provider value={{ ...noopAnalyticsContext, trackIntent }}>
      <SupportBanner />
    </AnalyticsContext.Provider>,
  );
}

describe("SupportBanner", () => {
  it("renders the 'Need help?' heading", () => {
    renderBanner();

    expect(
      screen.getByRole("heading", { name: "Need help?" }),
    ).toBeInTheDocument();
  });

  it("renders the support email as a mailto link", async () => {
    renderBanner();

    const emailLink = screen.getByRole("link", { name: SUPPORT_EMAIL });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
    expect(emailLink).toHaveAttribute("data-analytics-text", SUPPORT_EMAIL);

    await userEvent.click(emailLink);
    expect(trackIntent).toHaveBeenCalledWith(
      IntentEvent.supportEmailClicked,
      "Support",
    );
  });

  it("renders the bookshelf image", () => {
    renderBanner();

    expect(screen.getByRole("img", { name: "Book shelf" })).toBeInTheDocument();
  });

  it("renders the chat bubbles image", () => {
    renderBanner();

    expect(
      screen.getByRole("img", { name: "Chat bubbles" }),
    ).toBeInTheDocument();
  });

  it("renders the descriptive text about FAQ and email", () => {
    renderBanner();

    expect(
      screen.getByText(/Find answers to the frequently asked questions/),
    ).toBeInTheDocument();
  });
});
