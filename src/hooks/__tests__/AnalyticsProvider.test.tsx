import { AnalyticsBrowser } from "@segment/analytics-next";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { setTokenGetter } from "../../api/authFetch";
import { server } from "../../mocks/server";
import type { User } from "../../types";
import { type Product, ProductType } from "../../types/product";
import { IntentEvent } from "../../utils/analytics";
import * as cookieUtils from "../../utils/cookie-utils";
import { useAnalyticsContext } from "../AnalyticsContext";
import { AnalyticsProvider } from "../AnalyticsProvider";
import { UserContext } from "../UserContext";
import { UserSignupPhase } from "../userSignupPhase";

vi.mock("@segment/analytics-next", () => ({
  AnalyticsBrowser: {
    load: vi.fn(),
  },
}));

vi.mock("../../utils/cookie-utils", () => ({
  getCookie: vi.fn(() => ""),
  setCookie: vi.fn(),
}));

const mockUser: User = {
  name: "John Doe",
  compliantUsername: "jdoe",
  username: "jdoe",
  givenName: "John",
  familyName: "Doe",
  company: "Red Hat",
  email: "jdoe@redhat.com",
  userID: "user-123",
  accountID: "account-456",
  accountNumber: "EBS789",
  status: { ready: true, reason: "Provisioned", verificationRequired: false },
};

const mockUserContext = {
  refetchUserData: vi.fn(),
  signupUser: vi.fn(),
  user: mockUser,
  userSignupPhase: UserSignupPhase.READY,
};

const mockProduct: Product = {
  type: ProductType.OPENSHIFT_CONSOLE,
  title: "OpenShift",
  image: "openshift.svg",
  urlTemplate: "{{consoleURL}}",
  description: [{ bulletPoint: "Test" }],
};

const openClawProduct: Product = {
  type: ProductType.OPENCLAW,
  title: "OpenClaw",
  image: "openclaw.svg",
  description: [{ bulletPoint: "Test" }],
};

function TrackButton() {
  const { trackAnalytics, trackProductAction, trackIntent } =
    useAnalyticsContext();
  return (
    <div>
      <button
        data-testid="track-catalog"
        onClick={() =>
          trackProductAction(
            mockProduct,
            "opened",
            "https://console.example.com",
          )
        }
      >
        Track Catalog
      </button>
      <button
        data-testid="track-setup"
        onClick={() => trackProductAction(mockProduct, "set-up")}
      >
        Track Setup
      </button>
      <button
        data-testid="track-openclaw"
        onClick={() => trackProductAction(openClawProduct, "set-up")}
      >
        Track OpenClaw
      </button>
      <button
        data-testid="track-activity-cta"
        onClick={() =>
          trackAnalytics(
            "Getting Started",
            "Activities",
            "https://example.com",
            "cta",
          )
        }
      >
        Track Activity CTA
      </button>
      <button
        data-testid="track-activities"
        onClick={() => trackAnalytics("Docs", "Support", "https://example.com")}
      >
        Track Activities
      </button>
      <button
        data-testid="track-intent"
        onClick={() => trackIntent(IntentEvent.phoneVerified, "Verification")}
      >
        Track Intent
      </button>
    </div>
  );
}

function renderProvider(overrides?: Partial<typeof mockUserContext>) {
  const userCtx = { ...mockUserContext, ...overrides };

  return render(
    <UserContext.Provider value={userCtx}>
      <AnalyticsProvider>
        <TrackButton />
      </AnalyticsProvider>
    </UserContext.Provider>,
  );
}

beforeAll(() => {
  window.__config__ = {
    registrationServiceURL: "https://registration.example.com",
    recaptchaSiteKey: "test-site-key",
    environment: "prod",
  };
  setTokenGetter(async () => "test-token");
  server.listen({ onUnhandledRequest: "bypass" });
});

beforeEach(() => {
  document.cookie = "cmapi_cookie_privacy=permit 1,2,3";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  server.resetHandlers();
  document.cookie =
    "cmapi_cookie_privacy=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.getElementById("dpal")?.remove();
});

afterAll(() => server.close());

