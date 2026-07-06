import type { RequestHandler } from "msw";
import { registrationMockHandlers } from "./handlers/registration-handlers";
import { kubeProxyMockHandlers } from "./handlers/kube-proxy-handlers";
import { aapMockHandlers } from "./handlers/aap-handlers";
import { openClawMockHandlers } from "./handlers/openclaw-handlers";

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
