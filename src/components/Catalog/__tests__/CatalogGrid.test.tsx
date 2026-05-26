import { render, screen } from "@testing-library/react";
import { CatalogGrid } from "../CatalogGrid";
import { SandboxContext } from "../../../hooks/SandboxContext";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { readyUserFixture } from "../../../mocks/fixtures";
import { productData } from "../productData";
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
    disabledIntegrations: [],
    ...overrides,
  };
}

describe("CatalogGrid", () => {
  it("renders nothing while disabledIntegrations is undefined", () => {
    const { container } = render(
      <SandboxContext.Provider
        value={makeContext({ disabledIntegrations: undefined })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders all product cards when no integrations are disabled", () => {
    render(
      <SandboxContext.Provider value={makeContext()}>
        <CatalogGrid />
      </SandboxContext.Provider>,
    );
    const cards = screen.getAllByTestId("catalog-card");
    expect(cards).toHaveLength(productData.length);
  });

  it("filters out disabled integrations", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({
          disabledIntegrations: [productData[0].id],
        })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );
    const cards = screen.getAllByTestId("catalog-card");
    expect(cards).toHaveLength(productData.length - 1);
  });
});
