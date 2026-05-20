# Standalone Dashboard — Design Document

**Status:** Final
**Questions:** [standalone-dashboard-design-questions.md](standalone-dashboard-design-questions.md) (all resolved)

## Overview

The Developer Sandbox dashboard is being ported from a Backstage/RHDH plugin to a standalone React SPA. The existing dashboard runs inside Red Hat Developer Hub — a Backstage-based platform that provides the plugin framework, auth plumbing, and UI shell. This creates a heavy operational dependency: RHDH must be deployed and maintained just to serve what is ultimately a simple single-page application whose actual backend is the registration-service.

The standalone dashboard eliminates this dependency. It is a self-contained React application that uses PatternFly React for UI components, `keycloak-js` for OIDC authentication, and communicates directly with the registration-service. It is deployed as static assets in an nginx container on OpenShift, configured via ConfigMap.

This is a port, not a redesign. All existing user-facing features, flows, and backend integration points are preserved.

## Design Principles

1. **No Backstage dependencies** — zero `@backstage/*` packages. The app owns its auth, config, routing, and API clients.
2. **Registration-service is the sole backend** — no backend changes for the initial port. All APIs, the Kube proxy, and config endpoints remain as-is.
3. **Same build artifact across environments** — the container image is identical for dev, staging, and production. Only the ConfigMap-mounted `config.js` changes.
4. **PatternFly React as the design system** — consistent with other Red Hat products, accessible by default.
5. **Minimal dependency surface** — prefer the platform (`fetch`, `keycloak-js`, React Router) over abstraction libraries.

## Architecture

### High-Level Structure

```
┌──────────────────────────────────────┐
│         Browser (SPA)                │
│                                      │
│  React + PatternFly React            │
│  OIDC auth via keycloak-js           │
│  Direct fetch() to reg-service APIs  │
│                                      │
└────────────┬─────────────────────────┘
             │ HTTPS (cross-origin, CORS enabled)
             ▼
┌──────────────────────────────────────┐
│     Registration Service             │
│                                      │
│  /api/v1/* — signup, verification,   │
│              config, analytics       │
│  Proxy — Kubernetes API access       │
│                                      │
└──────────────────────────────────────┘
```

The SPA is served as static files by an **nginx container** on OpenShift. The registration-service is on a **different domain** (same cluster, different route). CORS is already enabled on the registration-service: `AllowAllOrigins: true` on the main Gin server, and a custom CORS preflight handler on the proxy.

### Application Bootstrap Sequence

```
1. Browser loads index.html
2. index.html loads config.js (synchronous <script> tag)
     → window.__config__ now has registrationServiceURL, recaptchaSiteKey, etc.
3. App fetches GET /api/v1/authconfig from registration-service
     → gets SSO base URL, realm, client ID
4. App initializes keycloak-js with those values
     → redirects to SSO for login (or silent check-sso)
5. After auth callback, app has an access token
6. App fetches GET /api/v1/signup (with Bearer token)
     → user data, status, proxyURL, namespace, etc.
7. App renders the appropriate UI based on user status
8. Background: fetch Segment write key, UI config, AAP status (if applicable)
```

### Authentication

An `<AuthProvider>` component wraps the entire app. It initializes `keycloak-js`, manages the Keycloak instance in a ref, and exposes auth state + `getToken()` via React context. Components and API functions access auth through a `useAuth()` hook.

```tsx
<AuthProvider>
  <App /> {/* only renders after keycloak init completes */}
</AuthProvider>
```

The provider shows a loading/splash screen while Keycloak initializes, and handles auth errors (expired session, failed refresh) centrally. In dev mode (with MSW mocking), the provider accepts a bypass mode that provides a fake token.

**Auth flow:**

1. Read SSO config from `/api/v1/authconfig` (base URL, realm, client ID)
2. Initialize `keycloak-js` with `onLoad: 'login-required'` (auto-redirect)
3. On successful auth, the Keycloak instance holds the access token
4. All authenticated API calls attach `Authorization: Bearer <token>`
5. Token refresh is handled automatically by `keycloak-js`

**Token usage for Kube proxy:** The same SSO token is used for both registration-service API calls and Kubernetes API proxy calls. The proxy validates the token server-side and routes requests to the appropriate member cluster.

### Configuration

Two layers:

**Static config (`config.js`)** — loaded synchronously via `<script>` tag in `index.html`:

```javascript
window.__config__ = {
  registrationServiceURL:
    "https://registration-service.apps.cluster.example.com",
  recaptchaSiteKey: "6Lc...",
  environment: "prod",
};
```

- **Development:** developer creates `public/config.js` (gitignored, `public/config.js.example` checked in as template)
- **Production:** `config.js` mounted into the nginx container via OpenShift ConfigMap

