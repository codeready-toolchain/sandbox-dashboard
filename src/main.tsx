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

bootstrap();
