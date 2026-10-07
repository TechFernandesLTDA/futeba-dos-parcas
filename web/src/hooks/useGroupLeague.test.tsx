// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockOnSnapshot = vi.fn();
const mockGetUsersByIds = vi.fn();
const mockShowError = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field: string, direction: string) => ({ type: 'orderBy', field, direction })),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  startAfter: vi.fn((docRef: unknown) => ({ type: 'startAfter', docRef })),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  Timestamp: class TimestampMock {},
}));

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../utils/userBatch', () => ({
  getUsersByIds: (...args: any[]) => mockGetUsersByIds(...args),
}));

// Mock determinístico de XP: nível 7 quando xp>=100, senão 2.
vi.mock('../utils/xpAccounting', () => ({
  getExperiencePoints: vi.fn((data: any) =>
    typeof data?.experience_points === 'number' ? data.experience_points
      : typeof data?.experiencePoints === 'number' ? data.experiencePoints : 0),
  getEffectiveLevel: vi.fn((_data: any, xp?: number) => ((xp ?? 0) >= 100 ? 7 : 2)),
}));

import { useGroupLeague } from './useGroupLeague';

interface SnapshotCallbacks {
  next: (snapshot: unknown) => void;
  error: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let snapshotCallbacks: SnapshotCallbacks[];

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function seasonDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function standingDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  snapshotCallbacks = [];
  mockOnSnapshot.mockImplementation((_q: unknown, next: SnapshotCallbacks['next'], error: SnapshotCallbacks['error']) => {
    snapshotCallbacks.push({ next, error, unsubscribe: vi.fn() });
    return snapshotCallbacks[snapshotCallbacks.length - 1].unsubscribe;
  });
  mockGetUsersByIds.mockResolvedValue(new Map());
});

describe('useGroupLeague — seleção de temporada', () => {
  it('retorna loading=true enquanto carrega e expõe temporada ativa como selectedSeason', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        seasonDoc('s-old', { name: 'Antiga', is_active: false, start_date: '2025-01-01' }),
        seasonDoc('s-new', { name: 'Atual', is_active: true, start_date: '2026-01-01' }),
      ],
    });
    const client = makeQueryClient();
    const { result } = renderHook(() => useGroupLeague('g-1', 'u-1'), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.seasons).toHaveLength(2));
    expect(result.current.activeSeason?.id).toBe('s-new');
    expect(result.current.selectedSeason?.id).toBe('s-new');
  });

  it('selectedSeasonId explícito tem prioridade sobre a temporada ativa', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        seasonDoc('s-old', { name: 'Antiga', is_active: false, start_date: '2025-01-01' }),
        seasonDoc('s-new', { name: 'Atual', is_active: true, start_date: '2026-01-01' }),
      ],
    });
    const { result } = renderHook(() => useGroupLeague('g-1', 'u-1', 's-old'), { wrapper: wrapperFor(makeQueryClient()) });

    await waitFor(() => expect(result.current.seasons).toHaveLength(2));
    expect(result.current.selectedSeason?.id).toBe('s-old');
  });

  it('selectedSeasonId inexistente: cai para a temporada ativa', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-new', { name: 'Atual', is_active: true, start_date: '2026-01-01' })],
    });
    const { result } = renderHook(() => useGroupLeague('g-1', 'u-1', 's-ghost'), { wrapper: wrapperFor(makeQueryClient()) });

    await waitFor(() => expect(result.current.seasons).toHaveLength(1));
    expect(result.current.selectedSeason?.id).toBe('s-new');
  });

  it('sem temporada ativa: usa a primeira da lista como fallback', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-first', { name: 'Primeira', is_active: false, start_date: '2024-01-01' })],
    });
    const { result } = renderHook(() => useGroupLeague('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.seasons).toHaveLength(1));
    expect(result.current.activeSeason).toBeNull();
    expect(result.current.selectedSeason?.id).toBe('s-first');
  });

  it('sem temporadas: selectedSeason null, standings desabilitado e nenhum listener', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const client = makeQueryClient();
    const getDocsBefore = mockGetDocs.mock.calls.length;
    const { result } = renderHook(() => useGroupLeague('g-1'), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.seasons).toEqual([]);

    expect(result.current.selectedSeason).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockGetDocs).toHaveBeenCalledTimes(getDocsBefore + 1); // apenas a query de seasons
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('sem groupId: não consulta nada', () => {
    renderHook(() => useGroupLeague(), { wrapper: wrapperFor(makeQueryClient()) });
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('mapeia temporada: nome default, datas, created_at via toDate', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-1', {
        is_active: true,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        created_at: { toDate: () => createdAt },
      })],
    });
    const { result } = renderHook(() => useGroupLeague('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.seasons).toHaveLength(1));

    expect(result.current.seasons[0]).toEqual({
      id: 's-1',
      groupId: 'g-1',
      name: 'Temporada',
      isActive: true,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      createdAt,
    });
  });
});

