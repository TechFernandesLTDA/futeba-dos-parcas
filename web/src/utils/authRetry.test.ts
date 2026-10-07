import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseError } from 'firebase/app';

import {
  markClaimRefresh,
  resetClaimRefreshState,
  withClaimRefreshRetry,
} from './authRetry';

// 07/10/2026 12:00 UTC — instante fixo para controlar a janela de 30s de claims.
const BASE_TIME = Date.UTC(2026, 9, 7, 12, 0, 0);

function makePermissionDenied(): FirebaseError {
  return new FirebaseError('permission-denied', 'Missing or insufficient permissions');
}

describe('authRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    resetClaimRefreshState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withClaimRefreshRetry', () => {
    it('retorna o resultado direto quando a operação succeeds, sem chamar refreshClaims', async () => {
      const fn = vi.fn().mockResolvedValue({ ok: true });
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).resolves.toEqual({ ok: true });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(refreshClaims).not.toHaveBeenCalled();
    });

    it('faz refresh + retry único quando permission-denied ocorre após refresh recente', async () => {
      markClaimRefresh(); // dentro da janela de 30s
      const fn = vi.fn().mockRejectedValueOnce(makePermissionDenied()).mockResolvedValueOnce('dados');
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).resolves.toBe('dados');
      expect(refreshClaims).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('propaga o erro do retry quando a segunda tentativa também falha', async () => {
      markClaimRefresh();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(makePermissionDenied())
        .mockRejectedValueOnce(new Error('falha no retry'));
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).rejects.toThrow('falha no retry');
      expect(refreshClaims).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('não faz retry quando permission-denied ocorre sem refresh recente', async () => {
      const err = makePermissionDenied();
      const fn = vi.fn().mockRejectedValue(err);
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).rejects.toBe(err);
      expect(refreshClaims).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('deixa de fazer retry quando o refresh de claims está fora da janela de 30s', async () => {
      markClaimRefresh();
      vi.setSystemTime(BASE_TIME + 31_000);
      const err = makePermissionDenied();
      const fn = vi.fn().mockRejectedValue(err);
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).rejects.toBe(err);
      expect(refreshClaims).not.toHaveBeenCalled();
    });

    it('ainda faz retry na borda interna da janela (29s)', async () => {
      markClaimRefresh();
      vi.setSystemTime(BASE_TIME + 29_000);
      const fn = vi.fn().mockRejectedValueOnce(makePermissionDenied()).mockResolvedValueOnce('ok');
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).resolves.toBe('ok');
      expect(refreshClaims).toHaveBeenCalledTimes(1);
    });

    it('não faz retry para outros códigos de FirebaseError, mesmo com refresh recente', async () => {
      markClaimRefresh();
      const err = new FirebaseError('unavailable', 'Serviço indisponível');
      const fn = vi.fn().mockRejectedValue(err);
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).rejects.toBe(err);
      expect(refreshClaims).not.toHaveBeenCalled();
    });

    it('não faz retry para erros que não são FirebaseError', async () => {
      markClaimRefresh();
      const err = new Error('erro comum');
      const fn = vi.fn().mockRejectedValue(err);
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).rejects.toBe(err);
      expect(refreshClaims).not.toHaveBeenCalled();
    });

    it('resetClaimRefreshState encerra a janela mesmo logo após markClaimRefresh (#4001)', async () => {
      markClaimRefresh();
      resetClaimRefreshState();
      const err = makePermissionDenied();
      const fn = vi.fn().mockRejectedValue(err);
      const refreshClaims = vi.fn().mockResolvedValue(undefined);

      await expect(withClaimRefreshRetry(fn, refreshClaims)).rejects.toBe(err);
      expect(refreshClaims).not.toHaveBeenCalled();
    });

    it('refreshClaims rejeitado propaga a falha do refresh (sem retry)', async () => {
      markClaimRefresh();
      const fn = vi.fn().mockRejectedValueOnce(makePermissionDenied());
      const refreshClaims = vi.fn().mockRejectedValue(new Error('refresh falhou'));

      await expect(withClaimRefreshRetry(fn, refreshClaims)).rejects.toThrow('refresh falhou');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
