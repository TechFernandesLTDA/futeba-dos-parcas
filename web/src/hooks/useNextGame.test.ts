// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';
// Importado APÓS o vi.mock: resolve para o MockTimestamp definido na factory,
// garantindo que toGame/converta date_time via toDate() e que o snapshot do
// hook receba instâncias compatíveis. (padrão useGameTemplates.test.ts)
import { Timestamp } from 'firebase/firestore';

const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn((base?: unknown, ...constraints: unknown[]) => ({ base, constraints }));

vi.mock('firebase/firestore', () => {
  // MockTimestamp com classe real: toGame converte date_time via toDate().
  class MockTimestamp {
    constructor(ms: number) {
      this.ms = ms;
    }
    ms: number;
    toDate(): Date {
      return new Date(this.ms);
    }
    toMillis(): number {
      return this.ms;
    }
    static fromDate(d: Date): MockTimestamp {
      return new MockTimestamp(d.getTime());
    }
    static fromMillis(ms: number): MockTimestamp {
      return new MockTimestamp(ms);
    }
    static now(): MockTimestamp {
      return new MockTimestamp(Date.now());
    }
  }
  return {
    collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
    query: (...args: any[]) => mockQuery(...args),
    where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
    orderBy: vi.fn((field: string, direction?: string) => ({ type: 'orderBy', field, direction })),
    limit: vi.fn((value: number) => ({ type: 'limit', value })),
    doc: (...args: any[]) => mockDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    Timestamp: MockTimestamp,
    // services/firebase.ts é importado por useNextGame — precisa existir no mock. #2330
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User' },
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { useNextGame } from './useNextGame';

const HOUR = 60 * 60 * 1000;

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function gameDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      status: 'SCHEDULED',
      date_time: Timestamp.fromMillis(Date.now() + HOUR),
      ...overrides,
    }),
  };
}

const EMPTY_SNAPSHOT = { docs: [] as any[] };

function ownGamesSnapshot(docs: unknown[]) {
  return { docs };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  // Promise.all([ownedGamesQuery, confirmationsQuery]) — ordem fixa das chamadas.
  mockGetDocs.mockResolvedValueOnce(ownGamesSnapshot([])).mockResolvedValueOnce(EMPTY_SNAPSHOT);
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  mockAuthReturn = { user: { id: 'test-user-id', name: 'Test User' } };
});

