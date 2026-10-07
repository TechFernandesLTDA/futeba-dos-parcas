// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockT = (key: string) => key;

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    ms: number;
    constructor(ms: number) { this.ms = ms; }
    toDate(): Date { return new Date(this.ms); }
    toMillis(): number { return this.ms; }
    static fromDate(d: Date): MockTimestamp { return new MockTimestamp(d.getTime()); }
    static fromMillis(ms: number): MockTimestamp { return new MockTimestamp(ms); }
    static now(): MockTimestamp { return new MockTimestamp(Date.now()); }
  }
  return {
    collection: (...args: any[]) => mockCollection(...args),
    doc: vi.fn((...args: any[]) => ({ path: args.filter((s) => typeof s === 'string').join('/') })),
    query: (...args: any[]) => mockQuery(...args),
    where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
    orderBy: vi.fn((field: string, direction: string) => ({ type: 'orderBy', field, direction })),
    limit: vi.fn((value: number) => ({ type: 'limit', value })),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
  loading: false, error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

import { useDuplicateGame } from './useDuplicateGame';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function gameDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

const FULL_GAME = {
  owner_id: 'test-user-id',
  location_id: 'loc-1',
  location_name: 'Arena Parças',
  field_id: 'field-1',
  field_name: 'Campo 1',
  date: '2026-10-10',
  time: '20:00',
  end_time: '22:00',
  field_type: 'SOCIETY',
  max_players: 16,
  max_goalkeepers: 2,
  number_of_teams: 2,
  daily_price: 12,
  total_cost: 180,
  price_manual_override: true,
  visibility: 'GROUP',
  group_id: 'g-1',
  group_name: 'Parças',
  rules: 'sem carrinho',
  recurrence: 'weekly',
};

describe('useDuplicateGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockQuery.mockImplementation((base: unknown, ...constraints: unknown[]) => ({ base, constraints }));
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockAuthReturn = {
      user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
      firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
    };
  });

  it('carrega jogos do dono com where owner_id, status != CANCELLED e limit 10', async () => {
    mockGetDocs.mockResolvedValue({ docs: [gameDoc('game-1', FULL_GAME)] });
    const { result } = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(result.current.recentGames).toHaveLength(1));

    const q = mockGetDocs.mock.calls[0][0] as { base: { path: string }; constraints: any[] };
    expect(q.base.path).toBe('games');
    const wheres = q.constraints.filter((c) => c?.type === 'where');
    expect(wheres).toEqual([
      { type: 'where', field: 'owner_id', op: '==', value: 'test-user-id' },
      { type: 'where', field: 'status', op: '!=', value: 'CANCELLED' },
    ]);
    expect(q.constraints.some((c) => c?.type === 'orderBy' && c.field === 'date' && c.direction === 'desc')).toBe(true);
    expect(q.constraints.some((c) => c?.type === 'limit' && c.value === 10)).toBe(true);
  });

  it('mapeia snake_case → camelCase preservando id e campos informados', async () => {
    mockGetDocs.mockResolvedValue({ docs: [gameDoc('game-1', FULL_GAME)] });
    const { result } = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(result.current.recentGames).toHaveLength(1));

    expect(result.current.recentGames[0]).toEqual({
      id: 'game-1',
      locationId: 'loc-1',
      locationName: 'Arena Parças',
      fieldId: 'field-1',
      fieldName: 'Campo 1',
      date: '2026-10-10',
      time: '20:00',
      endTime: '22:00',
      fieldType: 'SOCIETY',
      maxPlayers: 16,
      maxGoalkeepers: 2,
      numberOfTeams: 2,
      dailyPrice: 12,
      totalCost: 180,
      priceManualOverride: true,
      visibility: 'GROUP',
      groupId: 'g-1',
      groupName: 'Parças',
      rules: 'sem carrinho',
      recurrence: 'weekly',
    });
  });

  it('aplica defaults para campos ausentes', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [gameDoc('game-min', { owner_id: 'test-user-id', location_name: 'Só o essencial' })],
    });
    const { result } = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(result.current.recentGames).toHaveLength(1));

    expect(result.current.recentGames[0]).toEqual({
      id: 'game-min',
      locationId: '',
      locationName: 'Só o essencial',
      fieldId: undefined,
      fieldName: undefined,
      date: '',
      time: '',
      endTime: undefined,
      fieldType: 'SOCIETY',
      maxPlayers: 14,
      maxGoalkeepers: 2,
      numberOfTeams: 2,
      dailyPrice: 0,
      totalCost: 0,
      priceManualOverride: undefined,
      visibility: 'PUBLIC_CLOSED',
      groupId: undefined,
      groupName: undefined,
      rules: '',
      recurrence: 'none',
    });
  });

  it('sem usuário autenticado: não consulta e mantém loading=false', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useDuplicateGame());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.recentGames).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('usa firebaseUser.uid quando presente e user.id como fallback', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    // firebaseUser.uid vence
    const first = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(1));
    let q = mockGetDocs.mock.calls[0][0] as { constraints: any[] };
    expect(q.constraints).toContainEqual({ type: 'where', field: 'owner_id', op: '==', value: 'test-user-id' });
    first.unmount();

    // só user.id
    mockAuthReturn = { user: { id: 'fallback-id' }, firebaseUser: null, loading: false, error: null };
    const second = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(2));
    q = mockGetDocs.mock.calls[1][0] as { constraints: any[] };
    expect(q.constraints).toContainEqual({ type: 'where', field: 'owner_id', op: '==', value: 'fallback-id' });
    second.unmount();
  });

  it('expõe erro amigável quando a consulta falha e desliga loading', async () => {
    mockGetDocs.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(result.current.error).toBe('feedback.duplicateGame.loadRecentError'));
    expect(result.current.loading).toBe(false);
    expect(result.current.recentGames).toEqual([]);
  });

  it('refetch recarrega os jogos', async () => {
    const { result } = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('recarrega quando o uid muda', async () => {
    const { result, rerender } = renderHook(() => useDuplicateGame());
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(1));

    mockAuthReturn = {
      user: { id: 'user-2', name: 'User 2', photoUrl: null, level: 3 },
      firebaseUser: { uid: 'user-2', displayName: 'User 2', photoURL: null },
      loading: false, error: null,
    };
    rerender();

    await waitFor(() => expect(mockGetDocs).toHaveBeenCalledTimes(2));
    const q = mockGetDocs.mock.calls[1][0] as { constraints: any[] };
    expect(q.constraints).toContainEqual({ type: 'where', field: 'owner_id', op: '==', value: 'user-2' });
    void result;
  });

  it('resolução após unmount não grava estado (cancelamento #2278)', async () => {
    let resolveGetDocs!: (v: unknown) => void;
    mockGetDocs.mockReturnValue(new Promise((resolve) => { resolveGetDocs = resolve; }));
    const { unmount } = renderHook(() => useDuplicateGame());
    unmount();
    await act(async () => {
      expect(() => resolveGetDocs({ docs: [gameDoc('game-late', FULL_GAME)] })).not.toThrow();
    });
  });
});
