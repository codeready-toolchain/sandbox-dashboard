import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import type { SandboxContextType } from "../../../hooks/SandboxContext";
import { SandboxContext } from "../../../hooks/SandboxContext";
import { Product } from "../../../hooks/useProductURLs";
import { readyUserFixture } from "../../../mocks/fixtures";
import type { SignupData } from "../../../types";
import { UserStatus } from "../../../types";
import { AnsibleStatus } from "../../../utils/aap-utils";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { CatalogGrid } from "../CatalogGrid";
import { productData } from "../productData";

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

  it("hides delete button and shows 'Deleting...' on main button when OpenClaw status is DELETING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.DELETING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    expect(
      openclawCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton).toBeDefined();
    expect(mainButton.textContent).toContain("Deleting...");
    expect(mainButton).toBeDisabled();
  });

  it("hides delete button and shows 'Deleting...' on main button when OpenClaw status is TERMINATING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.TERMINATING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    expect(
      openclawCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Deleting...");
    expect(mainButton).toBeDisabled();
  });

  it("shows 'Provisioning...' on main button when OpenClaw status is PROVISIONING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.PROVISIONING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("shows 'Provision' on AAP card when ansibleStatus is NEW", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.NEW })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");
  });

  it("shows 'Provisioning...' on AAP card when ansibleStatus is PROVISIONING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.PROVISIONING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provisioning...");
  });

  it("shows 'Launch' on AAP card when ansibleStatus is READY", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.READY })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Launch");
  });

  it("shows 'Re-provision' on AAP card when ansibleStatus is IDLED", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.IDLED })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();

    const mainButton = aapCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("hides delete button on AAP card when ansibleStatus is NEW", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.NEW })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();
  });

  it("hides delete button on AAP card when ansibleStatus is NOT_DEPLOYED", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.NOT_DEPLOYED })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();
  });

  it("shows delete button on AAP card when ansibleStatus is READY", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.READY })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).not.toBeNull();
  });

  it("shows delete button on AAP card when ansibleStatus is PROVISIONING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.PROVISIONING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(
      aapCard!.querySelector("[data-testid='delete-instance-button']"),
    ).not.toBeNull();
  });

  it("renders 'Ready' status label on OpenClaw card when status is READY", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.READY })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Ready");

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Launch");
  });

  it("renders 'Idled' status label on OpenClaw card when status is IDLED", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.IDLED })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Idled");

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Re-provision");
  });

  it("renders 'Failed' status label and 'Provision' button on OpenClaw card when status is FAILED", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.FAILED })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Failed");

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Provision");
    expect(mainButton.textContent).not.toContain("Provisioning");

    expect(
      openclawCard!.querySelector("[data-testid='delete-instance-button']"),
    ).not.toBeNull();
  });

  it("renders 'Deleting' status label on OpenClaw card when status is DELETING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.DELETING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();
    expect(openclawCard!.textContent).toContain("Deleting");
  });

  it("renders 'Ready' status label on AAP card when ansibleStatus is READY", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.READY })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(aapCard!.textContent).toContain("Ready");
  });

  it("renders 'Provisioning' status label on AAP card when ansibleStatus is PROVISIONING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ ansibleStatus: AnsibleStatus.PROVISIONING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const aapCard = screen
      .getAllByTestId("catalog-card")
      .find((card) =>
        card.textContent?.includes("Ansible Automation Platform"),
      );
    expect(aapCard).toBeDefined();
    expect(aapCard!.textContent).toContain("Provisioning");
  });

  it("shows default 'Try it' button on non-AAP/non-OpenClaw products regardless of statuses", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({
          ansibleStatus: AnsibleStatus.READY,
          openclawStatus: OpenClawStatus.READY,
        })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openshiftCard = screen
      .getAllByTestId("catalog-card")
      .find(
        (card) =>
          card.textContent?.includes("OpenShift") &&
          !card.textContent?.includes("OpenShift AI") &&
          !card.textContent?.includes("OpenShift Virtualization"),
      );
    expect(openshiftCard).toBeDefined();

    const mainButton = openshiftCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton.textContent).toContain("Try it");

    expect(
      openshiftCard!.querySelector("[data-testid='delete-instance-button']"),
    ).toBeNull();

    expect(openshiftCard!.textContent).not.toContain("Ready");
    expect(openshiftCard!.textContent).not.toContain("Provisioning");
  });

  it("does not disable the main button when OpenClaw status is PROVISIONING", () => {
    render(
      <SandboxContext.Provider
        value={makeContext({ openclawStatus: OpenClawStatus.PROVISIONING })}
      >
        <CatalogGrid />
      </SandboxContext.Provider>,
    );

    const openclawCard = screen
      .getAllByTestId("catalog-card")
      .find((card) => card.textContent?.includes("OpenClaw"));
    expect(openclawCard).toBeDefined();

    const mainButton = openclawCard!.querySelector(
      "[data-testid='try-it-button']",
    ) as HTMLButtonElement;
    expect(mainButton).not.toBeDisabled();
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

    const tryItButtons = screen.getAllByText("Provision");
    const aapProvision = tryItButtons.find((btn) =>
      btn
        .closest("[data-testid='catalog-card']")
        ?.textContent?.includes(aapCard.title),
    );
    expect(aapProvision).toBeDefined();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(aapProvision!);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => {
      expect(handleAAPInstance).toHaveBeenCalledWith(freshNamespace);
    });
  });
});
