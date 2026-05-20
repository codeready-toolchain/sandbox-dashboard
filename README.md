# Developer Sandbox Dashboard

Standalone React SPA for the [Red Hat Developer Sandbox](https://developers.redhat.com/developer-sandbox). Replaces the previous Backstage/RHDH-based dashboard with a self-contained application that communicates directly with the [registration-service](https://github.com/codeready-toolchain/registration-service).

## Tech Stack

- **React** + **TypeScript** — built with **Vite**
- **PatternFly React** — UI component library
- **keycloak-js** — OIDC authentication
- **MSW** — mock registration-service for local dev and tests

## Development

```sh
make dev       # start dev server with MSW mocks
make lint      # run linter
make test      # run unit tests
make build     # production build
make image     # build container image with Podman
```

Copy `public/config.js.example` to `public/config.js` for local configuration.

## Design

See [docs/proposals/standalone-dashboard-design.md](docs/proposals/standalone-dashboard-design.md).
