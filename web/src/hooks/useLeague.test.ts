/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// Mocks
const mockOnSnapshot = vi.fn();
const mockGetDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

import { useLeague } from './useLeague';

describe('useLeague', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue('mock-doc-ref');
    mockOrderBy.mockReturnValue('mock-order');
    mockLimit.mockReturnValue('mock-limit');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useLeague('user-1'), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('configura listener na coleção season_participation', () => {
    renderHook(() => useLeague('user-1'), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'season_participation');
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('marca o jogador atual com isCurrentUser=true', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Jogador 1', photo_url: null }),
    });

    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          {
            id: 'sp-1',
            data: () => ({
              user_id: 'current-user',
              points: 500,
              level: 8,
              games_played: 20,
              wins: 10,
              goals: 15,
              assists: 5,
              mvp_count: 3,
              division: 'GOLD',
            }),
          },
          {
            id: 'sp-2',
            data: () => ({
              user_id: 'other-user',
              points: 300,
              level: 5,
              games_played: 10,
              wins: 5,
              goals: 8,
              assists: 2,
              mvp_count: 1,
              division: 'SILVER',
            }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useLeague('current-user'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.players).toHaveLength(2);
    const currentPlayer = result.current.players.find((p) => p.isCurrentUser);
    expect(currentPlayer).toBeDefined();
    expect(currentPlayer?.userId).toBe('current-user');
  });

  it('filtra jogadores por divisão', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Player', photo_url: null }),
    });

    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          {
            id: 'sp-1',
            data: () => ({ user_id: 'u1', points: 500, division: 'GOLD' }),
          },
          {
            id: 'sp-2',
            data: () => ({ user_id: 'u2', points: 100, division: 'SILVER' }),
          },
          {
            id: 'sp-3',
            data: () => ({ user_id: 'u3', points: 600, division: 'GOLD' }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useLeague('u1', 'GOLD'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.players).toHaveLength(2);
    expect(result.current.players.every((p) => p.division === 'GOLD')).toBe(true);
  });

  it('busca dados do usuário para cada jogador', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Jogador X', photo_url: 'http://photo.jpg' }),
    });

    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          {
            id: 'sp-1',
            data: () => ({ user_id: 'u1', points: 100, division: 'BRONZE' }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useLeague('u1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetDoc).toHaveBeenCalled();
    expect(result.current.players[0].userName).toBe('Jogador X');
  });

  it('trata erros do snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any, onError: any) => {
      onError(new Error('League error'));
      return vi.fn();
    });

    const { result } = renderHook(() => useLeague('u1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('League error');
      expect(result.current.loading).toBe(false);
    });
  });
});
