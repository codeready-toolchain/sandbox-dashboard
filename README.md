# Developer Sandbox Dashboard

Standalone React SPA for the [Red Hat Developer Sandbox](https://developers.redhat.com/developer-sandbox). Replaces the previous Backstage/RHDH-based dashboard with a self-contained application that communicates directly with the [registration-service](https://github.com/codeready-toolchain/registration-service).

## Tech Stack

- **React** + **TypeScript** — built with **Vite**
- **PatternFly React** — UI component library
- **keycloak-js** — OIDC authentication
- **MSW** — mock registration-service for local dev and tests

## Development

```sh
make dev            # start dev server with MSW mocks
make start-keycloak # start a local Keycloak instance
make lint           # run linter
make test           # run unit tests
make build          # production build
make image          # build container image with Podman
```

Copy `public/config.js.example` to `public/config.js` for local configuration.

### Running the UI locally with Keycloak

In order to run the user interface with the Keycloak integration, do the
following:

1. Modify your `config.js` file and set the environment to `dev-keycloak`.
2. Start Keycloak with `make start-keycloak`.
3. Start the UI with `make dev`.

## Design

See [docs/proposals/standalone-dashboard-design.md](docs/proposals/standalone-dashboard-design.md).
