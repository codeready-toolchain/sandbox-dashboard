import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  UserContext,
  UserSignupPhase,
  type UserContextType,
} from "../../../hooks/UserContext";
import { readyUserFixture } from "../../../mocks/fixtures";
import { CatalogPage } from "../CatalogPage";

vi.mock("../CatalogBanner", () => ({
  CatalogBanner: () => <div data-testid="catalog-banner" />,
}));

vi.mock("../CatalogGrid", () => ({
  CatalogGrid: () => <div data-testid="catalog-grid" />,
}));

vi.mock("../CatalogFooter", () => ({
  CatalogFooter: () => <div data-testid="catalog-footer" />,
}));

let capturedOnVerified: (() => void) | undefined;

vi.mock("../../Modals", () => ({
  AccessCodeInputModal: ({
    isOpen,
    onVerified,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onVerified: () => void;
  }) => {
    capturedOnVerified = onVerified;
    return isOpen ? <div data-testid="access-code-modal" /> : null;
  },
}));

function makeSandboxContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.READY,
    refetchUserData: vi.fn().mockResolvedValue(undefined),
    signupUser: vi.fn(),
    ...overrides,
  };
}

function renderPage(overrides: Partial<UserContextType> = {}) {
  const ctx = makeSandboxContext(overrides);
  const result = render(
    <UserContext.Provider value={ctx}>
      <CatalogPage />
    </UserContext.Provider>,
  );
  return { ...result, ctx };
}

describe("CatalogPage", () => {
  beforeEach(() => {
    capturedOnVerified = undefined;
  });

  it("renders activation code link", () => {
    renderPage();
    expect(screen.getByText("Have an activation code?")).toBeInTheDocument();
    expect(screen.getByText("Click here")).toBeInTheDocument();
  });

  it("opens modal when 'Click here' is clicked", async () => {
    renderPage();
    expect(screen.queryByTestId("access-code-modal")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Click here"));
    expect(screen.getByTestId("access-code-modal")).toBeInTheDocument();
  });

  it("closes modal and calls refetchUserData when onVerified fires", async () => {
    const { ctx } = renderPage();

    await userEvent.click(screen.getByText("Click here"));
    expect(screen.getByTestId("access-code-modal")).toBeInTheDocument();

    await act(() => {
      capturedOnVerified!();
    });

    expect(screen.queryByTestId("access-code-modal")).not.toBeInTheDocument();
    expect(ctx.refetchUserData).toHaveBeenCalledTimes(1);
  });
});