describe("AnalyticsProvider", () => {
  it("initializes Segment SDK with write key in production", async () => {
    const mockTrack = vi.fn();
    const mockIdentify = vi.fn();
    const mockGroup = vi.fn();
    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: mockTrack,
      identify: mockIdentify,
      group: mockGroup,
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("test-write-key-123"),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalledWith({
        writeKey: "test-write-key-123",
      });
    });
  });

  it("does not fetch write key in dev environment", async () => {
    window.__config__ = {
      registrationServiceURL: "https://registration.example.com",
      recaptchaSiteKey: "test-site-key",
      environment: "dev",
    };

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
    });

    renderProvider();

    // Give it time to NOT fetch
    await new Promise((r) => setTimeout(r, 50));
    expect(AnalyticsBrowser.load).not.toHaveBeenCalled();

    // Restore prod config for other tests
    window.__config__ = {
      registrationServiceURL: "https://registration.example.com",
      recaptchaSiteKey: "test-site-key",
      environment: "prod",
    };
  });

  it("calls identify with userID, company, and email_domain", async () => {
    const mockIdentify = vi.fn();
    const mockGroup = vi.fn();
    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: mockIdentify,
      group: mockGroup,
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key"),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(mockIdentify).toHaveBeenCalledWith("user-123", {
        company: "Red Hat",
        email_domain: "redhat.com",
      });
    });
  });

  it("calls group with accountID and ebs trait", async () => {
    const mockGroup = vi.fn();
    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: mockGroup,
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key"),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(mockGroup).toHaveBeenCalledWith("account-456", { ebs: "EBS789" });
    });
  });

  it("tracks CTA events as 'launched' and default events as 'clicked'", async () => {
    const mockTrack = vi.fn();
    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: mockTrack,
      identify: vi.fn(),
      group: vi.fn(),
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key"),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalled();
    });

    const user = userEvent.setup();

    await user.click(screen.getByTestId("track-catalog"));

    expect(mockTrack).toHaveBeenCalledWith("Product opened", {
      category: "Developer Sandbox|Catalog",
      regions: "sandbox-catalog",
      text: "OpenShift",
      productType: ProductType.OPENSHIFT_CONSOLE,
      action: "opened",
      href: "https://console.example.com",
      linkType: "cta",
      internalCampaign: "701Pe00000dnCEYIA2",
    });

    await user.click(screen.getByTestId("track-activity-cta"));

    expect(mockTrack).toHaveBeenCalledWith("Getting Started launched", {
      category: "Developer Sandbox|Activities",
      regions: "sandbox-activities",
      text: "Getting Started",
      href: "https://example.com",
      linkType: "cta",
    });

    await user.click(screen.getByTestId("track-activities"));

    expect(mockTrack).toHaveBeenCalledWith("Docs clicked", {
      category: "Developer Sandbox|Support",
      regions: "sandbox-support",
      text: "Docs",
      href: "https://example.com",
      linkType: "default",
    });

    await user.click(screen.getByTestId("track-intent"));

    expect(mockTrack).toHaveBeenCalledWith("Phone verified", {
      category: "Developer Sandbox|Verification",
      regions: "sandbox-verification",
    });
  });

  it("sends Marketo payload for Catalog section with correct structure", async () => {
    const marketoCalls: [string, RequestInit][] = [];
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "https://webhooks.example.com/sandbox") {
          marketoCalls.push([url, init as RequestInit]);
          return new Response(null, { status: 200 });
        }
        return originalFetch(input, init as RequestInit);
      });

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
    });

    (cookieUtils.getCookie as ReturnType<typeof vi.fn>).mockImplementation(
      (name: string) => {
        if (name === "rh_omni_tc") {
          return "RHCTN1234";
        }
        if (name === "rh_omni_itc") {
          return "RHCTE5678";
        }
        return "";
      },
    );

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key"),
      ),
      http.get("https://registration.example.com/api/v1/uiconfig", () =>
        HttpResponse.json({
          workatoWebHookURL: "https://webhooks.example.com/sandbox",
        }),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-catalog"));

    await waitFor(() => {
      expect(marketoCalls.length).toBeGreaterThan(0);
    });

    const body = JSON.parse(marketoCalls[0][1].body as string);
    expect(body).toMatchObject({
      C_FirstName: "John",
      C_LastName: "Doe",
      C_EmailAddress: "jdoe@redhat.com",
      C_Company: "Red Hat",
      F_FormData_Source: "sandbox-redhat-com-integration",
      A_OfferID: "701Pe00000dnCEYIA2",
      A_TacticID_External: "RHCTN1234",
      A_TacticID_Internal: "RHCTE5678",
      Status: "Engaged",
    });

    await user.click(screen.getByTestId("track-setup"));

    await waitFor(() => {
      expect(marketoCalls).toHaveLength(2);
    });
    const setupBody = JSON.parse(marketoCalls[1][1].body as string);
    expect(setupBody.A_OfferID).toBe("701Pe00000dnCEYIA2");

    await user.click(screen.getByTestId("track-openclaw"));
    await user.click(screen.getByTestId("track-intent"));
    await new Promise((r) => setTimeout(r, 50));

    expect(marketoCalls).toHaveLength(2);

    fetchSpy.mockRestore();
  });

  it("skips Marketo when email is missing", async () => {
    const marketoCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "https://webhooks.example.com/sandbox") {
          marketoCalls.push(url);
          return new Response(null, { status: 200 });
        }
        return originalFetch(input, init as RequestInit);
      });

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key"),
      ),
    );

    const userWithoutEmail = { ...mockUser, email: undefined };

    renderProvider({ user: userWithoutEmail });

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-catalog"));

    await new Promise((r) => setTimeout(r, 50));

    expect(marketoCalls).toHaveLength(0);

    fetchSpy.mockRestore();
  });

  it("skips Marketo when webhook URL is missing", async () => {
    const marketoCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "https://webhooks.example.com/sandbox") {
          marketoCalls.push(url);
          return new Response(null, { status: 200 });
        }
        return originalFetch(input, init as RequestInit);
      });

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key"),
      ),
      http.get(
        "https://registration.example.com/api/v1/uiconfig",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-catalog"));

    await new Promise((r) => setTimeout(r, 50));

    expect(marketoCalls).toHaveLength(0);

    fetchSpy.mockRestore();
  });

  it("does not fire Marketo for activity clicks or intent events", async () => {
    const marketoCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "https://webhooks.example.com/sandbox") {
          marketoCalls.push(url);
          return new Response(null, { status: 200 });
        }
        return originalFetch(input, init as RequestInit);
      });

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key"),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-activities"));
    await user.click(screen.getByTestId("track-intent"));

    await new Promise((r) => setTimeout(r, 50));

    expect(marketoCalls).toHaveLength(0);

    fetchSpy.mockRestore();
  });
});

