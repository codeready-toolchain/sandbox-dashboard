import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawStatus } from "../../../utils/openclaw-utils";

export function makeOpenClawContext(
  overrides: Partial<OpenClawContextType> = {},
): OpenClawContextType {
  return {
    clearDeletionError: vi.fn(),
    clearProvisioningError: vi.fn(),
    deleteInstance: vi.fn().mockResolvedValue(undefined),
    deletionError: undefined,
    status: OpenClawStatus.NEW,
    uiURL: undefined,
    provisioningError: undefined,
    startProvisioning: vi.fn().mockResolvedValue(undefined),
    unidleInstance: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
