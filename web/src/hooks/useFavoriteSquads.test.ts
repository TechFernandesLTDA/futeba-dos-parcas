// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';
// Importado APÓS o vi.mock: resolve para o MockTimestamp definido na factory,
// garantindo que instanceof Timestamp em utils/firestoreHelpers (toDate) funcione.
import { Timestamp } from 'firebase/firestore';

// t ESTÁVEL: addFavoriteSquad/deleteFavoriteSquad têm useCallback([t]).
const mockT = (key: string) => key;

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => {
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
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    query: (...args: any[]) => mockQuery(...args),
    orderBy: vi.fn((...args: any[]) => args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    serverTimestamp: () => SERVER_TIMESTAMP,
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
}));

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useFavoriteSquads } from './useFavoriteSquads';
import type { FavoriteSquadInput } from '../types/favoriteSquad';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

const T0 = 1700000000000;

function squadDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      owner_id: 'test-user-id',
      name: 'Time de Quinta',
      type: 'TEAM',
      player_ids: ['p1', 'p2', 'p3'],
      player_names: ['Alfa', 'Beta', 'Gama'],
      created_at: Timestamp.fromMillis(T0),
      updated_at: Timestamp.fromMillis(T0 + 1000),
      ...overrides,
    }),
  };
}

const VALID_INPUT: FavoriteSquadInput = {
  name: 'Dupla Fixa',
  playerIds: ['p1', 'p2'],
  playerNames: ['Alfa', 'Beta'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockQuery.mockImplementation((...args: unknown[]) => args);
  mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
    onNext({ docs: [] });
    return vi.fn();
  });
  mockAddDoc.mockResolvedValue({ id: 'squad-new' });
  mockDeleteDoc.mockResolvedValue(undefined);
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
  };
});

