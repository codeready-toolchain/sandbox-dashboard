import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogGrid } from "../CatalogGrid";
import { SandboxContext } from "../../../hooks/SandboxContext";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { readyUserFixture } from "../../../mocks/fixtures";
import { productData } from "../productData";
import { UserStatus } from "../../../types";
import type { SignupData } from "../../../types";
import { Product } from "../../../hooks/useProductURLs";
import { act } from "react";

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

describe("CatalogGrid", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("does not show delete button when OpenClaw status is UNKNOWN", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.UNKNOWN })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );
    const deleteButtons = screen.queryAllByTestId("catalog-card-delete");
    const openclawDeleteBtn = deleteButtons.find((btn) =>
      btn
        .closest("[data-testid='catalog-card']")
        ?.textContent?.includes(
          productData.find((p) => p.id === Product.OPENCLAW)?.title ?? "",
        ),
    );
    expect(openclawDeleteBtn).toBeUndefined();
  });

  it("passes fresh namespace from refetch to handleAAPInstance after signup", async () => {
    const freshNamespace = "fresh-user-ns";
    const freshUserData: SignupData = {
      ...readyUserFixture,
      defaultUserNamespace: freshNamespace,
    };

    const handleAAPInstance = vi.fn();
    const refetchUserData = vi.fn().mockResolvedValue(freshUserData);
    const signupUser = vi.fn().mockResolvedValue(undefined);

    const ctx = makeContext({
      userStatus: UserStatus.NEW,
      userReady: false,
      userFound: false,
      userData: undefined,
      signupUser,
      refetchUserData,
      handleAAPInstance,
      disabledIntegrations: [],
    });

    render(
      <SandboxContext.Provider value={ctx}>
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = productData.find((p) => p.id === Product.AAP);
    if (!aapCard) throw new Error("AAP card not found in productData");

    const tryItButtons = screen.getAllByText("Try it");
    const aapTryIt = tryItButtons.find((btn) =>
      btn
        .closest("[data-testid='catalog-card']")
        ?.textContent?.includes(aapCard.title),
    );
    expect(aapTryIt).toBeDefined();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(aapTryIt!);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => {
      expect(handleAAPInstance).toHaveBeenCalledWith(freshNamespace);
    });
  });
});
