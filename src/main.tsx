import "@patternfly/react-core/dist/styles/base.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Environment, getConfig } from "./config/config";

async function bootstrap() {
  if (
    getConfig().environment === Environment.DEVELOPMENT ||
    getConfig().environment === Environment.DEVELOPMENT_KEYCLOAK
  ) {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap().catch((err) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh;">
      <div>
        <h1 style="color: #c9190b;">Configuration Error</h1>
        <p>${err instanceof Error ? err.message : String(err)}</p>
        <p style="color: #6a6e73; font-size: 0.875rem;">
          Check your <code>public/config.js</code> file.
        </p>
      </div>
    </div>
    `;
  }
  console.error("Failed to start application:", err);
});
