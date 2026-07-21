import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawStatus } from "../../../utils/openclaw-utils";

export function makeOpenClawContext(
  overrides: Partial<OpenClawContextType> = {},
): OpenClawContextType {
  return {
    openClawDeletionErrorDetails: null,
    resetOpenClawDeletionErrorDetails: vi.fn(),
    openClawProvisioningErrorDetails: null,
    resetOpenClawProvisioningErrorDetails: vi.fn(),
    openclawStatus: OpenClawStatus.NEW,
    openclawUILink: undefined,
    handleOpenClawInstance: vi.fn().mockResolvedValue(undefined),
    deleteOpenClaw: vi.fn().mockResolvedValue(undefined),
    provisioningError: undefined,
    startProvisioning: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
