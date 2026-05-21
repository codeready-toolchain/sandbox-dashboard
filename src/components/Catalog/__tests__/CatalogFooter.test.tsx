import { render, screen } from "@testing-library/react";
import { CatalogFooter } from "../CatalogFooter";
import { SandboxContext, type SandboxContextType } from "../../../hooks/SandboxContext";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { readyUserFixture } from "../../../mocks/fixtures";

function makeSandboxContext(
  overrides: Partial<SandboxContextType> = {},
): SandboxContextType {
  return {
    userStatus: "ready",
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
    disabledIntegrations: [],
    ...overrides,
  };
}

function renderFooter() {
  return render(
    <SandboxContext.Provider value={makeSandboxContext()}>
      <CatalogFooter />
    </SandboxContext.Provider>,
  );
}

describe("CatalogFooter", () => {
  it("renders activation code link", () => {
    renderFooter();
    expect(screen.getByText("Have an activation code?")).toBeInTheDocument();
    expect(screen.getByText("Click here")).toBeInTheDocument();
  });

  it("renders the Red Hat universal footer", () => {
    renderFooter();
    expect(screen.getByTestId("rh-footer-universal")).toBeInTheDocument();
  });

  it("renders footer copyright", () => {
    renderFooter();
    expect(screen.getByTestId("rh-footer-copyright")).toBeInTheDocument();
  });
});