Note: `disabledIntegrations` is **not** in `config.js` — it comes exclusively from `/api/v1/uiconfig` (server-side, post-auth), matching the existing behavior.

**Dynamic config (registration-service endpoints):**

| Endpoint                              | Auth | Returns                                                                            |
| ------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `/api/v1/authconfig`                  | No   | SSO base URL, realm, client ID                                                     |
| `/api/v1/uiconfig`                    | Yes  | Workato webhook URL (`workatoWebHookURL`, used for Marketo), disabled integrations |
| `/api/v1/analytics/segment-write-key` | No   | Segment write key                                                                  |
| `userData.proxyURL`                   | —    | Kube API proxy URL (from signup response)                                          |

### API Client Architecture

The Backstage dependency injection system (`createApiRef`, `createApiFactory`, `useApi`) is replaced with **plain module functions** and a shared `authFetch` helper.

Each API operation is an exported async function in a module file (e.g., `api/registration.ts`, `api/kube.ts`, `api/aap.ts`). The `authFetch` helper attaches the Bearer token from a module-level ref set by the `AuthProvider`, replacing the entire `SecureFetchClient` class.

```typescript
// api/registration.ts
export async function getSignupData(): Promise<SignupData | undefined> {
  const response = await authFetch(`${getBaseURL()}/signup`);
  // ...
}
```

Registration API functions include: `getSignupData`, `signup`, `initiatePhoneVerification`, `completePhoneVerification`, `verifyActivationCode`, `getSegmentWriteKey`, `getUIConfig`, and `resetWorkspaces`.

This is the simplest possible pattern — no classes, no DI, no providers. With MSW handling mocks at the network level, there is no testability advantage to classes or dependency injection.

### Development Environment

