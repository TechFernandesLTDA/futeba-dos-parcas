import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  syncFieldOwnerClaim: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../services/cloudFunctions', () => ({
  syncFieldOwnerClaim: mocks.syncFieldOwnerClaim,
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ warn: mocks.warn }),
}));

import { syncFieldOwnerClaimBestEffort } from './syncFieldOwnerClaimBestEffort';

describe('syncFieldOwnerClaimBestEffort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sincroniza a claim de proprietário quando o backend está disponível', async () => {
    mocks.syncFieldOwnerClaim.mockResolvedValue({ data: { synced: true } });

    await syncFieldOwnerClaimBestEffort();

    expect(mocks.syncFieldOwnerClaim).toHaveBeenCalledOnce();
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it('registra a falha sem rejeitar nem bloquear o fluxo do formulário', async () => {
    const error = new Error('functions/unavailable');
    mocks.syncFieldOwnerClaim.mockRejectedValue(error);

    await expect(syncFieldOwnerClaimBestEffort()).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalledWith(
      'Não foi possível sincronizar o perfil de proprietário após erro de permissão:',
      error,
    );
  });
});
