import { render, screen } from "@testing-library/react";
import { CatalogBanner } from "../CatalogBanner";
import { SandboxContext } from "../../../hooks/SandboxContext";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { readyUserFixture } from "../../../mocks/fixtures";
import { UserStatus } from "../../../types";

function makeContext(
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
    refetchAAP: vi.fn(),
    handleAAPInstance: vi.fn(),
    ansibleData: undefined,
    ansibleUIUser: undefined,
    ansibleUIPassword: "",
    ansibleUILink: undefined,
    ansibleError: null,
    ansibleStatus: AnsibleStatus.NEW,
    openclawData: undefined,
    openclawError: null,
    openclawStatus: OpenClawStatus.NEW,
    openclawUILink: undefined,
    handleOpenClawInstance: vi.fn(),
    deleteOpenClaw: vi.fn(),
    disabledIntegrations: [],
    ...overrides,
  };
}

describe("CatalogBanner", () => {
  it("renders welcome message with user name", () => {
    render(
      <SandboxContext.Provider value={makeContext()}>
        <CatalogBanner />
      </SandboxContext.Provider>,
    );
    expect(screen.getByText(/Welcome, John/)).toBeInTheDocument();
  });

  it("shows skeletons while loading", () => {
    render(
      <SandboxContext.Provider value={makeContext({ loading: true })}>
        <CatalogBanner />
      </SandboxContext.Provider>,
    );
    expect(screen.getByTestId("banner-skeleton")).toBeInTheDocument();
  });

  it("shows try products message when no user data", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ userData: undefined, userFound: false })}
      >
        <CatalogBanner />
      </SandboxContext.Provider>,
    );
    expect(screen.getByText("Try Red Hat products")).toBeInTheDocument();
  });

  it("shows verification prompt when verification required", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ verificationRequired: true })}
      >
        <CatalogBanner />
      </SandboxContext.Provider>,
    );
    expect(
      screen.getByText(/Click on "Try it" to initiate/),
    ).toBeInTheDocument();
  });

  it("shows pending approval message", () => {
    render(
      <SandboxContext.Provider value={makeContext({ pendingApproval: true })}>
        <CatalogBanner />
      </SandboxContext.Provider>,
    );
    expect(
      screen.getByText("Please wait for your trial to be approved."),
    ).toBeInTheDocument();
  });

  it("shows days remaining when endDate is set", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const userData = {
      ...readyUserFixture,
      endDate: futureDate.toISOString(),
    };
    render(
      <SandboxContext.Provider value={makeContext({ userData })}>
        <CatalogBanner />
      </SandboxContext.Provider>,
    );
    expect(
      screen.getByText(/Your free trial expires in \d+ days/),
    ).toBeInTheDocument();
  });
});
