/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockGetLeaguePlayers = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../services/cloudFunctions', () => ({
  getLeaguePlayers: (...args: any[]) => mockGetLeaguePlayers(...args),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

import { useLeague } from './useLeague';

const callableResponse = (
  players: Array<Record<string, unknown>>,
  options: { hasMore?: boolean; nextPageToken?: string | null; totalCount?: number } = {},
) => ({
  data: {
    success: true,
    count: players.length,
    totalCount: options.totalCount ?? players.length,
    hasMore: options.hasMore ?? false,
    nextPageToken: options.nextPageToken ?? null,
    players,
  },
});

describe('useLeague', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
    mockLimit.mockReturnValue('mock-limit');
    mockWhere.mockReturnValue('mock-where');
    mockGetLeaguePlayers.mockResolvedValue(callableResponse([]));
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useLeague('user-1'), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('não consulta nem abre listeners enquanto estiver desativado', async () => {
    const { result } = renderHook(
      () => useLeague('user-1', { seasonId: 'season-1' }, { enabled: false }),
      { wrapper: createTestWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetLeaguePlayers).not.toHaveBeenCalled();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('encerra listeners ao pausar e abre apenas um novo listener ao reativar', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useLeague('user-1', { seasonId: 'season-1' }, { enabled }),
      { wrapper: createTestWrapper(), initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetLeaguePlayers).toHaveBeenCalledTimes(1);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    await waitFor(() => expect(mockUnsubscribe).toHaveBeenCalledTimes(1));

    rerender({ enabled: true });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
    expect(mockGetLeaguePlayers).toHaveBeenCalledTimes(1);
  });

  it('limpa erro transitório quando o listener volta a receber dados', async () => {
    let onNext: (() => void) | undefined;
    let onError: ((error: Error) => void) | undefined;
    mockOnSnapshot.mockImplementation((_query, next, error) => {
      onNext = next;
      onError = error;
      return mockUnsubscribe;
    });

    const { result } = renderHook(
      () => useLeague('user-1', { seasonId: 'season-1' }),
      { wrapper: createTestWrapper() },
    );

    await waitFor(() => expect(onError).toBeDefined());
    act(() => onError?.(new Error('Falha temporária')));
    await waitFor(() => expect(result.current.error).toBe('Falha temporária'));

    act(() => onNext?.());
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('carrega jogadores pesquisáveis mesmo sem temporada ativa', async () => {
    mockGetLeaguePlayers.mockResolvedValueOnce(callableResponse([
      {
        id: 'u2',
        userId: 'u2',
        userName: 'Jogador sem temporada',
        level: 1,
        points: 0,
        gamesPlayed: 0,
        wins: 0,
        goals: 0,
        assists: 0,
        mvpCount: 0,
        division: 'BRONZE',
        experiencePoints: 0,
        canReceiveInvites: true,
      },
    ]));

    const { result } = renderHook(() => useLeague('u2', { seasonId: null }), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetLeaguePlayers).toHaveBeenCalledWith({
      seasonId: null,
      groupId: null,
      limit: 200,
      gender: null,
      search: null,
      sortField: 'experiencePoints',
      sortDirection: 'desc',
      pageToken: null,
    });
    expect(result.current.players[0]).toMatchObject({
      userId: 'u2',
      userName: 'Jogador sem temporada',
      points: 0,
      isCurrentUser: true,
      canReceiveInvites: true,
    });
  });

  it('marca o jogador atual com isCurrentUser=true', async () => {
    mockGetLeaguePlayers.mockResolvedValueOnce(callableResponse([
      {
        id: 'sp-1',
        userId: 'current-user',
        userName: 'Jogador 1',
        userPhoto: undefined,
        level: 8,
        points: 500,
        gamesPlayed: 20,
        wins: 10,
        goals: 15,
        assists: 5,
        mvpCount: 3,
        division: 'GOLD',
        experiencePoints: 1200,
        canReceiveInvites: true,
      },
      {
        id: 'sp-2',
        userId: 'other-user',
        userName: 'Jogador 2',
        level: 5,
        points: 300,
        gamesPlayed: 10,
        wins: 5,
        goals: 8,
        assists: 2,
        mvpCount: 1,
        division: 'SILVER',
        experiencePoints: 700,
        canReceiveInvites: true,
      },
    ]));

    const { result } = renderHook(() => useLeague('current-user'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.players).toHaveLength(2);
    const currentPlayer = result.current.players.find((p) => p.isCurrentUser);
    expect(currentPlayer?.userId).toBe('current-user');
  });

  it('mantém a referência da lista quando os dados não mudam', async () => {
    const { result, rerender } = renderHook(() => useLeague('user-1'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const firstPlayers = result.current.players;

    rerender();

    expect(result.current.players).toBe(firstPlayers);
  });

  it('envia filtros de temporada, grupo e gênero para a callable', async () => {
    const { result } = renderHook(
      () => useLeague('u1', {
        seasonId: 'season-1',
        groupId: 'group-1',
        maxResults: 50,
        gender: 'FEMALE',
        search: 'renan',
        sortField: 'name',
        sortDirection: 'asc',
      }),
      { wrapper: createTestWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetLeaguePlayers).toHaveBeenCalledWith({
      seasonId: 'season-1',
      groupId: 'group-1',
      limit: 50,
      gender: 'FEMALE',
      search: 'renan',
      sortField: 'name',
      sortDirection: 'asc',
      pageToken: null,
    });
  });

  it('carrega próxima página quando a callable retorna nextPageToken', async () => {
    mockGetLeaguePlayers
      .mockResolvedValueOnce(callableResponse([
        {
          id: 'u1',
          userId: 'u1',
          userName: 'Jogador 1',
          level: 1,
          points: 0,
          gamesPlayed: 0,
          wins: 0,
          goals: 0,
          assists: 0,
          mvpCount: 0,
          division: 'BRONZE',
          experiencePoints: 100,
          canReceiveInvites: true,
        },
      ], { hasMore: true, nextPageToken: '1', totalCount: 2 }))
      .mockResolvedValueOnce(callableResponse([
        {
          id: 'u2',
          userId: 'u2',
          userName: 'Jogador 2',
          level: 1,
          points: 0,
          gamesPlayed: 0,
          wins: 0,
          goals: 0,
          assists: 0,
          mvpCount: 0,
          division: 'BRONZE',
          experiencePoints: 50,
          canReceiveInvites: true,
        },
      ], { totalCount: 2 }));

    const { result } = renderHook(() => useLeague('u1', { maxResults: 1 }), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });

    await result.current.loadMore();

    await waitFor(() => {
      expect(result.current.players).toHaveLength(2);
    });

    expect(mockGetLeaguePlayers).toHaveBeenLastCalledWith(expect.objectContaining({
      pageToken: '1',
      limit: 1,
    }));
    expect(result.current.totalCount).toBe(2);
  });

  it('não abre listener direto em users', async () => {
    const { result } = renderHook(() => useLeague('u1', { seasonId: null }), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockCollection).not.toHaveBeenCalledWith({}, 'users');
  });

  it('configura listener de season_participation quando há temporada', () => {
    renderHook(() => useLeague('user-1', { seasonId: 'season-1' }), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'season_participation');
    expect(mockWhere).toHaveBeenCalledWith('season_id', '==', 'season-1');
  });

  it('trata erros da callable', async () => {
    mockGetLeaguePlayers.mockRejectedValueOnce(new Error('League error'));

    const { result } = renderHook(() => useLeague('u1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('League error');
      expect(result.current.loading).toBe(false);
    });
  });
});
