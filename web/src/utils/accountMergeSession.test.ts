import {afterEach, describe, expect, it} from 'vitest';
import {
  clearPendingAccountMerge,
  readPendingAccountMerge,
  savePendingAccountMerge,
} from './accountMergeSession';

describe('accountMergeSession', () => {
  afterEach(() => sessionStorage.clear());

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
});

