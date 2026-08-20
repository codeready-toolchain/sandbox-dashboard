import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

import { AnalyticsContext } from "../../../hooks/AnalyticsContext";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import { NotificationProvider } from "../../../hooks/NotificationProvider";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import { PhoneVerificationContext } from "../../../hooks/PhoneVerificationContext";
import { UIConfigurationContext } from "../../../hooks/UIConfigurationContext";
import type { UserContextType } from "../../../hooks/UserContext";
import { UserContext } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { CatalogGrid } from "../CatalogGrid";
import { makeOpenClawContext } from "./openClawTestHelpers";

vi.mock("../../../hooks/AnsibleProvider", () => ({
  AnsibleProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../../hooks/OpenClawProvider", () => ({
  OpenClawProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function makeSandboxContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.READY,
    refetchUserData: vi.fn(),
    signupUser: vi.fn(),
    ...overrides,
  };
}

function makeAnsibleContext(): AnsibleContextType {
  return {
    deleteInstance: vi.fn(),
    fetchInstanceCredentials: vi.fn().mockResolvedValue({
      username: "admin",
      password: "secret",
      url: "https://aap.example.com",
    }),
    instanceStatus: { kind: "new" },
    provisionInstance: vi.fn().mockResolvedValue(undefined),
    unidleInstance: vi.fn().mockResolvedValue(undefined),
  };
}

function renderGrid(openClawOverrides: Partial<OpenClawContextType> = {}) {
  const sandboxCtx = makeSandboxContext();
  const ansibleCtx = makeAnsibleContext();
  const openClawCtx = makeOpenClawContext(openClawOverrides);
  render(
    <NotificationProvider>
      <UIConfigurationContext.Provider value={{ disabledIntegrations: [] }}>
        <AnalyticsContext.Provider value={{ trackAnalytics: vi.fn() }}>
          <AnsibleContext.Provider value={ansibleCtx}>
            <OpenClawContext.Provider value={openClawCtx}>
              <UserContext.Provider value={sandboxCtx}>
                <PhoneVerificationContext.Provider
                  value={{ openPhoneVerificationModal: vi.fn() }}
                >
                  <CatalogGrid />
                </PhoneVerificationContext.Provider>
              </UserContext.Provider>
            </OpenClawContext.Provider>
          </AnsibleContext.Provider>
        </AnalyticsContext.Provider>
      </UIConfigurationContext.Provider>
    </NotificationProvider>,
  );
}

function getOpenClawCard(): HTMLElement {
  return screen.getByRole("article", { name: "OpenClaw product card" });
}

describe("CatalogGrid – OpenClaw card rendering", () => {
  it("shows 'Loading' button and disables it when OpenClaw status is INITIAL_FETCH", () => {
    renderGrid({ status: OpenClawStatus.INITIAL_FETCH });

    const card = getOpenClawCard();
    const mainButton = within(card).getByRole("button", { name: /Loading/ });
    expect(mainButton.textContent).toContain("Loading");
    expect(mainButton).toBeDisabled();
  });

  it("renders 'Loading' status label on OpenClaw card when status is INITIAL_FETCH", () => {
    renderGrid({ status: OpenClawStatus.INITIAL_FETCH });

    const card = getOpenClawCard();
    expect(card.textContent).toContain("Loading");
  });

  it("does not show delete button when OpenClaw status is INITIAL_FETCH", () => {
    renderGrid({ status: OpenClawStatus.INITIAL_FETCH });

    const card = getOpenClawCard();
    expect(
      within(card).queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("does not show delete button when OpenClaw status is UNKNOWN", () => {
    renderGrid({ status: OpenClawStatus.UNKNOWN });

    const card = getOpenClawCard();
    expect(
      within(card).queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();
  });

  it("hides delete button and shows 'Deleting...' on main button when OpenClaw status is DELETING", () => {
    renderGrid({ status: OpenClawStatus.DELETING });

    const card = getOpenClawCard();

    expect(
      within(card).queryByRole("button", { name: "Delete instance" }),
    ).not.toBeInTheDocument();

    const mainButton = within(card).getByRole("button", { name: /Deleting/ });
    expect(mainButton.textContent).toContain("Deleting...");
    expect(mainButton).toBeDisabled();
  });

  it("shows 'Provisioning...' on main button when OpenClaw status is PROVISIONING", () => {
    renderGrid({ status: OpenClawStatus.PROVISIONING });

    const card = getOpenClawCard();
    const mainButton = within(card).getByRole("button", {
      name: /Provisioning/,
    });
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("renders 'Ready' status label on OpenClaw card when status is READY", () => {
    renderGrid({ status: OpenClawStatus.READY });

    const card = getOpenClawCard();
    expect(card.textContent).toContain("Ready");

    const mainButton = within(card).getByRole("button", { name: "Launch" });
    expect(mainButton.textContent).toContain("Launch");
  });

  it("renders 'Idled' status label on OpenClaw card when status is IDLED", () => {
    renderGrid({ status: OpenClawStatus.IDLED });

    const card = getOpenClawCard();
    expect(card.textContent).toContain("Idled");

    const mainButton = within(card).getByRole("button", {
      name: "Re-provision",
    });
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("renders 'Failed' status label and 'Provision' button on OpenClaw card when status is FAILED", () => {
    renderGrid({ status: OpenClawStatus.FAILED });

    const card = getOpenClawCard();
    expect(card.textContent).toContain("Failed");

    const mainButton = within(card).getByRole("button", { name: "Provision" });
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");

    expect(
      within(card).getByRole("button", { name: "Delete instance" }),
    ).toBeInTheDocument();
  });

  it("renders 'Deleting' status label on OpenClaw card when status is DELETING", () => {
    renderGrid({ status: OpenClawStatus.DELETING });

    const card = getOpenClawCard();
    expect(card.textContent).toContain("Deleting");
  });

  it("does not disable the main button when OpenClaw status is PROVISIONING", () => {
    renderGrid({ status: OpenClawStatus.PROVISIONING });

    const card = getOpenClawCard();
    const mainButton = within(card).getByRole("button", {
      name: /Provisioning/,
    });
    expect(mainButton).not.toBeDisabled();
  });
});