[MSW (Mock Service Worker)](https://mswjs.io/) intercepts `fetch` calls in the browser via a service worker. Handlers for each reg-service endpoint return canned fixture responses, toggled via a `config.js` flag (e.g., `useMockAPI: true`).

- Same MSW handlers are reused in Vitest unit tests — one mock layer for everything
- Different fixture sets simulate different user states (new, verify, pending, ready)
- The `AuthProvider` has a dev bypass mode providing a fake token
- No separate process needed — runs inside the browser

This eliminates the need for a live registration-service or Keycloak instance for day-to-day frontend development.

### Routing

React Router with two routes:

| Path          | Component        | Description                                |
| ------------- | ---------------- | ------------------------------------------ |
| `/`           | `CatalogPage`    | Product catalog with cards, banner, footer |
| `/activities` | `ActivitiesPage` | Learning resources grid                    |

Nginx configured with `try_files $uri $uri/ /index.html` for SPA fallback.

**Workspace reset** lives in a **header user menu** — a PatternFly `Masthead`/`Toolbar` dropdown showing the user's name, with "Reset Workspaces" and "Log Out" actions. Accessible from every page. "Reset Workspaces" opens a confirmation dialog with a 3-state button (initial → "I understand and I want to reset" → submitting) before calling `POST /api/v1/reset-namespaces`.

### State Management

The existing `SandboxProvider` / `useSandboxContext` pattern carries forward. It manages:

- User signup data and status (`SignupData`, polling)
- AAP instance state (creation, status, credentials, deletion)
- Analytics references (Segment write key, Marketo webhook URL)
- UI config (disabled integrations)

The context is initialized after authentication completes. It polls for user status changes (signup flow) and AAP status (provisioning flow) at configurable intervals.

**Polling strategy (unchanged):**

- `LONG_INTERVAL` (20s) — default poll for signup status
- `SHORT_INTERVAL` (2s) — poll during provisioning, AAP status

### Pages and Components

#### Catalog Page

The main page. Composed of:

1. **Banner** — welcome message with user name, trial days remaining, info popover about trial expiration
2. **Product Grid** — cards for OpenShift, OpenShift AI, Dev Spaces, AAP, OpenShift Virtualization
3. **Footer** — activation code entry link, Red Hat universal footer (`@rhds/elements`)

Each product card contains:

- Product icon and title
- Feature description bullets
- "Try it" button (triggers signup → verification → launch flow)
- Delete button (AAP only, when instance exists)
- "Tried" green corner indicator (persisted in a cookie via `getCookie`/`setCookie` utilities)

#### Activities Page

A grid of learning resource cards linking to developers.redhat.com articles and tutorials.

#### Modals

| Modal                        | Trigger                          | Purpose                                     |
| ---------------------------- | -------------------------------- | ------------------------------------------- |
| `PhoneVerificationModal`     | "Try it" when status is `verify` | Two-step: phone number → OTP code           |
| `AnsibleLaunchInfoModal`     | "Try it" on AAP when ready       | Shows AAP credentials (user, password, URL) |
| `AnsibleDeleteInstanceModal` | Delete button on AAP card        | Confirmation before AAP deletion            |
| `AccessCodeInputModal`       | "Click here" in footer           | Activation code entry                       |

### Product Launch Flow

The "Try it" button orchestrates a multi-step flow depending on user state:

```
User clicks "Try it"
  ├─ Not signed up → POST /signup → poll until status known
  │   ├─ Status: verify → open PhoneVerificationModal
  │   ├─ Status: ready → open product URL in new tab
  │   └─ Status: other → continue polling
  ├─ Signed up, needs verification → open PhoneVerificationModal
  ├─ Signed up, ready, product=AAP → create/un-idle AAP → show credentials
  └─ Signed up, ready, product≠AAP → open product URL in new tab
```

Product URLs are derived from `userData` fields:

- **OpenShift** — `consoleURL + /k8s/cluster/projects/{namespace}`
- **OpenShift AI** — `rhodsMemberURL`
- **Dev Spaces** — `cheDashboardURL` (fallback: construct from `consoleURL`)
- **AAP** — provisioned dynamically, URL from AAP CR status
- **OpenShift Virtualization** — `consoleURL + /k8s/ns/{namespace}/virtualization-overview`

### AAP Lifecycle

AAP has a special lifecycle managed entirely through Kubernetes API proxy calls:

1. **Create** — POST AAP CR to `/apis/aap.ansible.com/v1alpha1/namespaces/{ns}/ansibleautomationplatforms`
2. **Poll status** — GET the same endpoint, check conditions (`Successful`, `Running`, `Failure`)
3. **Un-idle** — PATCH the CR to set `spec.idle_aap: false`
4. **Delete** — fetch Deployments and StatefulSets (to capture volume references), DELETE the AAP CR, then clean up associated secrets, PVCs, and StatefulSet volume-claim PVCs

The AAP CR spec is a large static YAML/JSON object with resource requirements tailored for the sandbox environment.

### Analytics and Tracking

Three independent tracking systems, all ported as-is:

1. **Segment Analytics** — `@segment/analytics-next`. Initialized with write key from `/api/v1/analytics/segment-write-key`. Identifies users, groups by account, tracks click events.
2. **Adobe Analytics (EDDL)** — loaded via external `dpal.js` script. Uses `data-analytics-*` HTML attributes on interactive elements. No code changes needed.
3. **Marketo** — webhook POST to Workato URL (`workatoWebHookURL` from `/api/v1/uiconfig`). Sends user info + campaign IDs on catalog clicks.

### Third-Party Script Loading

All third-party scripts are loaded **dynamically from React** — no static `<script>` tags in `index.html` beyond `config.js` and the Vite app entry. This carries forward the existing pattern. The `environment` value in `config.js` (`"prod"` vs `"dev"`) controls whether these scripts are loaded — when set to `"dev"`, they are all skipped:

| Integration                 | Injection                                       | Config                    | Skip in dev? |
| --------------------------- | ----------------------------------------------- | ------------------------- | ------------ |
| Google reCAPTCHA Enterprise | `loadRecaptchaScript()` via `useRecaptcha` hook | Site key from `config.js` | Yes          |
| TrustArc (cookie consent)   | `document.createElement('script')` in layout    | Self-contained            | Yes          |
| Adobe Analytics (dpal.js)   | `document.createElement('script')` in layout    | Self-contained            | Yes          |
| Red Hat footer elements     | `@rhds/elements` npm package                    | Self-contained            | No           |

### Error Handling

Three layers:

1. **Top-level `<ErrorBoundary>`** — catches unhandled rendering crashes, shows a PatternFly `EmptyState` fallback
2. **Contextual inline errors** — API failures in modals (phone verification, AAP), form validation. Handled with local state and PatternFly `Alert` components. Carries forward the existing pattern.
3. **Global toast notifications** — PatternFly `AlertGroup` with `isToast` for cross-cutting errors that don't belong to any specific component: auth token expiry, network failures. A small notification context provides an `addAlert` function.

## Source Directory Structure

```
src/
├── api/             # Plain function API clients (registration, kube, AAP)
├── auth/            # AuthProvider, useAuth hook, keycloak-js wrapper
├── config/          # Configuration loading (config.js + reg-service)
├── components/      # React components
│   ├── Catalog/     # Product catalog page
│   ├── Activities/  # Activities/learning page
│   ├── Modals/      # Phone verification, AAP modals, activation code
│   └── Layout/      # Masthead (with user menu), footer, page shell
├── hooks/           # Custom React hooks
├── mocks/           # MSW handlers and fixtures for dev/test
├── notifications/   # AlertGroup toast notification context
├── types/           # TypeScript type definitions
├── utils/           # Utilities (analytics, phone, recaptcha, etc.)
├── assets/          # SVG logos, images
├── App.tsx          # Root component (router, auth provider, context)
└── main.tsx         # Entry point
public/
├── config.js.example  # Template for config.js
└── config.js          # (gitignored) local dev config
```

## Technology Stack

| Concern         | Choice                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| UI components   | PatternFly React (`@patternfly/react-core`)                                 |
| Authentication  | `keycloak-js` + `<AuthProvider>` / `useAuth()`                              |
| API clients     | Plain module functions + `authFetch` helper                                 |
| Dev mocking     | MSW (Mock Service Worker)                                                   |
| Configuration   | `config.js` (ConfigMap) + reg-service endpoints                             |
| Routing         | React Router                                                                |
| Build tooling   | Vite                                                                        |
| Testing         | Vitest + React Testing Library + MSW                                        |
| Task runner     | Makefile (`make dev`, `make test`, `make lint`, `make build`, `make image`) |
| Container build | Podman (multi-stage Containerfile, UBI nginx)                               |
| CI              | GitHub Actions (lint, test, image build+push) — calls Makefile targets      |
| E2e testing     | OpenShift CI (Prow) against live cluster                                    |
| K8s API calls   | Direct via reg-service proxy (as today)                                     |

## Deployment

### Container Image

Multi-stage Containerfile built with Podman:

```dockerfile
FROM node:20 AS build
# install deps, run vite build

FROM registry.access.redhat.com/ubi9/nginx-124
COPY --from=build /app/dist .
COPY nginx.conf /etc/nginx/nginx.conf
```

- **Base:** UBI nginx (OpenShift-compatible, runs as non-root)
- **Content:** static build output (`dist/`) copied into nginx's serve directory
- **Config:** `config.js` mounted via ConfigMap at nginx's serve path, overriding the placeholder
- **Nginx config:** custom `nginx.conf` for SPA routing (`try_files`), security headers, gzip

### CI/CD

**GitHub Actions** for everything that can run without a cluster:

- **`ci.yml`** — runs on PRs and pushes to main: lint, type check, Vitest unit tests
- **`build-and-push.yml`** — runs on merge to main: `redhat-actions/buildah-build` + `redhat-actions/podman-login` + `redhat-actions/push-to-registry` to quay.io

**OpenShift CI (Prow)** for e2e tests only — tests that need a live cluster with the registration-service, Keycloak, and the full toolchain stack.

Follows the pattern established in [tarsy](https://github.com/codeready-toolchain/tarsy).

## Implementation Plan

Each phase is one PR. Tests for ported code ship with that phase.

### Phase 1: Project Scaffolding - DONE

- Initialize Vite + React + TypeScript project
- Configure PatternFly CSS imports and theming
- Set up `config.js` loading mechanism
- Port type definitions (`types/`)
- Set up Vitest + MSW infrastructure (service worker setup, no endpoint handlers yet)
- Create Containerfile and nginx config
- Create Makefile (dev server, lint, test, container build/run — single entry point for all project operations)
- Set up GitHub Actions: `ci.yml` (lint, type check, test) and `build-and-push.yml` (image build+push to quay.io)

### Phase 2: Auth and API Clients

- Implement `<AuthProvider>` with `keycloak-js` (including dev bypass mode)
- Implement `authFetch` helper (Bearer token attachment)
- Port registration API functions (signup, verification, config endpoints)
- Port Kube API functions and AAP API functions (proxy calls)
- Add MSW handlers for all endpoints + fixture sets
- Port API client unit tests

### Phase 3: App Shell and Catalog Page

- Port `SandboxProvider` / `useSandboxContext` (includes `useRecaptcha` script loading)
- Set up React Router (`/`, `/activities`)
- Build PatternFly `Masthead` with user menu (log out action)
- Add error boundary and toast notification layer
- Port Catalog page: banner, product grid (display-only cards), footer (with `@rhds/elements`)
- Port product data and product URL mapping
- Port Activities page (article grid)

### Phase 4: Interactive Flows and Modals

- Port the "Try it" button flow (full state machine)
- Port `PhoneVerificationModal` (phone number step + OTP step)
- Port `AnsibleLaunchInfoModal` (credentials display)
- Port `AnsibleDeleteInstanceModal` (confirmation dialog)
- Port `AccessCodeInputModal` (activation code entry)
- Port workspace reset confirmation dialog (upgrade user menu)

### Phase 5: Analytics and Third-Party Integrations

- Port Segment Analytics integration
- Port Adobe EDDL tracking (`data-analytics-*` attributes)
- Port Marketo webhook tracking
- Port TrustArc cookie consent dynamic loading

## What Is Out of Scope

- **Backend changes** — the registration-service is not being modified
- **New features** — this is a port, not a redesign
- **Visual redesign** — the look should be equivalent or improved with PatternFly, not reimagined
- **Server-side rendering** — this is a client-side SPA
- **Dark mode** — PatternFly supports it, but the existing dashboard's dark mode support is minimal; not a priority for the port
