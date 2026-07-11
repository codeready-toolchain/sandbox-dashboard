import type { OpenClawContextType } from "../../../hooks/OpenClawContext";
import { OpenClawStatus } from "../../../utils/openclaw-utils";

export function makeOpenClawContext(
  overrides: Partial<OpenClawContextType> = {},
): OpenClawContextType {
  return {
    openclawData: undefined,
    openClawDeletionErrorDetails: null,
    resetOpenClawDeletionErrorDetails: vi.fn(),
    openClawProvisioningErrorDetails: null,
    resetOpenClawProvisioningErrorDetails: vi.fn(),
    openclawStatus: OpenClawStatus.NEW,
    openclawUILink: undefined,
    handleOpenClawInstance: vi.fn().mockResolvedValue(true),
    deleteOpenClaw: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
