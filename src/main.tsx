import "@patternfly/react-core/dist/styles/base.css";
import "./global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { AuthenticatedContext } from "./auth/AuthenticatedContext";
import initializeKeycloak from "./auth/initializeKeycloak";
import { Environment, getConfig } from "./config/config";

async function bootstrap() {
  const configuration = getConfig();

  // Mock the backend when launching the UI in development mode.
  if (
    configuration.environment === Environment.DEVELOPMENT ||
    configuration.environment === Environment.DEVELOPMENT_KEYCLOAK
  ) {
    // Dynamically import the function here instead of a top-level static
    // import so that we do not include all this code in production.
    const { setUpMockedBackend } = await import("./mocks/browser");
    await setUpMockedBackend();
  }

  // Initialize Keycloak and trigger the SSO flow.
  const authContextValue = await initializeKeycloak(configuration);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthenticatedContext.Provider value={authContextValue}>
        <App />
      </AuthenticatedContext.Provider>
    </StrictMode>,
  );
}

bootstrap().catch((err) => {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <div>
          <h1 style={{ color: "#c9190b" }}>Configuration Error</h1>
          <p>{err instanceof Error ? err.message : String(err)}</p>
          <p style={{ color: "#6a6e73", fontSize: "0.875rem" }}>
            Check your <code>public/config.js</code> file.
          </p>
        </div>
      </div>,
    );
  }
  console.error("Failed to start application:", err);
});
