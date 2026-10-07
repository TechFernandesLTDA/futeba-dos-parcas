// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// t ESTÁVEL: fetchStats tem useCallback([t]); uma nova função por render
// recriaria a callback e reexecutaria o effect em loop infinito.
const mockT = (key: string) => key;

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  // services/firebase.ts precisa existir no mock. #2330
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useStatistics } from './useStatistics';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function docSnapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return { exists: () => exists, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  // 1ª getDoc: users/{uid}; 2ª: statistics/{uid}. getDocs: user_streaks.
  mockGetDoc
    .mockResolvedValueOnce(docSnapshot(false))
    .mockResolvedValueOnce(docSnapshot(false));
  mockGetDocs.mockResolvedValue({ docs: [] as any[] });
});

describe('useStatistics', () => {
  it('userId indefinido: mantém loading=true e não consulta Firestore', async () => {
    const { result } = renderHook(() => useStatistics(undefined));
    expect(result.current.loading).toBe(true);
    await act(async () => {});
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('mescla user + statistics + streak (level/xp do user, métricas das stats)', async () => {
    mockGetDoc
      .mockReset()
      .mockResolvedValueOnce(
        docSnapshot(true, { name: 'Zé', level: 7, experience_points: 340 }),
      )
      .mockResolvedValueOnce(
        docSnapshot(true, { total_games: 10, total_goals: 4, total_assists: 2, total_wins: 5 }),
      );
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => ({ current_streak: 3, best_streak: 8 }) }],
    });
    const { result } = renderHook(() => useStatistics('u-1'));
    await waitFor(() => expect(result.current.stats).not.toBeNull());
    const stats = result.current.stats!;
    expect(stats.userId).toBe('u-1');
    expect(stats.level).toBe(7);
    expect(stats.experiencePoints).toBe(340);
    expect(stats.totalGames).toBe(10);
    expect(stats.totalGoals).toBe(4);
    expect(stats.totalAssists).toBe(2);
    expect(stats.totalWins).toBe(5);
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(8);
    expect(stats.winRate).toBe(0.5);
    expect(stats.avgGoalsPerGame).toBe(0.4);
    expect(stats.avgAssistsPerGame).toBe(0.2);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('user doc ausente: stats derivadas de statistics + streak', async () => {
    mockGetDoc
      .mockReset()
      .mockResolvedValueOnce(docSnapshot(false))
      .mockResolvedValueOnce(docSnapshot(true, { gamesPlayed: 7, goals: 3 }));
    const { result } = renderHook(() => useStatistics('u-1'));
    await waitFor(() => expect(result.current.stats).not.toBeNull());
    const stats = result.current.stats!;
    // Aliases legados (gamesPlayed/goals) são reconhecidos pelo normalizePlayerStats
    expect(stats.totalGames).toBe(7);
    expect(stats.totalGoals).toBe(3);
    expect(stats.avgGoalsPerGame).toBeCloseTo(3 / 7);
    expect(stats.level).toBe(0); // sem user doc: fallback do normalize
  });

  it('statistics ausente mas user presente: stats não é null (zera métricas)', async () => {
    mockGetDoc
      .mockReset()
      .mockResolvedValueOnce(docSnapshot(true, { level: 2, experience_points: 50 }))
      .mockResolvedValueOnce(docSnapshot(false));
    const { result } = renderHook(() => useStatistics('u-1'));
    await waitFor(() => expect(result.current.stats).not.toBeNull());
    const stats = result.current.stats!;
    expect(stats.level).toBe(2);
    expect(stats.experiencePoints).toBe(50);
    expect(stats.totalGames).toBe(0);
    expect(stats.winRate).toBe(0);
  });

  it('user e statistics ausentes: stats=null e loading=false', async () => {
    const { result } = renderHook(() => useStatistics('u-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('erro no fetch: error com chave i18n e loading=false', async () => {
    mockGetDoc.mockReset().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useStatistics('u-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('feedback.statistics.loadError');
    expect(result.current.stats).toBeNull();
  });

  it('retry refaz o fetch e recupera após erro', async () => {
    // Cada fetch dispara DOIS getDoc (users + statistics) via Promise.all —
    // as duas chamadas precisam estar na fila, mesmo quando a 1ª rejeita.
    mockGetDoc
      .mockReset()
      .mockRejectedValueOnce(new Error('boom')) // fetch 1: users/{uid}
      .mockResolvedValueOnce(docSnapshot(false)) // fetch 1: statistics/{uid} (ignorado)
      .mockResolvedValueOnce(docSnapshot(true, { level: 4, experience_points: 100 })) // fetch 2: users
      .mockResolvedValueOnce(docSnapshot(false)); // fetch 2: statistics
    const { result } = renderHook(() => useStatistics('u-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('feedback.statistics.loadError');

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.stats).not.toBeNull());
    expect(result.current.stats!.level).toBe(4);
    expect(result.current.stats!.experiencePoints).toBe(100);
    expect(result.current.error).toBeNull();
  });

  it('mudança de userId refaz o fetch para o novo usuário', async () => {
    mockGetDoc.mockReset().mockImplementation((...args: unknown[]) => {
      const ref = args[0] as { path?: string };
      const uid = (ref?.path ?? '').split('/')[1];
      if (uid === 'u-1') {
        return Promise.resolve(docSnapshot(true, { level: 1, experience_points: 10 }));
      }
      return Promise.resolve(docSnapshot(true, { level: 9, experience_points: 900 }));
    });
    const { result, rerender } = renderHook(({ userId }: { userId: string | undefined }) => useStatistics(userId), {
      initialProps: { userId: 'u-1' },
    });
    await waitFor(() => expect(result.current.stats?.level).toBe(1));
    rerender({ userId: 'u-2' });
    await waitFor(() => expect(result.current.stats?.level).toBe(9));
    expect(mockGetDoc.mock.calls.some((call) => (call[0] as any)?.path === 'users/u-2')).toBe(true);
  });

  it('unmount durante o fetch: resolve depois sem crash nem estado órfão', async () => {
    let resolveUsersDoc!: (v: unknown) => void;
    mockGetDoc
      .mockReset()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUsersDoc = resolve;
        }),
      )
      .mockResolvedValueOnce(docSnapshot(false));
    const { unmount } = renderHook(() => useStatistics('u-1'));
    unmount();
    expect(() => resolveUsersDoc(docSnapshot(true, { level: 1 }))).not.toThrow();
    await act(async () => {});
  });
});