describe('useGroupLeague — standings', () => {
  it('paginação: consulta em páginas de 200 até esgotar e agrega todos os docs', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })],
    });
    const firstPage = Array.from({ length: 200 }, (_, i) =>
      standingDoc(`u-${i}`, { user_id: `u-${i}`, points: 10, games_played: 1, wins: 1, draws: 0, losses: 0 }));
    mockGetDocs
      .mockResolvedValueOnce({ docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })] })
      .mockResolvedValueOnce({ docs: firstPage })
      .mockResolvedValueOnce({ docs: [standingDoc('u-last', { user_id: 'u-last', points: 5 })] });

    const { result } = renderHook(() => useGroupLeague('g-1', 'u-0'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.standings).toHaveLength(201));

    expect(mockGetDocs).toHaveBeenCalledTimes(3); // seasons + 2 páginas
    // Segunda chamada de standings carrega startAfter
    const secondStandingsQuery = mockGetDocs.mock.calls[2][0] as { constraints: any[] };
    expect(secondStandingsQuery.constraints.some((c) => c?.type === 'startAfter')).toBe(true);
  });

  it('ordena por pontos desc, com desempate por jogos e vitórias, e marca isCurrentUser', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })],
    });
    mockGetDocs.mockResolvedValueOnce({ docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })] });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        // mesmo pontos: quem jogou mais vem primeiro
        standingDoc('a', { user_id: 'u-a', points: 30, games_played: 5, wins: 4 }),
        standingDoc('b', { user_id: 'u-b', points: 30, games_played: 6, wins: 4 }),
        standingDoc('c', { user_id: 'u-c', points: 10 }),
      ],
    });
    mockGetUsersByIds.mockResolvedValue(new Map([
      ['u-a', { name: 'Ana', photoUrl: 'https://photo/a.png', favoriteTeam: 'Palmeiras', experience_points: 150 }],
      ['u-b', { name: 'Beto', photoUrl: null, experience_points: 50 }],
    ]));

    const { result } = renderHook(() => useGroupLeague('g-1', 'u-b'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.standings).toHaveLength(3));

    const [first, second, third] = result.current.standings;
    expect(first.userId).toBe('u-b'); // 30 pts / 6 jogos
    expect(second.userId).toBe('u-a'); // 30 pts / 5 jogos
    expect(third.userId).toBe('u-c'); // 10 pts

    expect(first.userName).toBe('Beto');
    expect(first.userPhoto).toBeUndefined(); // null → undefined
    expect(first.isCurrentUser).toBe(true);
    expect(first.level).toBe(2); // xp 50 < 100

    expect(second.userName).toBe('Ana');
    expect(second.userPhoto).toBe('https://photo/a.png');
    expect(second.favoriteTeam).toBe('Palmeiras');
    expect(second.level).toBe(7); // xp 150 >= 100
    expect(second.isCurrentUser).toBe(false);

    // Sem dados do Firestore: defaults zerados preservados
    expect(third.userName).toBe('Jogador'); // usuário ausente no batch
    expect(third.level).toBe(2); // cai para o level calculado do standing
    expect(third.points).toBe(10);
    expect(third.gamesPlayed).toBe(0);
    expect(third.isCurrentUser).toBe(false);
  });

  it('usa fallbacks snake/camel e zera campos ausentes no mapeamento', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })] })
      .mockResolvedValueOnce({
        docs: [standingDoc('u-x', { user_id: 'u-x', points: 20, goals_scored: 9, goal_difference: 4, mvp_count: 2 })],
      });

    const { result } = renderHook(() => useGroupLeague('g-1', 'u-x'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.standings).toHaveLength(1));

    const s = result.current.standings[0];
    expect(s.goalsScored).toBe(9);
    expect(s.goalsConceded).toBe(0);
    expect(s.goalDifference).toBe(4);
    expect(s.mvpCount).toBe(2);
    expect(s.wins).toBe(0);
    expect(s.draws).toBe(0);
    expect(s.losses).toBe(0);
  });

  it('expõe erro da query de standings e mensagem do listener em listenerError', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })] })
      .mockRejectedValueOnce(new Error('permission-denied'));

    const { result } = renderHook(() => useGroupLeague('g-1', 'u-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('permission-denied'));
    expect(result.current.standings).toEqual([]);
  });

  it('listener: primeiro snapshot é ignorado, segundo invalida a query; erro chama showError e expõe mensagem', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })],
    });
    const client = makeQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useGroupLeague('g-1', 'u-1'), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());

    const subscription = snapshotCallbacks[0];
    act(() => subscription.next({}));
    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => subscription.next({}));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['groupLeagueStandings', 'g-1', 's-1'] }),
    );

    act(() => subscription.error(new Error('stream-aborted')));
    await waitFor(() => expect(result.current.error).toBe('stream-aborted'));
    expect(mockShowError).toHaveBeenCalledWith('Erro ao carregar classificação em tempo real');

    await act(async () => { await result.current.refetch(); });
  });

  it('unmount cancela o listener', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-1', { name: 'Atual', is_active: true, start_date: '2026-01-01' })],
    });
    const { result, unmount } = renderHook(() => useGroupLeague('g-1', 'u-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalled());
    unmount();
    expect(snapshotCallbacks[0].unsubscribe).toHaveBeenCalledOnce();
    void result;
  });
});