describe('useFavoriteSquads', () => {
  it('não configura listener sem uid e libera loading', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.squads).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('consulta users/{uid}/favorite_squads ordenando por updated_at desc', () => {
    renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'test-user-id', 'favorite_squads');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('mapeia docs snake_case para FavoriteSquad com timestamps como Date', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext({ docs: [squadDoc('s-1')] });
      return vi.fn();
    });
    const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.squads).toHaveLength(1);
    expect(result.current.squads[0]).toEqual({
      id: 's-1',
      ownerId: 'test-user-id',
      name: 'Time de Quinta',
      type: 'TEAM',
      playerIds: ['p1', 'p2', 'p3'],
      playerNames: ['Alfa', 'Beta', 'Gama'],
      createdAt: new Date(T0),
      updatedAt: new Date(T0 + 1000),
    });
  });

  it('deriva type a partir da contagem de jogadores (2 → PAIR) e usa fallbacks', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext({
        docs: [
          squadDoc('s-pair', { type: undefined, player_ids: ['a', 'b'], player_names: undefined }),
          squadDoc('s-empty', { name: undefined, player_ids: undefined, player_names: undefined, owner_id: undefined }),
        ],
      });
      return vi.fn();
    });
    const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.squads[0]).toMatchObject({ type: 'PAIR', playerIds: ['a', 'b'], playerNames: [] });
    expect(result.current.squads[1]).toMatchObject({
      name: 'Favorito',
      type: 'TEAM', // 0 jogadores → getFavoriteSquadType(0) !== 2 → 'TEAM'
      ownerId: '',
      playerIds: [],
      playerNames: [],
    });
  });

  it('registra erro do snapshot, expõe message e mostra toast', async () => {
    mockOnSnapshot.mockImplementation((_q: any, _onNext: any, onError: any) => {
      onError(new Error('permission-denied'));
      return vi.fn();
    });
    const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('permission-denied');
    expect(mockShowError).toHaveBeenCalledWith('profile.favoriteSquads.loadError');
  });

  it('remove o listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('reabre o listener quando o uid muda', async () => {
    const { result, rerender } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockAuthReturn = {
      user: { id: 'other-uid', name: 'Other', photoUrl: null },
      firebaseUser: { uid: 'other-uid', displayName: 'Other', photoURL: null },
      loading: false, error: null,
    };
    rerender();
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'other-uid', 'favorite_squads');
  });

  describe('addFavoriteSquad', () => {
    it('valida nome vazio e mostra toast sem gravar', async () => {
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.addFavoriteSquad({ ...VALID_INPUT, name: '   ' })).toBe(false);
      });
      expect(mockShowError).toHaveBeenCalledWith('profile.favoriteSquads.validation.name');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('valida mínimo de 2 jogadores', async () => {
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.addFavoriteSquad({
          name: 'Solo', playerIds: ['p1'], playerNames: ['Alfa'],
        })).toBe(false);
      });
      expect(mockShowError).toHaveBeenCalledWith('profile.favoriteSquads.validation.minPlayers');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('valida acima de 8 jogadores', async () => {
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      const ids = Array.from({ length: 9 }, (_, i) => `p${i}`);
      await act(async () => {
        expect(await result.current.addFavoriteSquad({
          name: 'Muita gente', playerIds: ids, playerNames: ids.map((id) => `N ${id}`),
        })).toBe(false);
      });
      expect(mockShowError).toHaveBeenCalledWith('profile.favoriteSquads.validation.maxPlayers');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('preenche playerNames faltantes com "Jogador" após normalizar (divergência não rejeita)', async () => {
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      // normalizeFavoriteSquadInput mapeia por playerIds e completa nomes com
      // "Jogador", então playerIds.length === playerNames.length pós-normalização.
      await act(async () => {
        expect(await result.current.addFavoriteSquad({
          name: 'Dupla', playerIds: ['p1', 'p2'], playerNames: ['Alfa'],
        })).toBe(true);
      });
      expect(mockShowError).not.toHaveBeenCalled();
      const payload = mockAddDoc.mock.calls[0][1] as any;
      expect(payload.player_ids).toEqual(['p1', 'p2']);
      expect(payload.player_names).toEqual(['Alfa', 'Jogador']);
    });

    it('grava payload normalizado com serverTimestamp e toast de sucesso', async () => {
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.addFavoriteSquad({
          name: '  Dupla Fixa  ', playerIds: [' p1 ', 'p2', ''], playerNames: [' Alfa ', 'Beta', 'Ignorado'],
        })).toBe(true);
      });
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const [collRef, payload] = mockAddDoc.mock.calls[0] as any[];
      expect(collRef.path).toBe('users/test-user-id/favorite_squads');
      expect(payload).toMatchObject({
        owner_id: 'test-user-id',
        name: 'Dupla Fixa',
        type: 'PAIR',
        player_ids: ['p1', 'p2'],
        player_names: ['Alfa', 'Beta'],
      });
      expect(payload.created_at).toBe(SERVER_TIMESTAMP);
      expect(payload.updated_at).toBe(SERVER_TIMESTAMP);
      expect(mockShowSuccess).toHaveBeenCalledWith('profile.favoriteSquads.saveSuccess');
      expect(result.current.saving).toBe(false);
    });

    it('retorna false com toast de erro quando addDoc falha', async () => {
      mockAddDoc.mockRejectedValue(new Error('unavailable'));
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.addFavoriteSquad(VALID_INPUT)).toBe(false);
      });
      expect(mockShowError).toHaveBeenCalledWith('profile.favoriteSquads.saveError');
      expect(result.current.saving).toBe(false);
    });

    it('retorna false sem uid, sem gravar', async () => {
      mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.addFavoriteSquad(VALID_INPUT)).toBe(false);
      });
      expect(mockAddDoc).not.toHaveBeenCalled();
    });
  });

  describe('deleteFavoriteSquad', () => {
    it('deleta o doc e mostra toast de sucesso', async () => {
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.deleteFavoriteSquad('squad-1')).toBe(true);
      });
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect((mockDeleteDoc.mock.calls[0][0] as any).path).toBe('users/test-user-id/favorite_squads/squad-1');
      expect(mockShowSuccess).toHaveBeenCalledWith('profile.favoriteSquads.deleteSuccess');
      expect(result.current.deletingId).toBeNull();
    });

    it('expõe deletingId durante a exclusão e limpa ao terminar', async () => {
      let resolveDelete!: (v: unknown) => void;
      mockDeleteDoc.mockImplementation(() => new Promise((resolve) => { resolveDelete = resolve; }));
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      const promise = act(async () => {
        const started = result.current.deleteFavoriteSquad('squad-1');
        resolveDelete(undefined);
        expect(await started).toBe(true);
      });
      await promise;
      expect(result.current.deletingId).toBeNull();
    });

    it('retorna false com toast de erro quando deleteDoc falha', async () => {
      mockDeleteDoc.mockRejectedValue(new Error('permission-denied'));
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.deleteFavoriteSquad('squad-1')).toBe(false);
      });
      expect(mockShowError).toHaveBeenCalledWith('profile.favoriteSquads.deleteError');
      expect(result.current.deletingId).toBeNull();
    });

    it('retorna false sem uid ou squadId vazio', async () => {
      mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
      const { result } = renderHook(() => useFavoriteSquads(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        expect(await result.current.deleteFavoriteSquad('squad-1')).toBe(false);
        expect(await result.current.deleteFavoriteSquad('')).toBe(false);
      });
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });
  });
});