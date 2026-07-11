import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  AnsibleContext,
  type AnsibleContextType,
} from "../../../hooks/AnsibleContext";
import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawContext } from "../../../hooks/OpenClawContext";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { SandboxContext } from "../../../hooks/SandboxContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { NotificationProvider } from "../../../notifications/NotificationProvider";
import { UserStatus } from "../../../types";
import { AnsibleStatus } from "../../../utils/aap-utils";
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
  overrides: Partial<SandboxContextType> = {},
): SandboxContextType {
  return {
    userStatus: UserStatus.READY,
    userFound: true,
    userReady: true,
    verificationRequired: false,
    pendingApproval: false,
    userData: readyUserFixture,
    loading: false,
    refetchUserData: vi.fn(),
    signupUser: vi.fn(),
    disabledIntegrations: [],
    ...overrides,
  };
}

function makeAnsibleContext(): AnsibleContextType {
  return {
    ansibleData: undefined,
    ansibleProvisioningErrorDetails: null,
    ansibleStatus: AnsibleStatus.NEW,
    ansibleUILink: undefined,
    ansibleUIPassword: "",
    ansibleUIUser: undefined,
    handleAAPInstance: vi.fn(),
    refetchAAP: vi.fn(),
    resetAnsibleProvisioningErrorDetails: vi.fn(),
  };
}

function renderGrid(openClawOverrides: Partial<OpenClawContextType> = {}) {
  const sandboxCtx = makeSandboxContext();
  const ansibleCtx = makeAnsibleContext();
  const openClawCtx = makeOpenClawContext(openClawOverrides);
  render(
    <NotificationProvider>
      <AnsibleContext.Provider value={ansibleCtx}>
        <OpenClawContext.Provider value={openClawCtx}>
          <SandboxContext.Provider value={sandboxCtx}>
            <CatalogGrid />
          </SandboxContext.Provider>
        </OpenClawContext.Provider>
      </AnsibleContext.Provider>
    </NotificationProvider>,
  );
}

function getOpenClawCard(): HTMLElement {
  const card = screen
    .getAllByTestId("catalog-card")
    .find((c) => c.textContent?.includes("OpenClaw"));
  expect(card).toBeDefined();
  return card!;
}

describe("CatalogGrid – OpenClaw card rendering", () => {
  it("does not show delete button when OpenClaw status is UNKNOWN", () => {
    renderGrid({ openclawStatus: OpenClawStatus.UNKNOWN });

    const openclawCard = getOpenClawCard();
    expect(
      openclawCard.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();
  });

  it("hides delete button and shows 'Deleting...' on main button when OpenClaw status is DELETING", () => {
    renderGrid({ openclawStatus: OpenClawStatus.DELETING });

    const openclawCard = getOpenClawCard();

    expect(
      openclawCard.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    const mainButton = openclawCard.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton).toBeDefined();
    expect(mainButton.textContent).toContain("Deleting...");
    expect(mainButton).toBeDisabled();
  });

  it("hides delete button and shows 'Deleting...' on main button when OpenClaw status is TERMINATING", () => {
    renderGrid({ openclawStatus: OpenClawStatus.TERMINATING });

    const openclawCard = getOpenClawCard();

    expect(
      openclawCard.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    const mainButton = openclawCard.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Deleting...");
    expect(mainButton).toBeDisabled();
  });

  it("shows 'Provisioning...' on main button when OpenClaw status is PROVISIONING", () => {
    renderGrid({ openclawStatus: OpenClawStatus.PROVISIONING });

    const openclawCard = getOpenClawCard();

    const mainButton = openclawCard.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("renders 'Ready' status label on OpenClaw card when status is READY", () => {
    renderGrid({ openclawStatus: OpenClawStatus.READY });

    const openclawCard = getOpenClawCard();
    expect(openclawCard.textContent).toContain("Ready");

    const mainButton = openclawCard.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Launch");
  });

  it("renders 'Idled' status label on OpenClaw card when status is IDLED", () => {
    renderGrid({ openclawStatus: OpenClawStatus.IDLED });

    const openclawCard = getOpenClawCard();
    expect(openclawCard.textContent).toContain("Idled");

    const mainButton = openclawCard.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("renders 'Failed' status label and 'Provision' button on OpenClaw card when status is FAILED", () => {
    renderGrid({ openclawStatus: OpenClawStatus.FAILED });

    const openclawCard = getOpenClawCard();
    expect(openclawCard.textContent).toContain("Failed");

    const mainButton = openclawCard.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");

    expect(
      openclawCard.querySelector("[data-testid='delete-instance-button']"),
    ).not.toBeNull();
  });

  it("renders 'Deleting' status label on OpenClaw card when status is DELETING", () => {
    renderGrid({ openclawStatus: OpenClawStatus.DELETING });

    const openclawCard = getOpenClawCard();
    expect(openclawCard.textContent).toContain("Deleting");
  });

  it("does not disable the main button when OpenClaw status is PROVISIONING", () => {
    renderGrid({ openclawStatus: OpenClawStatus.PROVISIONING });

    const openclawCard = getOpenClawCard();

    const mainButton = openclawCard.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton).not.toBeDisabled();
  });
});
