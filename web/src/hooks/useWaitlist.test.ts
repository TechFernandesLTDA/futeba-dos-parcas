/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// Mocks antes dos imports do módulo testado
const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const { mockJoinGameWaitlist } = vi.hoisted(() => ({ mockJoinGameWaitlist: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  collection: (...a: any[]) => mockCollection(...a),
  query: (...a: any[]) => mockQuery(...a),
  orderBy: (...a: any[]) => mockOrderBy(...a),
  limit: (...a: any[]) => mockLimit(...a),
  onSnapshot: (...a: any[]) => mockOnSnapshot(...a),
  doc: (...a: any[]) => mockDoc(...a),
  deleteDoc: (...a: any[]) => mockDeleteDoc(...a),
}));

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../services/cloudFunctions', () => ({ joinGameWaitlist: mockJoinGameWaitlist }));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }),
}));

const mockUseAuth = vi.fn(() => ({
  currentUser: { uid: 'u1', displayName: 'Player One', photoURL: null },
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useWaitlist } from './useWaitlist';

function emitSnapshot(docs: Array<Record<string, unknown>>) {
  // Último callback registrado em onSnapshot é o success handler
  const call = mockOnSnapshot.mock.calls[mockOnSnapshot.mock.calls.length - 1];
  const onNext = call[1];
  onNext({
    docs: docs.map((d) => ({ id: d.id, data: () => d, ref: { id: d.id } })),
  });
}

describe('useWaitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockQuery.mockReturnValue('q');
    mockCollection.mockReturnValue('c');
    mockOrderBy.mockReturnValue('o');
    mockLimit.mockReturnValue('l');
    mockDoc.mockReturnValue('entry-ref');
    mockJoinGameWaitlist.mockResolvedValue({ data: {
      success: true, alreadyActive: false, entryId: 'u1', queuePosition: 1,
    } });
  });

  it('gameId nulo: não cria listener, não fica loading', () => {
    const { result } = renderHook(() => useWaitlist(null), { wrapper: createTestWrapper() });
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('escuta games/{id}/waitlist e filtra status não-ativos', async () => {
    const { result } = renderHook(() => useWaitlist('g1'), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'games', 'g1', 'waitlist');
    act(() => {
      emitSnapshot([
        { id: 'a', user_id: 'u1', status: 'WAITING', queue_position: 1, user_name: 'P1' },
        { id: 'b', user_id: 'u2', status: 'NOTIFIED', queue_position: 2, user_name: 'P2' },
        { id: 'c', user_id: 'u3', status: 'CANCELLED', queue_position: 3, user_name: 'P3' },
        { id: 'd', user_id: 'u4', status: 'PROMOTED', queue_position: 4, user_name: 'P4' },
      ]);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // CANCELLED e PROMOTED filtrados; sobram 2 ativos
    expect(result.current.waitlist).toHaveLength(2);
    expect(result.current.myEntry?.userId).toBe('u1');
    expect(result.current.myEntry?.queuePosition).toBe(1);
  });

  it('joinWaitlist bloqueia duplicata ativa (idempotência)', async () => {
    mockJoinGameWaitlist.mockResolvedValueOnce({ data: { alreadyActive: true } });
    const { result } = renderHook(() => useWaitlist('g1'), { wrapper: createTestWrapper() });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.joinWaitlist();
    });
    expect(ok).toBe(false);
    expect(mockJoinGameWaitlist).toHaveBeenCalledWith({ gameId: 'g1', position: 'LINE' });
    expect(mockShowError).toHaveBeenCalled();
  });

  it('joinWaitlist usa a callable e não grava campos autoritativos no cliente', async () => {
    const { result } = renderHook(() => useWaitlist('g1'), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.joinWaitlist('GOALKEEPER');
    });
    expect(mockJoinGameWaitlist).toHaveBeenCalledWith({ gameId: 'g1', position: 'GOALKEEPER' });
    expect(mockShowSuccess).toHaveBeenCalled();
  });

  it('leaveWaitlist remove as entradas do próprio usuário', async () => {
    const { result } = renderHook(() => useWaitlist('g1'), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.leaveWaitlist();
    });
    expect(mockDoc).toHaveBeenCalledWith({}, 'games', 'g1', 'waitlist', 'u1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('entry-ref');
    expect(mockShowSuccess).toHaveBeenCalled();
  });
});
