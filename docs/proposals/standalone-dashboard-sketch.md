# Standalone Dashboard — Technical Sketch

**Status:** Sketch complete — ready for detailed design

## Problem

The Developer Sandbox dashboard is currently implemented as a plugin for Red Hat Developer Hub (RHDH), which is a Backstage-based platform. This creates a heavy dependency: RHDH must be deployed, configured, and maintained just to serve what is ultimately a simple single-page application. The dashboard's actual backend is the registration-service — RHDH provides no backend logic, only the plugin framework, auth plumbing, and shell UI.

## Goal

Port the dashboard to a standalone web application that:

- Has **no dependency on Backstage/RHDH** — no `@backstage/*` packages, no Backstage plugin system
- Uses the **registration-service as its sole backend** (for signup, verification, config, analytics, and Kubernetes API proxying)
- Preserves all existing user-facing features and flows
- Uses **PatternFly React** as the UI component library (replacing MUI)
- Is deployable as static assets served by an nginx container, with configuration via OpenShift ConfigMap

## What the existing dashboard does

### Pages

1. **Catalog Page** (`SandboxCatalogPage`) — the main page. Shows a welcome banner with trial status/days remaining, a grid of product cards (OpenShift, OpenShift AI, Dev Spaces, AAP, OpenShift Virtualization), and a footer with activation code entry and Red Hat legal links.

2. **Activities Page** (`SandboxActivitiesPage`) — a grid of learning resource cards (articles, tutorials) linking to developers.redhat.com.

### Core user flows

1. **Authentication** — OIDC login via Red Hat SSO (Keycloak). Currently handled by Backstage's OAuth2 provider system (`RHSSOSignInPage`). The sign-in page is invisible — it auto-redirects to SSO.

2. **Signup** — On first "Try it" click, the dashboard POST's to `/api/v1/signup`. It then polls GET `/api/v1/signup` until the user status progresses through: `new` → `verify` → `pending-approval` → `provisioning` → `ready`.

3. **Phone verification** — When status is `verify`, a modal collects country code + phone number (PUT `/api/v1/signup/verification`), then a 6-digit OTP (GET `/api/v1/signup/verification/:code`).

4. **Activation code** — Alternative verification via an activation code (POST `/api/v1/signup/verification/activation-code`).

5. **Product launch** — Once `ready`, "Try it" buttons link to the user's provisioned environments (OpenShift console, Dev Spaces, OpenShift AI, OpenShift Virtualization).

6. **AAP lifecycle** — Ansible Automation Platform has a special flow: provision (POST CR), poll status, show credentials modal, un-idle (PATCH), delete (DELETE CR + cleanup PVCs/secrets).

7. **Workspace reset** — POST `/api/v1/reset-namespaces` to reset the user's workspaces.

### Backend integration points

