import "@patternfly/react-core/dist/styles/base.css";
import "./global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import initializeKeycloak from "./auth/initializeKeycloak";
import { Environment, getConfig } from "./config/config";
import { AuthenticatedContext } from "./auth/AuthenticatedContext";

async function bootstrap() {
  const configuration = getConfig();

  // Start the mocked back end if we are in development mode.
  if (
    configuration.environment === Environment.DEVELOPMENT ||
    configuration.environment === Environment.DEVELOPMENT_KEYCLOAK
  ) {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
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
