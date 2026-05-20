# Standalone Dashboard — Sketch Questions

**Status:** All questions resolved
**Related:** [Sketch document](standalone-dashboard-sketch.md)

Each question has options with trade-offs and a recommendation. Go through them one by one to form the sketch, then update the sketch document.

---

## Q1: UI component library

The existing dashboard uses MUI (Material UI) v5 for all components — cards, buttons, grids, dialogs, typography, theming. Since this is a Red Hat product, PatternFly is the natural choice for the new standalone app. But we need to decide exactly how to use it.

### Option A: PatternFly React (`@patternfly/react-core`)

Use PatternFly's React component library directly. All layout, cards, buttons, modals, alerts, etc. come from PatternFly React.

- **Pro:** First-class Red Hat design system support, accessibility baked in, consistent with other Red Hat products
- **Pro:** The `tmp/patternfly-react` reference is already available for API lookup
- **Pro:** No need for a separate CSS framework — PatternFly provides both components and styling
- **Con:** Some MUI components have no 1:1 PatternFly equivalent (e.g., MUI's `Skeleton` for loading states) — these need custom implementations or alternatives
- **Con:** PatternFly's card/grid system works differently from MUI's — layout code needs rethinking, not just find-and-replace

**Decision:** Option A — PatternFly React. The delta effort vs keeping MUI is only ~2-3 days (concentrated in 4 modal files with forms), while 80% of the porting work (removing Backstage, auth, config, build setup) is identical regardless of component library. PatternFly is the Red Hat standard and the right long-term choice.

_Considered and rejected: Option B — PatternFly CSS only (much more work, loses built-in accessibility), Option C — Keep MUI (doesn't align with Red Hat product strategy, two design systems in play)_

---

## Q2: OIDC authentication library

The existing dashboard uses Backstage's `OAuth2` class wrapping Keycloak OIDC. The standalone app needs to handle OIDC directly. The registration-service already exposes `/api/v1/authconfig` which provides the SSO base URL, realm, and client configuration.

### Option A: `keycloak-js`

The official Keycloak JavaScript adapter. Purpose-built for Keycloak/RHSSO.

- **Pro:** Purpose-built for Keycloak — handles all Keycloak-specific flows (login, logout, token refresh, iframe session checks)
- **Pro:** Minimal configuration needed — just needs the Keycloak URL, realm, and client ID
- **Pro:** Well-documented with Keycloak's own documentation
- **Con:** Tightly coupled to Keycloak — if the SSO provider ever changes, this adapter won't work
- **Con:** Can be opinionated about how initialization works (e.g., uses iframes for silent check-sso)

**Decision:** Option A — `keycloak-js`. The SSO provider is Keycloak/RHSSO and is unlikely to change. Simplest integration path with minimal config. A thin custom `useAuth()` hook wrapping `keycloak-js` provides the React integration we need.

_Considered and rejected: Option B — `oidc-client-ts` (more config needed, no Keycloak-specific benefits), Option C — `react-oidc-context` (extra dependency layer for a simple auth flow)_

---

## Q3: Runtime configuration strategy

The existing dashboard reads configuration from Backstage's `app-config.yaml` (via `ConfigApi`). Config values include: registration API URL (`sandbox.signupAPI`), Kube API proxy URL (`sandbox.kubeAPI`), recaptcha site key, and environment (dev/prod). The standalone app needs a replacement strategy.

The dashboard is deployed on a **different domain** than the registration-service (same OpenShift cluster, different routes). This means the SPA cannot assume same-origin — it needs the registration-service URL before it can call any API endpoint. This is a chicken-and-egg problem for a pure "fetch everything from server" approach.

CORS is not a concern: the registration-service already has `AllowAllOrigins: true` on the main Gin server and a custom CORS preflight handler on the proxy.

### Option A (hybrid): `config.js` everywhere + registration-service endpoints

A single `config.js` file provides the bootstrap URL in **both dev and production** — same mechanism, same code path, no branching.

`index.html` loads it via `<script src="/config.js"></script>`. The app always reads `window.__config__`:

```javascript
// config.js — dev: public/config.js, prod: ConfigMap
window.__config__ = {
  registrationServiceURL: "https://registration-service.apps.cluster.example.com",
  recaptchaSiteKey: "6Lc...",
  environment: "prod",
  disabledIntegrations: []
};
```

- **Development:** developer creates `public/config.js` (gitignored, with a `public/config.js.example` checked in)
- **Production:** `config.js` is mounted into the nginx container via OpenShift ConfigMap, overriding the one from the image

The Kube API proxy URL is already returned in `userData.proxyURL` from the signup GET response — no static config needed. SSO config comes from `/api/v1/authconfig` at runtime (already exists).

- **Pro:** Same container image across all environments — only the ConfigMap changes
- **Pro:** One config mechanism everywhere — zero conditional logic in app code
- **Pro:** No registration-service changes needed for the initial port
- **Pro:** Standard OpenShift pattern for SPAs
- **Con:** Developer creates `public/config.js` instead of `.env.local` (slightly less conventional for Vite, but simpler overall)
- **Con:** Config values (recaptcha key, environment, disabled integrations) are managed per-deployment in ConfigMaps rather than centralized in the reg-service — acceptable for now, can be migrated to `/api/v1/uiconfig` later as a clean follow-up

**Decision:** Option A — `config.js` everywhere (ConfigMap in prod, `public/config.js` in dev) for bootstrap config, remaining dynamic config from existing reg-service endpoints. No reg-service changes needed. Same build artifact across all environments.

_Considered and rejected: Option B — serve-time HTML templating (requires reg-service to template HTML, breaks caching), Option C — build-time env vars (different artifact per environment, doesn't scale)_

---

## Q4: Client-side routing approach

The existing dashboard has two pages (Catalog and Activities) routed by Backstage's framework. The standalone app needs its own routing.

### Option A: React Router

Standard client-side routing library for React.

- **Pro:** Industry standard, well-documented, large ecosystem
- **Pro:** Supports nested routes, lazy loading, route guards
- **Pro:** The existing codebase already has `react-router` as a peer dependency
- **Con:** Another dependency to maintain
- **Con:** Might be overkill for just two pages

**Decision:** Option A — React Router. Industry standard, URL-based navigation matters for UX (bookmarks, back/forward), and the app may grow beyond two pages.

_Considered and rejected: Option B — TanStack Router (overkill, different API), Option C — no router (no bookmarkable URLs, no browser history)_

---

## Q5: Build tooling

The existing dashboard is built with Backstage CLI (which wraps webpack). The standalone app needs its own build pipeline.

### Option A: Vite

Modern build tool, fast dev server with HMR, Rollup-based production builds.

- **Pro:** Very fast development experience (instant HMR)
- **Pro:** Modern defaults — ESM-first, tree-shaking, code splitting
- **Pro:** First-class TypeScript support
- **Pro:** Simple configuration, works well out of the box for React+TypeScript
- **Con:** Some edge cases with legacy dependencies that expect CommonJS

**Decision:** Option A — Vite. Current standard for new React projects, best developer experience, minimal configuration. No exotic requirements that would need webpack's flexibility.

_Considered and rejected: Option B — webpack (slower, more complex config), Option C — Rspack (newer ecosystem, unnecessary for a small project)_

---

## Q6: Testing strategy

The existing dashboard has unit tests using `@backstage/test-utils`, `@testing-library/react`, and `jest` (via Backstage CLI). The standalone app needs its own testing setup.

### Option A: Vitest + React Testing Library

Vitest is Vite's native test runner. Combined with React Testing Library for component testing.

- **Pro:** Native Vite integration — shares the same config, transforms, and module resolution
- **Pro:** Jest-compatible API — existing tests can be migrated with minimal changes
- **Pro:** Fast — runs in parallel, uses Vite's transform pipeline
- **Pro:** React Testing Library is already used in the existing tests
- **Con:** Some Jest plugins may not have Vitest equivalents (though most do)

**Decision:** Option A — Vitest + React Testing Library. Native Vite integration, Jest-compatible API for easy test migration, config lives in `vite.config.ts`.

_Considered and rejected: Option B — Jest (separate config from Vite, slower, ESM issues), Option C — Playwright component testing (overkill for unit tests)_

---

## Q7: How to handle the Kubernetes API proxy calls

The existing dashboard makes direct Kubernetes API calls (for AAP CRDs, secrets, deployments, PVCs) through the registration-service's proxy. The proxy URL comes from `userData.proxyURL`. All calls use the user's SSO token as the Bearer token.

### Option A: Keep the same pattern — direct K8s API calls via proxy

Continue making K8s API calls from the browser through the registration-service proxy, exactly as the existing dashboard does.

- **Pro:** No backend changes needed
- **Pro:** Proven pattern — it works today
- **Pro:** The proxy already handles auth, routing, and CORS
- **Con:** Exposes Kubernetes API surface to the browser (even through a proxy)
- **Con:** Complex client-side code for managing K8s resources (delete cascades, label selectors)

**Decision:** Option A — keep the same pattern. No backend changes, proven approach. The AAP K8s operations are well-defined and bounded. Dedicated reg-service endpoints (Option B) would be better long-term but are out of scope for this port.

_Considered and rejected: Option B — dedicated reg-service endpoints (requires backend changes, out of scope)_