All API calls go through the registration-service:

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/v1/authconfig` | GET | No | SSO/OIDC configuration for the frontend |
| `/api/v1/signup` | GET | Yes | Get current user's signup data and status |
| `/api/v1/signup` | POST | Yes | Initiate signup (+ recaptcha token header) |
| `/api/v1/signup/verification` | PUT | Yes | Initiate phone verification |
| `/api/v1/signup/verification/:code` | GET | Yes | Complete phone verification |
| `/api/v1/signup/verification/activation-code` | POST | Yes | Verify activation code |
| `/api/v1/analytics/segment-write-key` | GET | No | Get Segment analytics key |
| `/api/v1/uiconfig` | GET | Yes | Get UI configuration (webhook URL) |
| `/api/v1/reset-namespaces` | POST | Yes | Reset user workspaces |

The registration-service also acts as a **Kubernetes API proxy** — the dashboard makes direct K8s API calls (for AAP CRDs, secrets, deployments, PVCs, StatefulSets) through the proxy URL provided in `userData.proxyURL`.

### Backstage dependencies being removed

The existing code depends on Backstage for:

1. **Plugin system** — `createPlugin`, `createRoutableExtension`, `createApiRef`, `createApiFactory`
2. **Auth** — `OAuth2`, `OAuthApi`, `oauthRequestApiRef` for Keycloak OIDC
3. **Configuration** — `ConfigApi` / `configApiRef` for reading `app-config.yaml`
4. **UI shell** — `Page`, `Content`, `Header`, `Link`, `SignInPage` from `@backstage/core-components`
5. **API injection** — `useApi()` hook for dependency injection

## Architecture of the standalone app

### High-level structure

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

The SPA is served as static files by an **nginx container** on OpenShift. The registration-service is on a **different domain** (same cluster, different route). CORS is already enabled on the reg-service (`AllowAllOrigins: true`).

### Authentication

Using `keycloak-js` — the official Keycloak JavaScript adapter, wrapped in a thin `useAuth()` hook for React integration.

1. Load `config.js` to get the registration-service URL
2. Fetch `/api/v1/authconfig` to get the SSO configuration (base URL, realm, client ID)
3. Initialize `keycloak-js` and redirect to SSO for login
4. Handle the callback, store the access token
5. Attach `Authorization: Bearer <token>` to all authenticated API calls
6. Handle token refresh via `keycloak-js` built-in mechanism

### Configuration

Two layers, one code path:

**Static config (`config.js`)** — loaded synchronously via `<script>` tag in `index.html`:

```javascript
window.__config__ = {
  registrationServiceURL: "https://registration-service.apps.cluster.example.com",
  recaptchaSiteKey: "6Lc...",
  environment: "prod",
  disabledIntegrations: []
};
```

- **Development:** developer creates `public/config.js` (gitignored, `public/config.js.example` checked in)
- **Production:** `config.js` mounted into the nginx container via OpenShift ConfigMap

Same mechanism everywhere — no conditional logic in app code.

**Dynamic config (registration-service endpoints):**

- `/api/v1/authconfig` — SSO base URL, realm, client ID (already exists, unsecured)
- `/api/v1/uiconfig` — Marketo webhook URL (already exists, auth-protected)
- `/api/v1/analytics/segment-write-key` — Segment write key (already exists, unsecured)
- `userData.proxyURL` — Kube API proxy URL (from signup GET response)

No registration-service changes needed for the initial port.

### Routing

**React Router** for client-side routing:

- `/` — Catalog page (main/home)
- `/activities` — Activities page

Nginx configured to serve `index.html` for all routes (SPA fallback).

### State management

The existing React Context pattern (`SandboxProvider` / `useSandboxContext`) carries forward unchanged. It manages: user signup data, loading/polling state, AAP state, analytics, and config.

### Analytics & tracking

Three tracking systems (all independent of Backstage, ported as-is):

1. **Segment Analytics** — initialized with a write key from `/api/v1/analytics/segment-write-key`, tracks user identity and click events
2. **Adobe Analytics (EDDL/dpal.js)** — loaded via external script, uses `data-analytics-*` attributes
3. **Marketo** — webhook calls for catalog clicks, using a URL from `/api/v1/uiconfig`

### Kubernetes API proxy calls

AAP operations (create, get status, delete, un-idle) continue to use direct K8s API calls through the registration-service proxy at `userData.proxyURL`, exactly as today. The proxy handles auth, routing, and CORS.

### Third-party integrations

- **Google reCAPTCHA Enterprise** — loaded via script tag, site key from `config.js`
- **TrustArc** — cookie consent, loaded via script tag
- **Red Hat footer elements** — `@rhds/elements` for the universal footer

## Technology stack

| Concern | Choice |
|---|---|
| UI components | PatternFly React (`@patternfly/react-core`) |
| Authentication | `keycloak-js` + custom `useAuth()` hook |
| Configuration | `config.js` (ConfigMap) + reg-service endpoints |
| Routing | React Router |
| Build tooling | Vite |
| Testing | Vitest + React Testing Library |
| K8s API calls | Direct via reg-service proxy (as today) |

## What is out of scope

- **Backend changes** — the registration-service is not being modified
- **New features** — this is a port, not a redesign
- **Visual redesign** — the look should be equivalent or improved with PatternFly, but no new UX flows
- **Server-side rendering** — this is a client-side SPA

## Source directory structure (proposed)

```
src/
├── api/             # API clients (registration, kube, AAP)
├── auth/            # OIDC authentication (keycloak-js wrapper)
├── config/          # Configuration loading (config.js + reg-service)
├── components/      # React components
│   ├── Catalog/     # Product catalog page
│   ├── Activities/  # Activities/learning page
│   ├── Modals/      # Phone verification, AAP modals, activation code
│   └── Layout/      # Header, footer, page shell
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
├── utils/           # Utilities (analytics, phone, recaptcha, etc.)
├── assets/          # SVG logos, images
├── App.tsx          # Root component (router, auth provider, context)
└── main.tsx         # Entry point
public/
├── config.js.example  # Template for config.js
└── config.js          # (gitignored) local dev config
```
