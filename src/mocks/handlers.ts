import type { RequestHandler } from "msw";

import { aapMockHandlers } from "./handlers/aap-handlers";
import { kubeProxyMockHandlers } from "./handlers/kube-proxy-handlers";
import { openClawMockHandlers } from "./handlers/openclaw-handlers";
import { registrationMockHandlers } from "./handlers/registration-handlers";

export const handlers: RequestHandler[] = [
  // Registration-service endpoints.
  ...registrationMockHandlers,

  // Kube proxy endpoints.
  ...kubeProxyMockHandlers,

  // Stateful AAP handlers with lifecycle transitions.
  ...aapMockHandlers,

  // Stateful OpenClaw handlers with lifecycle transitions.
  ...openClawMockHandlers,
];
