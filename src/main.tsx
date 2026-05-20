import "@patternfly/react-core/dist/styles/base.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

async function bootstrap() {
  if (window.__config__?.environment === "dev") {
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
