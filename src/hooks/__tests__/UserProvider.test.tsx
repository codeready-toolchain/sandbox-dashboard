import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setTokenGetter } from "../../api/authFetch";
import { server } from "../../mocks/server";
import { NotificationProvider } from "../../notifications/NotificationProvider";
import { UserSignupPhase, useUserContext } from "../UserContext";
import { UserProvider } from "../UserProvider";

function ContextConsumer() {
  const ctx = useUserContext();
  return (
    <div>
      <span data-testid="phase">{ctx.userSignupPhase}</span>
      <span data-testid="givenName">{ctx.user?.givenName ?? ""}</span>
      <span data-testid="username">{ctx.user?.username ?? ""}</span>
      <span data-testid="ready">{String(ctx.user?.status?.ready ?? "")}</span>
      <button data-testid="signup-btn" onClick={() => ctx.signupUser()}>
        Sign Up
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <NotificationProvider>
      <UserProvider>
        <ContextConsumer />
      </UserProvider>
    </NotificationProvider>,
  );
}

beforeAll(() => {
  window.__config__ = {
    registrationServiceURL: "https://registration.example.com",
    recaptchaSiteKey: "test-site-key",
    environment: "dev",
  };
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("UserProvider", () => {
  it("fetches user data and provides it via context", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.READY),
      );
    });

    expect(screen.getByTestId("givenName").textContent).toBe("John");
    expect(screen.getByTestId("username").textContent).toBe("johndoe");
    expect(screen.getByTestId("ready").textContent).toBe("true");
  });

  it("sets signup phase to NOT_STARTED when the user does not exist", async () => {
    server.use(
      http.get("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 404 });
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.NOT_STARTED),
      );
    });

    expect(screen.getByTestId("givenName").textContent).toBe("");
  });

  it("renders CriticalErrorPage when the initial fetch fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    server.use(
      http.get("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    renderProvider();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load the Developer Sandbox"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/We're unable to load your account information/),
    ).toBeInTheDocument();
  });

  it("maps verification-required status to PENDING_PHONE_VERIFICATION phase", async () => {
    server.use(
      http.get("*/api/v1/signup", () => {
        return HttpResponse.json({
          name: "Jane Doe",
          compliantUsername: "janedoe",
          username: "janedoe",
          givenName: "Jane",
          familyName: "Doe",
          company: "Red Hat",
          status: {
            ready: false,
            reason: "",
            verificationRequired: true,
          },
        });
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.PENDING_PHONE_VERIFICATION),
      );
    });
  });

  it("maps provisioning status to PROVISIONING phase", async () => {
    server.use(
      http.get("*/api/v1/signup", () => {
        return HttpResponse.json({
          name: "Jane Doe",
          compliantUsername: "janedoe",
          username: "janedoe",
          givenName: "Jane",
          familyName: "Doe",
          company: "Red Hat",
          status: {
            ready: false,
            reason: "Provisioning",
            verificationRequired: false,
          },
        });
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.PROVISIONING),
      );
    });
  });

  it("maps pending approval status to PENDING_MANUAL_APPROVAL phase", async () => {
    server.use(
      http.get("*/api/v1/signup", () => {
        return HttpResponse.json({
          name: "Jane Doe",
          compliantUsername: "janedoe",
          username: "janedoe",
          givenName: "Jane",
          familyName: "Doe",
          company: "Red Hat",
          status: {
            ready: false,
            reason: "PendingApproval",
            verificationRequired: false,
          },
        });
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.PENDING_MANUAL_APPROVAL),
      );
    });
  });

  it("transitions to SIGNING_UP phase and shows info alert when signupUser is called", async () => {
    server.use(
      http.get("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.post("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.NOT_STARTED),
      );
    });

    await userEvent.click(screen.getByTestId("signup-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.SIGNING_UP),
      );
    });

    expect(
      screen.getByText("Setting up your access to Developer Sandbox"),
    ).toBeInTheDocument();
  });

  it("shows danger alert and resets phase when signup API returns an error", async () => {
    server.use(
      http.get("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.post("*/api/v1/signup", () => {
        return new HttpResponse(JSON.stringify({ message: "forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.NOT_STARTED),
      );
    });

    await userEvent.click(screen.getByTestId("signup-btn"));

    await waitFor(() => {
      expect(screen.getByText("Unable to sign you up")).toBeInTheDocument();
    });

    expect(screen.getByTestId("phase").textContent).toBe(
      String(UserSignupPhase.NOT_STARTED),
    );
  });

  it("does not call signup twice when signupUser is invoked concurrently", async () => {
    let signupCallCount = 0;
    server.use(
      http.get("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.post("*/api/v1/signup", async () => {
        signupCallCount++;
        await new Promise((r) => setTimeout(r, 100));
        return new HttpResponse(null, { status: 200 });
      }),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.NOT_STARTED),
      );
    });

    const btn = screen.getByTestId("signup-btn");
    await userEvent.click(btn);
    await userEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.SIGNING_UP),
      );
    });

    expect(signupCallCount).toBe(1);
  });

  it("polls and transitions to READY with notification after signup completes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let getCallCount = 0;
    server.use(
      http.get("*/api/v1/signup", () => {
        getCallCount++;
        if (getCallCount <= 1) {
          return new HttpResponse(null, { status: 404 });
        }
        if (getCallCount === 2) {
          return HttpResponse.json({
            name: "John Doe",
            compliantUsername: "johndoe",
            username: "johndoe",
            givenName: "John",
            familyName: "Doe",
            company: "Red Hat",
            status: {
              ready: false,
              reason: "Provisioning",
              verificationRequired: false,
            },
          });
        }
        return HttpResponse.json({
          name: "John Doe",
          compliantUsername: "johndoe",
          username: "johndoe",
          givenName: "John",
          familyName: "Doe",
          company: "Red Hat",
          status: {
            ready: true,
            reason: "",
            verificationRequired: false,
          },
          defaultUserNamespace: "johndoe-dev",
          consoleURL: "https://console.apps.example.com",
          proxyURL: "https://proxy.example.com",
        });
      }),
      http.post("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    renderProvider();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.NOT_STARTED),
      );
    });

    await act(async () => {
      screen.getByTestId("signup-btn").click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.READY),
      );
    });

    expect(screen.getByText("Everything is set!")).toBeInTheDocument();
  });

  it("transitions to PROVISIONING_TIMED_OUT (not NOT_STARTED) when provisioning exceeds 60 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let getCallCount = 0;
    server.use(
      http.get("*/api/v1/signup", () => {
        getCallCount++;
        if (getCallCount <= 1) {
          return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({
          name: "John Doe",
          compliantUsername: "johndoe",
          username: "johndoe",
          givenName: "John",
          familyName: "Doe",
          company: "Red Hat",
          status: {
            ready: false,
            reason: "Provisioning",
            verificationRequired: false,
          },
        });
      }),
      http.post("*/api/v1/signup", () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    renderProvider();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.NOT_STARTED),
      );
    });

    await act(async () => {
      screen.getByTestId("signup-btn").click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.PROVISIONING),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.PROVISIONING_TIMED_OUT),
      );
    });

    expect(
      screen.getByText("Unable to set up your Developer Sandbox account"),
    ).toBeInTheDocument();
  });

  it("does not allow signupUser when phase is PROVISIONING_TIMED_OUT", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let getCallCount = 0;
    let signupCallCount = 0;
    server.use(
      http.get("*/api/v1/signup", () => {
        getCallCount++;
        if (getCallCount <= 1) {
          return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({
          name: "John Doe",
          compliantUsername: "johndoe",
          username: "johndoe",
          givenName: "John",
          familyName: "Doe",
          company: "Red Hat",
          status: {
            ready: false,
            reason: "Provisioning",
            verificationRequired: false,
          },
        });
      }),
      http.post("*/api/v1/signup", () => {
        signupCallCount++;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    renderProvider();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      screen.getByTestId("signup-btn").click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(66_000);
    });

    await waitFor(() => {
      expect(screen.getByTestId("phase").textContent).toBe(
        String(UserSignupPhase.PROVISIONING_TIMED_OUT),
      );
    });

    expect(signupCallCount).toBe(1);

    await act(async () => {
      screen.getByTestId("signup-btn").click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(signupCallCount).toBe(1);
  });
});

describe("useUserContext", () => {
  it("throws when used outside UserProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<ContextConsumer />)).toThrow(
      "Context useUserContext is not defined",
    );

    consoleError.mockRestore();
  });
});