describe('useNextGame', () => {
  it('sem usuário: query desabilitada, nextGame=null e não consulta Firestore', async () => {
    mockAuthReturn = { user: null };
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    expect(result.current.nextGame).toBeNull();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('retorna o próximo jogo do dono (caso feliz)', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(ownGamesSnapshot([gameDoc('g-1')]))
      .mockResolvedValueOnce(EMPTY_SNAPSHOT);
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.nextGame).not.toBeNull());
    expect(result.current.nextGame!.id).toBe('g-1');
  });

  it('consulta games com owner_id/status/dateTime e limit(10)', () => {
    renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    const gamesQuery = mockQuery.mock.calls.map((call: unknown[]) => call[0])
      .find((base: any) => base?.path === 'games');
    expect(gamesQuery).toBeDefined();
    const constraints = mockQuery.mock.calls.find((call: any[]) => call[0]?.path === 'games')!
      .slice(1) as Array<Record<string, unknown>>;
    expect(constraints).toEqual(
      expect.arrayContaining([
        { type: 'where', field: 'owner_id', op: '==', value: 'test-user-id' },
        { type: 'where', field: 'status', op: 'in', value: ['SCHEDULED', 'CONFIRMED', 'LIVE'] },
        { type: 'orderBy', field: 'dateTime', direction: 'asc' },
        { type: 'limit', value: 10 },
      ]),
    );
  });

  it('consulta confirmations com status ativos e limit(50)', () => {
    renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    const constraints = mockQuery.mock.calls.find((call: any[]) => call[0]?.path === 'confirmations')!
      .slice(1) as Array<Record<string, unknown>>;
    expect(constraints).toEqual(
      expect.arrayContaining([
        { type: 'where', field: 'user_id', op: '==', value: 'test-user-id' },
        {
          type: 'where',
          field: 'status',
          op: 'in',
          value: ['CONFIRMED', 'ON_THE_WAY', 'CHECKED_IN'],
        },
        { type: 'limit', value: 50 },
      ]),
    );
  });

  it('mescla jogos do dono e jogos confirmados e retorna o mais próximo', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(ownGamesSnapshot([gameDoc('g-late', { date_time: Timestamp.fromMillis(Date.now() + 5 * HOUR) })]))
      .mockResolvedValueOnce({
        docs: [{ data: () => ({ game_id: 'g-early', status: 'CONFIRMED' }) }],
      });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'g-early',
      data: () => ({ status: 'CONFIRMED', date_time: Timestamp.fromMillis(Date.now() + 1 * HOUR) }),
    });
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.nextGame).not.toBeNull());
    expect(result.current.nextGame!.id).toBe('g-early');
  });

  it('deduplica game_ids repetidos nas confirmações (getDoc uma vez por jogo)', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(ownGamesSnapshot([]))
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ game_id: 'g-1', status: 'CONFIRMED' }) },
          { data: () => ({ game_id: 'g-1', status: 'ON_THE_WAY' }) },
          { data: () => ({ game_id: '', status: 'CHECKED_IN' }) }, // filtrado (vazio)
        ],
      });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'g-1',
      data: () => ({ status: 'CONFIRMED', date_time: Timestamp.fromMillis(Date.now() + HOUR) }),
    });
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.nextGame?.id).toBe('g-1'));
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  it('ignora confirmação cujo jogo não existe mais (getDoc exists=false)', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(ownGamesSnapshot([]))
      .mockResolvedValueOnce({ docs: [{ data: () => ({ game_id: 'g-ghost' }) }] });
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nextGame).toBeNull();
  });

  it('exclui jogos soft-deleted (deleted_at)', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(
        ownGamesSnapshot([gameDoc('g-del', { deleted_at: Timestamp.fromMillis(Date.now()) })]),
      )
      .mockResolvedValueOnce(EMPTY_SNAPSHOT);
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nextGame).toBeNull();
  });

  it('exclui jogos no passado (isUpcomingGame falso)', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(
        ownGamesSnapshot([gameDoc('g-past', { date_time: Timestamp.fromMillis(Date.now() - HOUR) })]),
      )
      .mockResolvedValueOnce(EMPTY_SNAPSHOT);
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nextGame).toBeNull();
  });

  it('exclui jogos com status fora de UPCOMING_GAME_STATUSES', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(ownGamesSnapshot([gameDoc('g-fin', { status: 'FINISHED' })]))
      .mockResolvedValueOnce(EMPTY_SNAPSHOT);
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nextGame).toBeNull();
  });

  it('resolve início via date+time quando não há date_time (fallback getGameStartDate)', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(
        ownGamesSnapshot([gameDoc('g-1', { date_time: undefined, date: '2099-12-25', time: '20:00' })]),
      )
      .mockResolvedValueOnce(EMPTY_SNAPSHOT);
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.nextGame?.id).toBe('g-1'));
  });

  it('converte snake_case para camelCase e date_time Timestamp para Date', async () => {
    mockGetDocs
      .mockReset()
      .mockResolvedValueOnce(ownGamesSnapshot([gameDoc('g-1', { owner_id: 'test-user-id' })]))
      .mockResolvedValueOnce(EMPTY_SNAPSHOT);
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.nextGame?.id).toBe('g-1'));
    expect((result.current.nextGame as any).ownerId).toBe('test-user-id');
    expect((result.current.nextGame as any).dateTime).toBeInstanceOf(Date);
  });

  it('erro no getDocs: nextGame permanece null e isLoading desliga (retry:false)', async () => {
    mockGetDocs.mockReset().mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nextGame).toBeNull();
  });

  it('sem candidatos: retorna null após carregar', async () => {
    const { result } = renderHook(() => useNextGame(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.nextGame).toBeNull();
  });
});
