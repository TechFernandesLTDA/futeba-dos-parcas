/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// useLeague usa useQuery/getDocs para dados + onSnapshot para invalidação (#2351)
const mockOnSnapshot = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockDocumentId = vi.fn(() => '__name__');
const mockStartAfter = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  startAfter: (...args: any[]) => mockStartAfter(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  documentId: () => mockDocumentId(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));
import { useLeague } from './useLeague';

describe('useLeague', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue('mock-doc-ref');
    mockOrderBy.mockReturnValue('mock-order');
    mockLimit.mockReturnValue('mock-limit');
    mockStartAfter.mockReturnValue('mock-start-after');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useLeague('user-1'), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('configura listener na coleção season_participation', () => {
    renderHook(() => useLeague('user-1'), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'season_participation');
  });

  it('marca o jogador atual com isCurrentUser=true', async () => {
    // useLeague usa getDocs via useQuery — simular via mockGetDocs. #2330
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Jogador 1', photo_url: null }),
    });

    mockGetDocs.mockResolvedValueOnce({
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
    // useLeague usa getDocs — a filtragem por divisão é feita na query Firestore.
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Player', photo_url: null }),
    });

    // Simular que getDocs já retorna apenas GOLD (como a query filtrada faria)
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'sp-1', data: () => ({ user_id: 'u1', points: 500, division: 'GOLD' }) },
        { id: 'sp-3', data: () => ({ user_id: 'u3', points: 600, division: 'GOLD' }) },
      ],
    });

    const { result } = renderHook(() => useLeague('u1', 'GOLD'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.players).toHaveLength(2);
    expect(result.current.players.every((p) => p.division === 'GOLD')).toBe(true);
  });

  it('busca dados do usuário para cada jogador', async () => {
    // useLeague usa getDocs (whereIn) para buscar dados dos usuários — não getDoc. #2330
    // 1ª chamada: season_participation; 2ª chamada: users whereIn
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [{ id: 'sp-1', data: () => ({ user_id: 'u1', points: 100, division: 'BRONZE' }) }],
      })
      .mockResolvedValueOnce({
        docs: [{ id: 'u1', data: () => ({ name: 'Jogador X', photo_url: 'http://photo.jpg', is_searchable: true }) }],
      });

    const { result } = renderHook(() => useLeague('u1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // getDocs foi chamado pelo menos 2 vezes (season_participation + users)
    expect(mockGetDocs).toHaveBeenCalled();
    expect(result.current.players[0].userName).toBe('Jogador X');
  });

  it('trata erros do getDocs', async () => {
    // useLeague usa useQuery/getDocs — testar erro via mockRejectedValue. #2330
    mockGetDocs.mockRejectedValueOnce(new Error('League error'));

    const { result } = renderHook(() => useLeague('u1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('League error');
      expect(result.current.loading).toBe(false);
    });
  });

  it('busca próxima página usando cursor em vez de aumentar o limite', async () => {
    const lastDoc = { id: 'cursor-doc', data: () => ({ user_id: 'u1', points: 100, division: 'BRONZE' }) };
    mockGetDocs
      .mockResolvedValueOnce({
        docs: Array.from({ length: 200 }, (_, index) => ({
          id: `sp-${index}`,
          data: () => ({ user_id: `u${index}`, points: 200 - index, division: 'BRONZE' }),
        })).map((doc, index, docs) => (index === docs.length - 1 ? lastDoc : doc)),
      })
      .mockResolvedValue({ docs: [] });

    const { result } = renderHook(() => useLeague('u1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });

    await result.current.loadMore();

    expect(mockStartAfter).toHaveBeenCalledWith(lastDoc);
    expect(mockLimit).toHaveBeenCalledWith(200);
  });
});
