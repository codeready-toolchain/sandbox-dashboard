import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as registrationApi from "../../../api/registration";
import {
  AnalyticsContext,
  noopAnalyticsContext,
} from "../../../hooks/AnalyticsContext";
import { UserContext, type UserContextType } from "../../../hooks/UserContext";
import { UserSignupPhase } from "../../../hooks/userSignupPhase";
import { readyUserFixture } from "../../../mocks/fixtures";
import { IntentEvent } from "../../../utils/analytics";
import { AccessCodeInputModal } from "../AccessCodeInputModal";

const trackIntent = vi.fn();

vi.mock("../../../api/registration", () => ({
  verifyActivationCode: vi.fn(),
}));

const mockOnClose = vi.fn();

function makeUserContext(
  overrides: Partial<UserContextType> = {},
): UserContextType {
  return {
    user: readyUserFixture,
    userSignupPhase: UserSignupPhase.NOT_STARTED,
    refetchUserData: vi.fn().mockResolvedValue(undefined),
    signupUser: vi.fn(),
    ...overrides,
  };
}

function renderModal(
  isOpen = true,
  userOverrides: Partial<UserContextType> = {},
) {
  const ctx = makeUserContext(userOverrides);
  const result = render(
    <AnalyticsContext.Provider value={{ ...noopAnalyticsContext, trackIntent }}>
      <UserContext.Provider value={ctx}>
        <AccessCodeInputModal isOpen={isOpen} onClose={mockOnClose} />
      </UserContext.Provider>
    </AnalyticsContext.Provider>,
  );
  return { ...result, ctx };
}

function getCodeBox(index: number) {
  return screen.getByLabelText(`Activation code character ${index + 1}`);
}

describe("AccessCodeInputModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal(false);
    expect(
      screen.queryByRole("dialog", { name: "Enter the activation code" }),
    ).not.toBeInTheDocument();
  });

  it("renders the 5 code boxes", () => {
    renderModal();
    expect(screen.getByText("Enter the activation code")).toBeInTheDocument();
    expect(
      screen.getByText("If you have an activation code, enter it now."),
    ).toBeInTheDocument();
    for (let i = 0; i < 5; i++) {
      expect(getCodeBox(i)).toBeInTheDocument();
    }
    expect(screen.getByText("Start trial")).toBeInTheDocument();
  });

  it("shows validation error when not all characters entered", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(getCodeBox(0), "A");
    await user.click(screen.getByText("Start trial"));

    expect(
      screen.getByText(/Please enter all 5 characters of your activation code/),
    ).toBeInTheDocument();
  });

  it("submits the full code and calls refetchUserData", async () => {
    vi.mocked(registrationApi.verifyActivationCode).mockResolvedValue();
    const user = userEvent.setup();
    const { ctx } = renderModal();

    await user.type(getCodeBox(0), "A");
    await user.type(getCodeBox(1), "B");
    await user.type(getCodeBox(2), "C");
    await user.type(getCodeBox(3), "D");
    await user.type(getCodeBox(4), "E");
    await user.click(screen.getByText("Start trial"));

    await waitFor(() => {
      expect(ctx.refetchUserData).toHaveBeenCalledTimes(1);
    });
    expect(registrationApi.verifyActivationCode).toHaveBeenCalledWith("ABCDE");
  });

  it("closes the modal after a successful refetch", async () => {
    vi.mocked(registrationApi.verifyActivationCode).mockResolvedValue();
    const user = userEvent.setup();
    renderModal();

    await user.type(getCodeBox(0), "A");
    await user.type(getCodeBox(1), "B");
    await user.type(getCodeBox(2), "C");
    await user.type(getCodeBox(3), "D");
    await user.type(getCodeBox(4), "E");
    await user.click(screen.getByText("Start trial"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
    expect(trackIntent).toHaveBeenCalledWith(
      IntentEvent.activationCodeAccepted,
      "Catalog",
    );
  });

  it("shows an error when refetchUserData fails after a successful activation", async () => {
    vi.mocked(registrationApi.verifyActivationCode).mockResolvedValue();
    const user = userEvent.setup();
    renderModal(true, {
      refetchUserData: vi.fn().mockRejectedValue(new Error("refetch failed")),
    });

    await user.type(getCodeBox(0), "A");
    await user.type(getCodeBox(1), "B");
    await user.type(getCodeBox(2), "C");
    await user.type(getCodeBox(3), "D");
    await user.type(getCodeBox(4), "E");
    await user.click(screen.getByText("Start trial"));

    await waitFor(() => {
      expect(
        screen.getByText(
          /The activation code was accepted, but we were unable to refresh/,
        ),
      ).toBeInTheDocument();
    });
  });

  it("retries only the refetch when the activation code was already accepted", async () => {
    vi.mocked(registrationApi.verifyActivationCode).mockResolvedValue();
    const mockRefetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("refetch failed"))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal(true, { refetchUserData: mockRefetch });

    await user.type(getCodeBox(0), "A");
    await user.type(getCodeBox(1), "B");
    await user.type(getCodeBox(2), "C");
    await user.type(getCodeBox(3), "D");
    await user.type(getCodeBox(4), "E");

    // First attempt: verification succeeds, refetch fails.
    await user.click(screen.getByText("Start trial"));
    await waitFor(() => {
      expect(screen.getByText(/unable to refresh/)).toBeInTheDocument();
    });
    expect(registrationApi.verifyActivationCode).toHaveBeenCalledTimes(1);

    // Second attempt: should skip verification, retry only the refetch.
    await user.click(screen.getByText("Start trial"));
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
    expect(registrationApi.verifyActivationCode).toHaveBeenCalledTimes(1);
    expect(mockRefetch).toHaveBeenCalledTimes(2);
    expect(trackIntent).toHaveBeenCalledTimes(1);
  });

  it("shows error from API", async () => {
    vi.mocked(registrationApi.verifyActivationCode).mockRejectedValue(
      new Error("Invalid code"),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(getCodeBox(0), "X");
    await user.type(getCodeBox(1), "Y");
    await user.type(getCodeBox(2), "Z");
    await user.type(getCodeBox(3), "1");
    await user.type(getCodeBox(4), "2");
    await user.click(screen.getByText("Start trial"));

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to verify your code/),
      ).toBeInTheDocument();
    });
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("auto-advances focus to the next box on character entry", async () => {
    const user = userEvent.setup();
    renderModal();

    const box0 = getCodeBox(0);
    await user.click(box0);
    await user.type(box0, "A");

    expect(getCodeBox(1)).toHaveFocus();
  });

  it("prevents duplicate submissions on rapid double-click", async () => {
    let resolveCall: (() => void) | undefined;
    vi.mocked(registrationApi.verifyActivationCode).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCall = resolve;
        }),
    );

    const user = userEvent.setup();
    const { ctx } = renderModal();

    await user.type(getCodeBox(0), "A");
    await user.type(getCodeBox(1), "B");
    await user.type(getCodeBox(2), "C");
    await user.type(getCodeBox(3), "D");
    await user.type(getCodeBox(4), "E");

    const submitBtn = screen.getByRole("button", { name: /Start trial/ });
    await user.click(submitBtn);
    await user.click(submitBtn);

    expect(registrationApi.verifyActivationCode).toHaveBeenCalledTimes(1);

    resolveCall!();
    await waitFor(() => {
      expect(ctx.refetchUserData).toHaveBeenCalledTimes(1);
    });
  });
});
