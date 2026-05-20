# Standalone Dashboard — Design Questions

**Status:** All questions resolved
**Related:** [Design document](standalone-dashboard-design.md)

Each question has options with trade-offs and a recommendation. Go through them one by one to form the design, then update the design document.

---

## Q1: React auth integration pattern

The standalone app replaces Backstage's `OAuth2` + `useApi(keycloakApiRef)` with `keycloak-js` directly. The question is how to expose the Keycloak instance and auth state to React components. The auth layer is a critical seam: every authenticated API call needs the token, components need to know login state, and the entire app should not render until auth is resolved.

### Option A: Auth provider component wrapping the app

A `<AuthProvider>` component at the top of the tree that initializes `keycloak-js`, manages the instance in a ref, and exposes auth state + `getToken()` via React context. Components use `useAuth()` to access it.

```tsx
<AuthProvider>
  <App />   {/* only renders after keycloak init completes */}
</AuthProvider>
```

- **Pro:** Clean separation — auth initialization is a lifecycle concern handled at the boundary
- **Pro:** The provider can show a loading/splash screen while Keycloak initializes
- **Pro:** Easy to test — swap the provider with a mock in tests
- **Pro:** Natural place to handle auth errors (expired session, failed refresh) centrally
- **Con:** One more context provider in the tree (adds to the existing `SandboxProvider`)

**Decision:** Option A — `<AuthProvider>` wrapping the app, exposing `useAuth()` hook. Simple, testable, and upgradeable to a module+provider hybrid later if needed.

_Considered and rejected: Option B — singleton module (harder to test, no reactive React state), Option C — combined singleton+provider (unnecessary complexity for a fully React-rendered app)_

---

## Q2: `disabledIntegrations` config source

The existing dashboard reads `disabledIntegrations` from `/api/v1/uiconfig` (a server endpoint). But the sketch also places it in `config.js` (the static ConfigMap). Having it in both places creates ambiguity about which is authoritative. This question clarifies the source of truth.

### Option A: Server only — read from `/api/v1/uiconfig`

`disabledIntegrations` comes exclusively from the registration-service's `/api/v1/uiconfig` endpoint. The `config.js` file does not include it.

- **Pro:** Single source of truth — operators change it in one place (reg-service config)
- **Pro:** No need to update ConfigMaps across multiple dashboard deployments
- **Pro:** Matches the existing behavior in the Backstage dashboard
- **Con:** Dashboard can't disable integrations before auth completes (uiconfig is auth-protected)

**Decision:** Option A — read exclusively from `/api/v1/uiconfig`. Single source of truth, matches current behavior. The `config.js` file will not include `disabledIntegrations`.

_Considered and rejected: Option B — static only from config.js (diverges from current behavior, requires per-deployment ConfigMap updates), Option C — server with static fallback (two sources of truth, unnecessary complexity)_

---

## Q3: Development environment — mock registration-service

Running the dashboard locally today requires a live registration-service (Go binary on an OpenShift cluster) and a real Keycloak/RHSSO instance. This is heavy for day-to-day frontend development. Most dev work — porting components to PatternFly, iterating on layout, testing flow logic, working on modals — doesn't need a real backend. A mock that implements the same API surface with canned responses would cover 90%+ of dev scenarios.

The question is what kind of mock to use and how it integrates with the dev workflow.

### Option A: MSW (Mock Service Worker)

