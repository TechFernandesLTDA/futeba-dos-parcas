// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockGetDoc = vi.fn();
const mockDoc = vi.fn();

// Semana fixa para tornar o queryKey determinístico.
vi.mock('../utils/weeklyRankingWeek', () => ({
  getCompletedWeekKey: vi.fn(() => '2026-W40'),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  Timestamp: class TimestampMock {},
}));

vi.mock('../services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  functions: {},
  app: {},
  appCheck: null,
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User' },
  firebaseUser: null,
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { useWeeklyRanking } from './useWeeklyRanking';

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((_db: unknown, ...parts: string[]) => ({
    path: parts.join('/'),
  }));
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User' },
    firebaseUser: null,
    loading: false,
    error: null,
  };
});

describe('useWeeklyRanking', () => {
  it('não consulta Firestore quando não há usuário autenticado', () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useWeeklyRanking(), { wrapper: createTestWrapper() });

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('consulta weekly-rankings/{weekKey} da semana anterior completada', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    const { result } = renderHook(() => useWeeklyRanking(), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDoc).toHaveBeenCalledWith({}, 'weekly-rankings', '2026-W40');
    expect(result.current.data).toBeNull();
  });

  it('mapeia week_key, datas, rankings e total_games do documento', async () => {
    const startDate = new Date('2026-09-28T00:00:00Z');
    const endDate = new Date('2026-10-04T23:59:59Z');
    const rankings = [
      { user_id: 'u-1', user_name: 'Ana', points: 30 },
      { user_id: 'u-2', user_name: 'Beto', points: 20 },
    ];
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        week_key: '2026-W40',
        start_date: { toDate: () => startDate },
        end_date: { toDate: () => endDate },
        rankings,
        total_games: 7,
      }),
    });
    const { result } = renderHook(() => useWeeklyRanking(), { wrapper: createTestWrapper() });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const data = result.current.data as any;
    expect(data.weekKey).toBe('2026-W40');
    expect(data.startDate).toEqual(startDate);
    expect(data.endDate).toEqual(endDate);
    expect(data.rankings).toEqual(rankings);
    expect(data.totalGames).toBe(7);
  });

  it('usa fallbacks para rankings ausente ([]) e total_games ausente (0)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ week_key: '2026-W40' }),
    });
    const { result } = renderHook(() => useWeeklyRanking(), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      weekKey: '2026-W40',
      startDate: undefined,
      endDate: undefined,
      rankings: [],
      totalGames: 0,
    });
  });

  it('aceita datas ausentes sem quebrar (optional chaining)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ week_key: '2026-W40', rankings: [], total_games: 3 }),
    });
    const { result } = renderHook(() => useWeeklyRanking(), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.startDate).toBeUndefined();
    expect(result.current.data?.endDate).toBeUndefined();
  });

  it('expõe erro bruto do TanStack quando getDoc falha', async () => {
    mockGetDoc.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useWeeklyRanking(), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect((result.current.error as Error).message).toBe('permission-denied');
    expect(result.current.data).toBeUndefined();
  });
});