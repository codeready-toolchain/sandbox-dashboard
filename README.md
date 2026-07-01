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
There are four environments available for the UI to be configured with:

- `dev` — runs the UI with a mocked registration service and SSO.
- `dev-keycloak` — runs the UI with a mocked registration service, but using
  a local Keycloak instance as SSO.
- `dev-stage` — runs the UI which sends the requests to the given registration
  service URL, and proxies the required SSO requests to be able to talk to the
  staging SSO.
- `prod` — runs the UI in production mode.

Find below some more details about the "most complex" development modes for
this UI.

### `dev-keycloak` — Running the UI locally with Keycloak

In order to run the user interface with the Keycloak integration, do the
following:

1. Modify your `config.js` file and set the environment to `dev-keycloak`.
2. Unless you change anything from the given `start-keycloak` instance, you can
   use the default `auth` settings from the `config.js.example` file. Otherwise,
   modify the `auth` object's fields accordingly.
3. Start Keycloak with `make start-keycloak`.
4. Start the UI with `make dev`.
5. Go to `http://localhost:5173` and log in with the default test user:
   - Username: `johndoe`
   - Password: `developer-sandbox`

### `dev-stage` — Running the UI locally by pointing it to stage

This development mode allows you to develop the user interface by having it
make the requests in the staging environment. In order to do that, follow
these steps:

1. Modify your `config.js` file and set the environment to `dev-stage`, the
   `registrationServiceURL` to the stage's registration service URL, and the
   `auth.clientId` to the stage's client ID for development.
2. Start the UI with `make dev`.
3. Go to `http://localhost:5173` and log in with your Red Hat credentials.

Here the authentication provider will query the registration service for the
SSO configuration details, and configure your UI's settings so that they point
to the stage's SSO instance. There is only one request that gets proxied
through your Vite instance, which is the `/token` call. Without that proxied
request the UI is not able to fetch an SSO token due to CORS restrictions.

## Design

See [docs/proposals/standalone-dashboard-design.md](docs/proposals/standalone-dashboard-design.md).
