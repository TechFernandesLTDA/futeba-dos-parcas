// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockOnIdTokenChanged = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (...args: any[]) => mockOnIdTokenChanged(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {}, auth: {}, storage: {}, functions: {}, app: {}, appCheck: null,
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useVerifiedClaim } from './useVerifiedClaim';

function makeUser(uid: string, getIdTokenResult: () => Promise<any>) {
  return { uid, getIdTokenResult } as any;
}

describe('useVerifiedClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnIdTokenChanged.mockReturnValue(mockUnsubscribe);
  });

  it('retorna null quando não há usuário (null)', () => {
    const { result } = renderHook(() => useVerifiedClaim(null));
    expect(result.current).toBeNull();
  });

  it('retorna null quando o usuário é undefined', () => {
    const { result } = renderHook(() => useVerifiedClaim(undefined));
    expect(result.current).toBeNull();
  });

  it('não chama getIdTokenResult quando não há usuário', () => {
    const getIdTokenResult = vi.fn();
    renderHook(() => useVerifiedClaim(null));
    expect(getIdTokenResult).not.toHaveBeenCalled();
  });

  it('retorna true quando o custom claim verified é true', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: { verified: true } }));
    const { result } = renderHook(() => useVerifiedClaim(user));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('retorna false quando o claim está ausente (undefined)', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: {} }));
    const { result } = renderHook(() => useVerifiedClaim(user));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('trata claim truthy não-booleano como false (verified !== true)', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: { verified: 'yes' } }));
    const { result } = renderHook(() => useVerifiedClaim(user));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('retorna null enquanto o token está pendente', () => {
    const user = makeUser('u1', () => new Promise(() => {}));
    const { result } = renderHook(() => useVerifiedClaim(user));
    expect(result.current).toBeNull();
  });

  it('fail-closed: erro ao resolver o token trata como não-verificado (false)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = makeUser('u1', vi.fn().mockRejectedValue(new Error('network error')));
    const { result } = renderHook(() => useVerifiedClaim(user));
    await waitFor(() => expect(result.current).toBe(false));
    errorSpy.mockRestore();
  });

  it('ignora a resolução de um uid antigo depois do usuário trocar (stale guard)', async () => {
    let resolveUser1!: (v: unknown) => void;
    const user1 = makeUser('u1', () => new Promise((resolve) => { resolveUser1 = resolve; }));
    const user2 = makeUser('u2', vi.fn().mockResolvedValue({ claims: { verified: true } }));

    const { result, rerender } = renderHook(({ user }: { user: any }) => useVerifiedClaim(user), {
      initialProps: { user: user1 as any },
    });

    rerender({ user: user2 as any });
    await waitFor(() => expect(result.current).toBe(true));

    // O token antigo do u1 resolve depois — não deve sobrescrever o estado do u2.
    await act(async () => {
      resolveUser1({ claims: { verified: false } });
    });
    expect(result.current).toBe(true);
  });

  it('retorna null quando o claim resolvido é de outro uid (troca de usuário pendente)', async () => {
    const user1 = makeUser('u1', vi.fn().mockResolvedValue({ claims: { verified: true } }));
    const user2 = makeUser('u2', () => new Promise(() => {}));

    const { result, rerender } = renderHook(({ user }: { user: any }) => useVerifiedClaim(user), {
      initialProps: { user: user1 as any },
    });

    await waitFor(() => expect(result.current).toBe(true));
    rerender({ user: user2 as any });
    // u2 ainda pendente: claim conhecido é do u1, não do u2 → null.
    expect(result.current).toBeNull();
  });

  it('re-checa quando onIdTokenChanged emite um novo usuário', async () => {
    const user1 = makeUser('u1', vi.fn().mockResolvedValue({ claims: { verified: false } }));
    const user2 = makeUser('u2', vi.fn().mockResolvedValue({ claims: { verified: true } }));

    renderHook(() => useVerifiedClaim(user1));
    await waitFor(() => expect(user1.getIdTokenResult).toHaveBeenCalled());

    expect(mockOnIdTokenChanged).toHaveBeenCalledWith(expect.anything(), expect.any(Function));
    const callback = mockOnIdTokenChanged.mock.calls[0][1];
    await act(async () => {
      callback(user2);
    });
    expect(user2.getIdTokenResult).toHaveBeenCalled();
  });

  it('onIdTokenChanged com usuário null reinicia o estado (verified null)', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: { verified: true } }));
    const { result } = renderHook(({ user }: { user: any }) => useVerifiedClaim(user), {
      initialProps: { user: user as any },
    });
    await waitFor(() => expect(result.current).toBe(true));

    const callback = mockOnIdTokenChanged.mock.calls[0][1];
    await act(async () => {
      callback(null);
    });
    expect(result.current).toBeNull();
  });

  it('desinscreve o listener onIdTokenChanged no unmount', () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: { verified: true } }));
    const { unmount } = renderHook(() => useVerifiedClaim(user));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('resolução tardia após unmount não atualiza estado (sem crash)', async () => {
    let resolveUser1!: (v: unknown) => void;
    const user1 = makeUser('u1', () => new Promise((resolve) => { resolveUser1 = resolve; }));
    const { unmount } = renderHook(() => useVerifiedClaim(user1));
    unmount();
    expect(() => resolveUser1({ claims: { verified: true } })).not.toThrow();
    await act(async () => {});
  });
});