Use [MSW](https://mswjs.io/) to intercept `fetch` calls in the browser via a service worker. Define handlers for each reg-service endpoint that return canned responses. Toggle between mock and real via a `config.js` flag (e.g., `useMockAPI: true`).

```typescript
// mocks/handlers.ts
http.get('*/api/v1/signup', () => {
  return HttpResponse.json(fixtures.readyUser)
})
```

- **Pro:** No separate process — runs inside the browser, zero setup
- **Pro:** Same handlers work in unit tests (Vitest) and in the dev browser — one mock layer for everything
- **Pro:** The app code doesn't know it's mocked — real `fetch` calls are intercepted at the network level
- **Pro:** Can simulate different user states by switching fixture sets (new, verify, ready, etc.)
- **Pro:** Can simulate errors, slow responses, and edge cases
- **Con:** Requires writing and maintaining mock handlers for every endpoint
- **Con:** Doesn't test real CORS or network behavior
- **Con:** Kube proxy calls (AAP CRDs, secrets) are more complex to mock realistically

**Decision:** Option A — MSW. Zero-process dev setup, same mocks reusable in Vitest tests, app code stays clean. AuthProvider gets a mock/bypass mode for dev that provides a fake token. Fixture sets allow simulating different user states (new, verify, ready, etc.).

_Considered and rejected: Option B — Vite proxy + mock Express server (separate process to manage, more infrastructure), Option C — fixture injection (leaks mock concerns into production code, doesn't exercise API clients)_

---

## Q4: API client instantiation pattern

The existing dashboard uses Backstage's `createApiFactory` + `createApiRef` + `useApi()` for dependency injection of API clients (`RegistrationBackendClient`, `KubeBackendClient`, `AnsibleBackendClient`). The standalone app needs a replacement pattern. The key constraint: all clients need a way to get the current auth token and the registration-service base URL.

Note: Q3 decided on MSW for mocking, which intercepts at the network level. This means the API client pattern no longer needs to optimize for mockability — mocking is handled regardless of how clients are structured. The choice here is purely about code simplicity and ergonomics.

### Option A: Plain module functions

No classes. Each API operation is an exported async function in a module file (e.g., `api/registration.ts`). Functions import `getToken()` from the auth module and read the base URL from config.

```typescript
// api/registration.ts
export async function getSignupData(): Promise<SignupData | undefined> {
  const response = await authFetch(`${getBaseURL()}/signup`);
  // ...
}
```

- **Pro:** Simplest possible pattern — no classes, no DI, no providers
- **Pro:** Tree-shakeable — unused functions can be eliminated
- **Pro:** Easy to understand — each function is self-contained
- ~~**Con:** Harder to mock in tests~~ — moot since Q3 chose MSW (mocking at network level)
- **Con:** Relies on module-level auth singleton (see Q1 interaction)

**Decision:** Option A — plain module functions with a shared `authFetch` helper. The existing classes are thin `fetch` wrappers; plain functions are simpler and equally testable with MSW (Q3). `authFetch` reads the token from a module-level ref set by the `AuthProvider` (Q1), replacing the entire `SecureFetchClient` class.

_Considered and rejected: Option B — class instances via React context (over-engineered for 3 thin clients), Option C — class singletons (timing issues, harder to test)_

---

## Q5: Workspace reset navigation placement

The existing dashboard exposes "Reset Workspaces" as a Backstage sidebar menu item (via `SandboxResetWorkspaces` component extension). The standalone app doesn't have a Backstage sidebar. Where should this feature live?

### Option A: Header dropdown / user menu

Add a user menu (dropdown) in the page header — the user's name or avatar that expands to show "Reset Workspaces" and potentially "Log Out".

- **Pro:** Standard UX pattern — user-related actions in a user menu
- **Pro:** Accessible from any page
- **Pro:** Natural home for future user-scoped actions (log out, profile, etc.)
- **Con:** Requires building a header dropdown component

**Decision:** Option A — header user menu (PatternFly `Masthead`/`Toolbar` dropdown). Contains "Reset Workspaces" and "Log Out". Accessible from every page, standard UX pattern.

_Considered and rejected: Option B — inline on catalog page (only visible on one page, clutters main UI), Option C — footer link (destructive action buried in footer, easy to miss)_

---

## Q6: Third-party script management in `index.html`

The dashboard loads several third-party scripts: reCAPTCHA Enterprise, TrustArc cookie consent, and Adobe Analytics (`dpal.js`). On closer inspection, the existing dashboard already loads **all three dynamically from React code** — none are static `<script>` tags in `index.html`:

- **reCAPTCHA** — injected by `loadRecaptchaScript()` via the `useRecaptcha` hook, using the site key from config, skipped in dev
- **TrustArc** — injected in `SandboxHeader` via `document.createElement('script')`, skipped in dev
- **Adobe dpal.js** — same as TrustArc, injected in `SandboxHeader`, skipped in dev

**Decision:** Carry forward the existing dynamic injection pattern. No static `<script>` tags in `index.html` beyond `config.js` and the Vite app entry. All third-party scripts are loaded programmatically from React, config-driven, and conditionally skipped in dev mode. This is already how it works — no change needed.

---

## Q7: Error boundary and global error handling

The existing Backstage dashboard relies on Backstage's built-in error handling (error boundaries, error panels). The standalone app needs its own strategy for handling runtime errors, API failures, and auth failures.

### Option C: Error boundary + contextual errors inline + global toast for cross-cutting errors

Top-level `<ErrorBoundary>` for rendering crashes. Contextual errors (API failures in modals, form validation, AAP errors) stay inline as they are today. A small global notification layer using PatternFly's `AlertGroup` with `isToast` handles cross-cutting errors that don't belong to any specific component — auth token expiry, network failures, etc.

- **Pro:** Right error in the right place — contextual where it matters, global for surprises
- **Pro:** Matches the existing pattern for contextual errors (phone verification, AAP errors)
- **Pro:** PatternFly `AlertGroup` with `isToast` is ready-made — the "infrastructure" is ~20-30 lines (an alerts array + `addAlert` function in a small context)
- **Pro:** Auth expiry genuinely needs a global notification path that the standalone app must handle (Backstage handled it before)
- **Con:** One small context/provider for the notification system

**Decision:** Option C — error boundary for crashes, contextual errors stay inline (existing pattern), PatternFly `AlertGroup` toast for cross-cutting errors (auth expiry, network down). Minimal extra work with PatternFly providing the component.

_Considered and rejected: Option A — minimal/error boundary only (no path for auth expiry notifications), Option B — all errors via toast (fights existing contextual error pattern, phone verification errors belong in the modal)_

---

## Q8: Nginx configuration and container build

The static assets need to be served by nginx in an OpenShift-compatible container. This covers the Dockerfile structure and nginx configuration.

### Option A: Multi-stage Containerfile (build + serve)

```dockerfile
FROM node:20 AS build
# install deps, run vite build
FROM registry.access.redhat.com/ubi9/nginx-124
COPY --from=build /app/dist .
COPY nginx.conf /etc/nginx/nginx.conf
```

Built with `podman build`. The nginx config handles SPA fallback, gzip, caching headers, and security headers.

- **Pro:** Single Containerfile — self-contained, reproducible builds
- **Pro:** Standard pattern for SPA containers on OpenShift
- **Pro:** UBI-based nginx image is OpenShift-compatible (runs as non-root)
- **Con:** Slower CI builds (npm install in container every time, though layer caching helps)

**Decision:** Option A — multi-stage Containerfile with Podman. Self-contained, reproducible. The build is small (Vite builds a simple SPA in seconds), so speed is not a concern.

_Considered and rejected: Option B — separate build (less reproducible, build environment differs from container), Option C — multi-stage with CI cache (unnecessary complexity for a small build)_

---

## Q9: CI pipeline and image build strategy

The project needs CI for linting, testing, and building container images. The existing `devsandbox-dashboard` uses OpenShift CI (Prow).

### GitHub Actions for everything except e2e; OpenShift CI for e2e only

GitHub Actions handles lint, unit tests, type checking, and image build+push to quay.io — everything that can run without a real cluster. OpenShift CI is used only for e2e tests that need a live cluster with the registration-service, Keycloak, and the full toolchain stack.

Two workflows following the [tarsy](https://github.com/codeready-toolchain/tarsy) pattern:

- **`ci.yml`** — runs on PRs and pushes to main: lint, type check, `vitest` unit tests
- **`build-and-push.yml`** — runs on merge to main: `redhat-actions/buildah-build` + `redhat-actions/podman-login` + `redhat-actions/push-to-registry` to quay.io

- **Pro:** Fast PR feedback — lint+test for a small frontend project runs in ~1-2 minutes
- **Pro:** Image build is straightforward (buildah/podman, push to quay.io) — no Prow overhead for a simple SPA container
- **Pro:** Each system does what it's good at: GitHub Actions for self-contained CI, OpenShift CI for cluster-dependent e2e
- **Pro:** Proven pattern already used by the team in tarsy
- **Con:** Two CI systems, but with clearly separated, non-overlapping responsibilities

**Decision:** GitHub Actions for lint, test, and image build+push (following the tarsy pattern). OpenShift CI only for e2e tests against real infrastructure.

_Considered and rejected: Option A — GitHub Actions only (can't run e2e tests against a real cluster), Option B — OpenShift CI only (slower feedback, overkill for lint/test/image build of a small SPA)_
