import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  clearPendingAccountMerge,
  readPendingAccountMerge,
  savePendingAccountMerge,
} from './accountMergeSession';

describe('accountMergeSession', () => {
  afterEach(() => {
    clearPendingAccountMerge();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('preserva somente pedido opaco válido durante o onboarding', () => {
    const value = {requestId: 'a'.repeat(64), status: 'pending_cpf' as const};
    savePendingAccountMerge(value);
    expect(readPendingAccountMerge()).toEqual(value);
  });

  it('rejeita requestId que exponha identificadores ou formato inesperado', () => {
    sessionStorage.setItem('futeba.accountMerge', JSON.stringify({
      requestId: 'source-uid_target-uid',
      status: 'ready',
    }));
    expect(readPendingAccountMerge()).toBeNull();
  });

  it('remove o pedido após conclusão idempotente', () => {
    savePendingAccountMerge({requestId: 'b'.repeat(64), status: 'ready'});
    clearPendingAccountMerge();
    expect(readPendingAccountMerge()).toBeNull();
  });

  it('mantém o pedido em memória quando o Safari bloqueia sessionStorage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const value = {requestId: 'c'.repeat(64), status: 'ready' as const};

    savePendingAccountMerge(value);

    expect(readPendingAccountMerge()).toEqual(value);
  });
});
