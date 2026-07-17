import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsBrowser } from "@segment/analytics-next";
import { http, HttpResponse } from "msw";
import { setTokenGetter } from "../../api/authFetch";
import { server } from "../../mocks/server";
import { AnalyticsProvider } from "../AnalyticsProvider";
import { useAnalyticsContext } from "../AnalyticsContext";
import { UserContext, UserSignupPhase } from "../UserContext";
import { UIConfigurationContext } from "../UIConfigurationContext";
import * as cookieUtils from "../../utils/cookie-utils";
import type { User } from "../../types";
import { ProductType, type Product } from "../../types/product";

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

const mockUIConfig = {
  marketoWebhookURL: "https://webhooks.example.com/sandbox",
  disabledIntegrations: [],
};

const mockProduct: Product = {
  type: ProductType.OPENSHIFT_CONSOLE,
  title: "OpenShift",
  image: "openshift.svg",
  urlTemplate: "{{consoleURL}}",
  description: [{ bulletPoint: "Test" }],
};

function TrackButton() {
  const { trackAnalytics } = useAnalyticsContext();
  return (
    <div>
      <button
        data-testid="track-catalog"
        onClick={() =>
          trackAnalytics(
            mockProduct,
            "Catalog",
            "https://console.example.com",
            "cta",
          )
        }
      >
        Track Catalog
      </button>
      <button
        data-testid="track-activities"
        onClick={() =>
          trackAnalytics("Getting Started", "Activities", "https://example.com")
        }
      >
        Track Activities
      </button>
    </div>
  );
}

function renderProvider(
  overrides?: Partial<typeof mockUserContext>,
  uiOverrides?: Partial<typeof mockUIConfig>,
) {
  const userCtx = { ...mockUserContext, ...overrides };
  const uiCtx = { ...mockUIConfig, ...uiOverrides };

  return render(
    <UserContext.Provider value={userCtx}>
      <UIConfigurationContext.Provider value={uiCtx}>
        <AnalyticsProvider>
          <TrackButton />
        </AnalyticsProvider>
      </UIConfigurationContext.Provider>
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
  server.resetHandlers();
  document.cookie =
    "cmapi_cookie_privacy=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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

    expect(mockTrack).toHaveBeenCalledWith("OpenShift launched", {
      category: "Developer Sandbox|Catalog",
      regions: "sandbox-catalog",
      text: "OpenShift",
      href: "https://console.example.com",
      linkType: "cta",
      internalCampaign: "701Pe00000dnCEYIA2",
    });

    await user.click(screen.getByTestId("track-activities"));

    expect(mockTrack).toHaveBeenCalledWith("Getting Started clicked", {
      category: "Developer Sandbox|Activities",
      regions: "sandbox-activities",
      text: "Getting Started",
      href: "https://example.com",
      linkType: "default",
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
        if (name === "rh_omni_tc") return "RHCTN1234";
        if (name === "rh_omni_itc") return "RHCTE5678";
        return "";
      },
    );

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
    );

    renderProvider(undefined, { marketoWebhookURL: undefined });

    await waitFor(() => {
      expect(AnalyticsBrowser.load).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-catalog"));

    await new Promise((r) => setTimeout(r, 50));

    expect(marketoCalls).toHaveLength(0);

    fetchSpy.mockRestore();
  });

  it("does not fire Marketo for non-Catalog sections", async () => {
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

    await new Promise((r) => setTimeout(r, 50));

    expect(marketoCalls).toHaveLength(0);

    fetchSpy.mockRestore();
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
