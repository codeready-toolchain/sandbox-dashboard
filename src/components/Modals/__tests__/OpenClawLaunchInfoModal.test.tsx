import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserFacingError } from "../../../error/UserFacingError";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import {
  OpenClawContext,
  type OpenClawContextType,
} from "../../../hooks/OpenClawContext";
import { ProductType } from "../../../types/product";
import { OpenClawStatus } from "../../../utils/openclaw-utils";
import { products } from "../../Catalog/productData";
import { OpenClawLaunchInfoModal } from "../OpenClawLaunchInfoModal";

const openClawProduct = products.find(
  (product) => product.type === ProductType.OPENCLAW,
)!;

const resumeErrorTitle = "Unable to resume your OpenClaw instance";
const setupErrorTitle = "Unable to set up your OpenClaw instance";

function makeOpenClawContext(status: OpenClawStatus): OpenClawContextType {
  return {
    clearDeletionError: vi.fn(),
    clearProvisioningError: vi.fn(),
    deleteInstance: vi.fn().mockResolvedValue(undefined),
    deletionError: undefined,
    provisioningError: undefined,
    startProvisioning: vi.fn().mockResolvedValue(undefined),
    status,
    uiURL: undefined,
    unidleInstance: vi.fn().mockResolvedValue(undefined),
  };
}

function renderErrorModal(status: OpenClawStatus, title: string) {
  render(
    <AnalyticsContext.Provider value={noopAnalyticsContext}>
      <OpenClawContext.Provider value={makeOpenClawContext(status)}>
        <OpenClawLaunchInfoModal
          isOpen
          onClose={vi.fn()}
          product={openClawProduct}
          provisioningError={
            new UserFacingError(title, "Please try again later.")
          }
          onLaunch={vi.fn()}
          onProvisioningErrorDismissed={vi.fn()}
          onClickProvision={vi.fn().mockResolvedValue(undefined)}
        />
      </OpenClawContext.Provider>
    </AnalyticsContext.Provider>,
  );
}

/**
 * Covers the error-modal heading: resume failures keep the resume title
 * after the instance status leaves IDLED or UNIDLING, and other failures
 * keep the setup title.
 */
describe("OpenClawLaunchInfoModal error heading", () => {
  it("keeps the resume heading when a resume failure is reported as FAILED", () => {
    renderErrorModal(OpenClawStatus.FAILED, resumeErrorTitle);

    expect(
      screen.getByRole("dialog", { name: "Resume OpenClaw instance" }),
    ).toBeInTheDocument();
    expect(screen.getByText(resumeErrorTitle)).toBeInTheDocument();
  });

  it("uses the setup heading when a setup failure is reported as FAILED", () => {
    renderErrorModal(OpenClawStatus.FAILED, setupErrorTitle);

    expect(
      screen.getByRole("dialog", { name: "Set up OpenClaw instance" }),
    ).toBeInTheDocument();
  });

  it("uses the resume heading while the instance is still idled", () => {
    renderErrorModal(OpenClawStatus.IDLED, setupErrorTitle);

    expect(
      screen.getByRole("dialog", { name: "Resume OpenClaw instance" }),
    ).toBeInTheDocument();
  });

  it("uses the resume heading while the instance is still unidling", () => {
    renderErrorModal(OpenClawStatus.UNIDLING, "Something else went wrong");

    expect(
      screen.getByRole("dialog", { name: "Resume OpenClaw instance" }),
    ).toBeInTheDocument();
  });

  it("uses the setup heading for provisioning failures", () => {
    renderErrorModal(OpenClawStatus.PROVISIONING, setupErrorTitle);

    expect(
      screen.getByRole("dialog", { name: "Set up OpenClaw instance" }),
    ).toBeInTheDocument();
  });

  it("uses the setup heading when the instance has not been created", () => {
    renderErrorModal(OpenClawStatus.NEW, "Unable to determine the status");

    expect(
      screen.getByRole("dialog", { name: "Set up OpenClaw instance" }),
    ).toBeInTheDocument();
  });
});

describe("OpenClawLaunchInfoModal launch", () => {
  it("tracks a product open when the instance URL is launched", async () => {
    const user = userEvent.setup();
    const trackProductAction = vi.fn();
    const onLaunch = vi.fn();

    render(
      <AnalyticsContext.Provider
        value={{ ...noopAnalyticsContext, trackProductAction }}
      >
        <OpenClawContext.Provider
          value={{
            ...makeOpenClawContext(OpenClawStatus.READY),
            uiURL: "https://openclaw.example.com",
          }}
        >
          <OpenClawLaunchInfoModal
            isOpen
            onClose={vi.fn()}
            product={openClawProduct}
            onLaunch={onLaunch}
            onProvisioningErrorDismissed={vi.fn()}
            onClickProvision={vi.fn().mockResolvedValue(undefined)}
          />
        </OpenClawContext.Provider>
      </AnalyticsContext.Provider>,
    );

    const link = screen.getByRole("link", { name: "Launch" });
    expect(link).toHaveAttribute("data-analytics-text", "OpenClaw");
    expect(link).not.toHaveAttribute("data-analytics-offerid");

    await user.click(link);

    expect(trackProductAction).toHaveBeenCalledWith(
      openClawProduct,
      "opened",
      "https://openclaw.example.com",
    );
    expect(onLaunch).toHaveBeenCalledWith(openClawProduct);
  });
});