describe("AnalyticsProvider consent granting", () => {
  it("arms analytics when the TrustArc cookie appears without a message event", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    document.cookie =
      "cmapi_cookie_privacy=; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
      reset: vi.fn(),
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key-after-accept"),
      ),
    );

    renderProvider();

    expect(AnalyticsBrowser.load).not.toHaveBeenCalled();
    expect(document.getElementById("dpal")).toBeNull();

    // Simulate TrustArc writing the cookie on Accept all without a
    // reliable window.postMessage for our listener.
    document.cookie = "cmapi_cookie_privacy=permit 1,2,3";

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await waitFor(() => {
      expect(document.getElementById("dpal")).not.toBeNull();
      expect(AnalyticsBrowser.load).toHaveBeenCalledWith({
        writeKey: "key-after-accept",
      });
    });

    const dpal = document.getElementById("dpal") as HTMLScriptElement;
    expect(dpal.src).toContain("https://www.redhat.com/ma/dpal.js");

    vi.useRealTimers();
  });

  it("keeps polling until the TrustArc cookie appears", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    document.cookie =
      "cmapi_cookie_privacy=; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
      reset: vi.fn(),
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key-late-accept"),
      ),
    );

    renderProvider();

    // A missing cookie is not a rejection. Advance well past a minute to
    // show polling does not give up while the visitor has not accepted.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });

    expect(document.getElementById("dpal")).toBeNull();
    expect(AnalyticsBrowser.load).not.toHaveBeenCalled();

    document.cookie = "cmapi_cookie_privacy=permit 1,2,3";

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await waitFor(() => {
      expect(document.getElementById("dpal")).not.toBeNull();
      expect(AnalyticsBrowser.load).toHaveBeenCalledWith({
        writeKey: "key-late-accept",
      });
    });

    vi.useRealTimers();
  });

  it("arms analytics on focus after the TrustArc cookie is written", async () => {
    document.cookie =
      "cmapi_cookie_privacy=; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
      reset: vi.fn(),
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key-on-focus"),
      ),
    );

    renderProvider();
    expect(document.getElementById("dpal")).toBeNull();

    document.cookie = "cmapi_cookie_privacy=permit 1,2,3";

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(document.getElementById("dpal")).not.toBeNull();
      expect(AnalyticsBrowser.load).toHaveBeenCalledWith({
        writeKey: "key-on-focus",
      });
    });
  });
});

describe("AnalyticsProvider consent revocation", () => {
  it("tears down Segment and blocks events after consent is revoked", async () => {
    const mockTrack = vi.fn();
    const mockReset = vi.fn();
    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: mockTrack,
      identify: vi.fn(),
      group: vi.fn(),
      reset: mockReset,
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        () => HttpResponse.text("key-revoke-test"),
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-catalog"));
    expect(mockTrack).toHaveBeenCalledTimes(1);

    // Revoke consent: clear cookie and fire postMessage to trigger listener.
    await act(async () => {
      document.cookie =
        "cmapi_cookie_privacy=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.dispatchEvent(new MessageEvent("message"));
    });

    expect(mockReset).toHaveBeenCalled();

    // Events should be blocked after revocation.
    mockTrack.mockClear();
    await user.click(screen.getByTestId("track-catalog"));
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("does not initialize Segment if consent is revoked during key retrieval", async () => {
    let resolveKey: (value: string) => void;
    const keyPromise = new Promise<string>((r) => {
      resolveKey = r;
    });

    server.use(
      http.get(
        "https://registration.example.com/api/v1/analytics/segment-write-key",
        async () => {
          const key = await keyPromise;
          return HttpResponse.text(key);
        },
      ),
    );

    (AnalyticsBrowser.load as ReturnType<typeof vi.fn>).mockReturnValue({
      track: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
      reset: vi.fn(),
    });

    renderProvider();

    // Revoke consent while the key fetch is still in-flight.
    await act(async () => {
      document.cookie =
        "cmapi_cookie_privacy=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.dispatchEvent(new MessageEvent("message"));
    });

    // Now let the key arrive after consent is already revoked.
    await act(async () => {
      resolveKey!("late-key");
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(AnalyticsBrowser.load).not.toHaveBeenCalled();
  });
});

describe("useAnalyticsContext", () => {
  it("throws when used outside AnalyticsProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    function BadConsumer() {
      useAnalyticsContext();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      "Context useAnalyticsContext is not defined",
    );

    consoleError.mockRestore();
  });
});
