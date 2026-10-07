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

let mockAuthReturn: any = {
  firebaseUser: null,
  user: null,
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { useProfileComplete } from './useProfileComplete';

function makeUser(uid: string, getIdTokenResult: (forceRefresh?: boolean) => Promise<any>) {
  return { uid, getIdTokenResult } as any;
}

describe('useProfileComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnIdTokenChanged.mockReturnValue(mockUnsubscribe);
    mockAuthReturn = { firebaseUser: null, user: null, loading: false, error: null };
  });

  it('retorna profileComplete null e loading true sem usuário', () => {
    const { result } = renderHook(() => useProfileComplete());
    expect(result.current.profileComplete).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('não chama getIdTokenResult quando não há usuário', () => {
    const getIdTokenResult = vi.fn();
    // mockAuthReturn.firebaseUser permanece null do beforeEach.
    renderHook(() => useProfileComplete());
    expect(getIdTokenResult).not.toHaveBeenCalled();
  });

  it('retorna true quando claims.profileComplete é true', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: { profileComplete: true } }));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { result } = renderHook(() => useProfileComplete());
    await waitFor(() => expect(result.current.profileComplete).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('retorna false quando o claim está ausente (undefined → !claim = false)', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: {} }));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { result } = renderHook(() => useProfileComplete());
    await waitFor(() => expect(result.current.profileComplete).toBe(false));
    expect(result.current.loading).toBe(false);
  });

  it('trata claim truthy não-booleano como true (!!claim)', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: { profileComplete: 1 } }));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { result } = renderHook(() => useProfileComplete());
    await waitFor(() => expect(result.current.profileComplete).toBe(true));
  });

  it('expõe erro e profileComplete null quando getIdTokenResult falha', async () => {
    const user = makeUser('u1', vi.fn().mockRejectedValue(new Error('token expired')));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { result } = renderHook(() => useProfileComplete());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error!.message).toBe('token expired');
    expect(result.current.profileComplete).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('envolve erro não-Error em uma instância de Error', async () => {
    const user = makeUser('u1', vi.fn().mockRejectedValue('falha string'));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { result } = renderHook(() => useProfileComplete());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error!.message).toBe('falha string');
  });

  it('refresh chama getIdTokenResult com forceRefresh=true', async () => {
    const getIdTokenResult = vi.fn().mockResolvedValue({ claims: { profileComplete: true } });
    const user = makeUser('u1', getIdTokenResult);
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { result } = renderHook(() => useProfileComplete());
    await waitFor(() => expect(result.current.profileComplete).toBe(true));

    getIdTokenResult.mockClear();
    await act(async () => {
      await result.current.refresh();
    });
    expect(getIdTokenResult).toHaveBeenCalledWith(true);
  });

  it('re-checa quando onIdTokenChanged emite novo usuário', async () => {
    const user1 = makeUser('u1', vi.fn().mockResolvedValue({ claims: {} }));
    const user2 = makeUser('u2', vi.fn().mockResolvedValue({ claims: { profileComplete: true } }));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user1 };

    renderHook(() => useProfileComplete());
    await waitFor(() => expect(user1.getIdTokenResult).toHaveBeenCalled());

    const callback = mockOnIdTokenChanged.mock.calls[0][1];
    await act(async () => {
      callback(user2);
    });
    expect(user2.getIdTokenResult).toHaveBeenCalled();
  });

  it('onIdTokenChanged com null reset profileComplete para null', async () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: { profileComplete: true } }));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { result, rerender } = renderHook(() => useProfileComplete());
    await waitFor(() => expect(result.current.profileComplete).toBe(true));

    const callback = mockOnIdTokenChanged.mock.calls[0][1];
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: null };
    rerender();
    await act(async () => {
      await callback(null);
    });
    expect(result.current.profileComplete).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('ignora resolução de uid antigo depois da troca de usuário (stale guard)', async () => {
    let resolveUser1!: (v: unknown) => void;
    const user1 = makeUser('u1', () => new Promise((resolve) => { resolveUser1 = resolve; }));
    const user2 = makeUser('u2', vi.fn().mockResolvedValue({ claims: { profileComplete: true } }));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user1 };

    const { result, rerender } = renderHook(() => useProfileComplete());
    rerender(); // garante leitura do mockAuthReturn atual

    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user2 };
    rerender();
    await waitFor(() => expect(result.current.profileComplete).toBe(true));

    await act(async () => {
      resolveUser1({ claims: { profileComplete: false } });
    });
    expect(result.current.profileComplete).toBe(true);
  });

  it('desinscreve onIdTokenChanged no unmount', () => {
    const user = makeUser('u1', vi.fn().mockResolvedValue({ claims: {} }));
    mockAuthReturn = { ...mockAuthReturn, firebaseUser: user };
    const { unmount } = renderHook(() => useProfileComplete());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});