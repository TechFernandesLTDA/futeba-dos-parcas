// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();

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
    doc: (...args: any[]) => mockDoc(...args),
    query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
    limit: vi.fn((value: number) => ({ type: 'limit', value })),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

// Mock determinístico de XP (padrão useGroupLeague.test).
vi.mock('../utils/xpAccounting', () => ({
  getExperiencePoints: vi.fn((data: any) =>
    typeof data?.experience_points === 'number' ? data.experience_points
      : typeof data?.experiencePoints === 'number' ? data.experiencePoints : 0),
  getEffectiveLevel: vi.fn((_data: any, xp?: number) => ((xp ?? 0) >= 100 ? 7 : 2)),
}));

// normalizePlayerStats REAL: exercita aliases e precedência stats/streak > user.

import { usePlayerCard } from './usePlayerCard';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function snap(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data };
}

const USER_FULL = {
  name: 'Ana',
  nickname: 'ana',
  photo_url: 'ana.png',
  preferred_position: 'STRIKER',
  experience_points: 250,
  striker_rating: 4,
  mid_rating: 3,
  defender_rating: 2,
  auto_striker_rating: 1,
  favorite_team: 'Palmeiras',
  xp_top_scorer: 10,
  total_games: 99, // deve perder para statistics
  goals: 99,
};

const STATS_FULL = {
  games_played: 10,
  goals: 7,
  assists: 3,
  saves: 1,
  mvp_count: 2,
  wins: 6,
  games_draw: 2,
  games_lost: 2,
  longest_streak: 4,
};

const STREAK = { current_streak: 3 };

// Promise.all consome os TRÊS mocks — dispatch por path, nunca fila.
function dispatchReads({ userData, statsData, streakDocs }: {
  userData: Record<string, unknown> | null;
  statsData: Record<string, unknown> | null;
  streakDocs: any[];
}) {
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDoc.mockImplementation(async (ref: any) => {
    if (ref?.path === 'users/player-1') return snap(userData);
    if (ref?.path === 'statistics/player-1') return snap(statsData);
    throw new Error(`getDoc inesperado: ${ref?.path}`);
  });
  mockGetDocs.mockImplementation(async (q: any) => {
    const w = (q?.constraints ?? []).find((c: any) => c?.type === 'where');
    if (w?.field === 'user_id') return { docs: streakDocs.map((d) => ({ id: 'streak-1', data: () => d })) };
    return { docs: [] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dispatchReads({ userData: null, statsData: null, streakDocs: [] });
});

describe('usePlayerCard', () => {
  it('monta o card combinando users + statistics + user_streaks com XP e nível', async () => {
    dispatchReads({ userData: USER_FULL, statsData: STATS_FULL, streakDocs: [STREAK] });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });

    await waitFor(() => expect(result.current.playerCard).not.toBeNull());
    const card = result.current.playerCard!;
    expect(card).toMatchObject({
      id: 'player-1',
      name: 'Ana',
      nickname: 'ana',
      photoUrl: 'ana.png',
      preferredPosition: 'STRIKER',
      experiencePoints: 250,
      level: 7, // xp >= 100 (mock)
      // statistics (primary) vence o doc users (fallback)
      totalGames: 10,
      totalGoals: 7,
      totalAssists: 3,
      totalSaves: 1,
      mvpCount: 2,
      totalWins: 6,
      totalDraws: 2,
      totalLosses: 2,
      // streak doc sobrescreve o merge
      currentStreak: 3,
      bestStreak: 4,
      strikerRating: 4,
      midRating: 3,
      defenderRating: 2,
      gkRating: 0,
      autoStrikerRating: 1,
      autoMidRating: 0,
      favoriteTeam: 'Palmeiras',
      xpTopScorer: 10,
      xpHatTrick: 0,
    });
    // ratings > 0: [4, 3, 2, 1] → média 2.5 → round(2.5/5*99) = 50
    expect(card.overallRating).toBe(50);
  });

  it('overallRating 0 quando não há ratings positivos', async () => {
    dispatchReads({ userData: { name: 'Sem Rating' }, statsData: null, streakDocs: [] });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.playerCard).not.toBeNull());
    expect(result.current.playerCard!.overallRating).toBe(0);
    expect(result.current.playerCard!.experiencePoints).toBe(0);
    expect(result.current.playerCard!.level).toBe(2); // mock: xp < 100
  });

  it('precedência do campo snake_case sobre camelCase legado', async () => {
    dispatchReads({
      userData: { name: 'Dual', striker_rating: 4, strikerRating: 2 },
      statsData: null,
      streakDocs: [],
    });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.playerCard).not.toBeNull());
    expect(result.current.playerCard!.strikerRating).toBe(4);
  });

  it('usa o doc users como fallback quando statistics e streak não existem', async () => {
    dispatchReads({
      userData: {
        name: 'Fallback',
        total_games: 8,
        goals: 5,
        wins: 5,
        games_lost: 3,
        mvp_count: 1,
      },
      statsData: null,
      streakDocs: [],
    });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.playerCard).not.toBeNull());
    expect(result.current.playerCard).toMatchObject({
      totalGames: 8,
      totalGoals: 5,
      totalWins: 5,
      totalLosses: 3,
      mvpCount: 1,
      currentStreak: 0,
      bestStreak: 0,
    });
  });

  it('fallback de nome "Jogador" quando o doc users não tem nome', async () => {
    dispatchReads({ userData: { experience_points: 10 }, statsData: null, streakDocs: [] });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.playerCard).not.toBeNull());
    expect(result.current.playerCard!.name).toBe('Jogador');
    expect(result.current.playerCard!.nickname).toBeUndefined();
    expect(result.current.playerCard!.photoUrl).toBeUndefined();
  });

  it('consulta em users/{id}, statistics/{id} e user_streaks com limit 1', async () => {
    dispatchReads({ userData: { name: 'X' }, statsData: null, streakDocs: [] });
    renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());

    expect(mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/player-1' }));
    expect(mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'statistics/player-1' }));
    const q = mockGetDocs.mock.calls[0][0] as { base: { path: string }; constraints: any[] };
    expect(q.base.path).toBe('user_streaks');
    expect(q.constraints).toContainEqual({ type: 'where', field: 'user_id', op: '==', value: 'player-1' });
    expect(q.constraints).toContainEqual({ type: 'limit', value: 1 });
  });

  it('jogador inexistente: erro "Jogador não encontrado" e playerCard null', async () => {
    dispatchReads({ userData: null, statsData: null, streakDocs: [] });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('Jogador não encontrado'));
    expect(result.current.playerCard).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('userId null: query desabilitada, sem consultas e playerCard null', async () => {
    const { result } = renderHook(() => usePlayerCard(null), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {});
    expect(result.current.playerCard).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('erro do Firestore: propaga a mensagem e playerCard null', async () => {
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockGetDoc.mockRejectedValue(new Error('permission negada'));
    mockGetDocs.mockResolvedValue({ docs: [] });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('permission negada'));
    expect(result.current.playerCard).toBeNull();
  });

  it('refetch relê os três documentos', async () => {
    dispatchReads({ userData: { name: 'X' }, statsData: null, streakDocs: [] });
    const { result } = renderHook(() => usePlayerCard('player-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.playerCard).not.toBeNull());
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetDoc).toHaveBeenCalledTimes(4); // 2×(users + statistics)
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});
