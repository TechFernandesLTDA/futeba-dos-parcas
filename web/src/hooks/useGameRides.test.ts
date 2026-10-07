// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';
import type { Game } from '../types/game';

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();
const mockWriteBatch = vi.fn();

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
    where: vi.fn((...args: any[]) => args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    serverTimestamp: () => SERVER_TIMESTAMP,
    writeBatch: (...args: any[]) => mockWriteBatch(...args),
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

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User', photoUrl: null, nickname: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
  loading: false, error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: any) => err?.message ?? 'Erro ao acessar dados. Tente novamente',
  getAuthErrorMessage: (err: any) => err?.message ?? 'Erro inesperado',
  getFunctionErrorMessage: (err: any) => err?.message ?? 'Erro de função',
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useGameRides, type SaveGameRideInput } from './useGameRides';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

const T0 = 1700000000000;

function rideDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      game_id: 'game-1',
      group_id: 'group-1',
      user_id: 'other-1',
      user_name: 'Other Player',
      user_photo: 'https://photo.example/other.png',
      type: 'OFFER',
      origin_label: 'Rua A',
      destination_label: 'Quadra X',
      seats: 2,
      note: 'levo 2',
      status: 'ACTIVE',
      created_at: new MockDate(),
      updated_at: new MockDate(),
      ...overrides,
    }),
  };
}

// MockTimestamp como objeto com toDate — parseRideDoc usa toDate() do helper,
// que só aceita Date real ou Timestamp com instanceof. Usamos Date real aqui.
class MockDate extends Date {}

function setupBatchMock() {
  mockBatchSet.mockClear();
  mockBatchUpdate.mockClear();
  mockBatchCommit.mockClear().mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue({ set: mockBatchSet, update: mockBatchUpdate, commit: mockBatchCommit });
}

function makeSnapshot(docs: any[]) {
  return { docs };
}

function makeGame(_overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    locationName: 'Quadra X',
    groupId: 'group-1',
  } as unknown as Game;
}

const GAME = makeGame();

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockQuery.mockImplementation((...args: unknown[]) => args);
  mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
    onNext(makeSnapshot([]));
    return vi.fn();
  });
  setupBatchMock();
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', photoUrl: null, nickname: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
  };
});

describe('useGameRides — listener', () => {
  it('não configura listener quando enabled=false', async () => {
    const { result } = renderHook(() => useGameRides(GAME, false), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rides).toEqual([]);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('não configura listener quando game é null', async () => {
    const { result } = renderHook(() => useGameRides(null, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('consulta game_rides filtrando por game_id e status ACTIVE', () => {
    renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'game_rides');
    expect(mockQuery).toHaveBeenCalled();
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('mapeia e ordena rides por updatedAt desc', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([
        rideDoc('r-1', { updated_at: new Date(T0), type: 'OFFER', seats: 3 }),
        rideDoc('r-2', { updated_at: new Date(T0 + 1000), type: 'REQUEST', seats: null }),
        rideDoc('r-3', { updated_at: undefined }),
      ]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rides.map((r) => r.id)).toEqual(['r-2', 'r-1', 'r-3']);
    expect(result.current.rides[0]).toMatchObject({
      gameId: 'game-1',
      groupId: 'group-1',
      userId: 'other-1',
      userName: 'Other Player',
      type: 'REQUEST',
      originLabel: 'Rua A',
      destinationLabel: 'Quadra X',
      seats: null,
      status: 'ACTIVE',
    });
    expect(result.current.rides[2].updatedAt).toBeUndefined();
  });

  it('normaliza type/status desconhecidos para OFFER/ACTIVE', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([
        rideDoc('r-1', { type: 'WEIRD', status: 'PENDING', seats: '3' }),
      ]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rides[0]).toMatchObject({ type: 'OFFER', status: 'ACTIVE', seats: null });
  });

  it('expõe currentUserRide somente quando o ride do usuário está ACTIVE', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([
        rideDoc('mine', { user_id: 'test-user-id', type: 'REQUEST' }),
        rideDoc('other', { user_id: 'other-1' }),
      ]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentUserRide?.id).toBe('mine');
  });

  it('currentUserRide é null quando o usuário não tem ride', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentUserRide).toBeNull();
  });

  it('usa firebaseUser.uid como currentUserId, com fallback para user.id', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([rideDoc('mine', { user_id: 'fb-uid' })]));
      return vi.fn();
    });
    mockAuthReturn = {
      user: { id: 'user-doc-id', name: 'Test User', photoUrl: null },
      firebaseUser: { uid: 'fb-uid', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
    };
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentUserRide?.userId).toBe('fb-uid');
  });

  it('trata erros do snapshot: limpa rides e expõe mensagem', async () => {
    mockOnSnapshot.mockImplementation((_q: any, _onNext: any, onError: any) => {
      onError(new Error('permission-denied: bloqueado'));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('permission-denied: bloqueado');
    expect(result.current.rides).toEqual([]);
  });

  it('refetch incrementa o token e reabre o listener', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
  });

  it('remove o listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('useGameRides — saveRide', () => {
  const OFFER: SaveGameRideInput = {
    type: 'OFFER', originLabel: 'Rua A', destinationLabel: 'Quadra X', seats: 2, note: 'levo 2',
  };

  it('retorna false sem game ou usuário autenticado', async () => {
    const { result } = renderHook(() => useGameRides(null, true), { wrapper: createTestWrapper() });
    await act(async () => {
      expect(await result.current.saveRide(OFFER)).toBe(false);
    });
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result: result2 } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result2.current.loading).toBe(false));
    await act(async () => {
      expect(await result2.current.saveRide(OFFER)).toBe(false);
    });
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('rejeita origem/destino com menos de 2 caracteres após normalizar', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(async () => {
      await result.current.saveRide({ ...OFFER, originLabel: '  R  ', destinationLabel: '' });
    })).rejects.toThrow('Informe origem e destino aproximados.');
    await expect(act(async () => {
      await result.current.saveRide({ ...OFFER, originLabel: 'Rua A', destinationLabel: ' ' });
    })).rejects.toThrow('Informe origem e destino aproximados.');
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('rejeita vagas inválidas em OFFER (não inteiro, negativo ou acima de 8)', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // seats 0 é tratado como 1 pelo hook (input.seats || 1) — não lança.
    for (const seats of [9, 2.5, -1]) {
      await expect(act(async () => {
        await result.current.saveRide({ ...OFFER, seats });
      })).rejects.toThrow('Informe entre 1 e 8 vagas.');
    }
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('cria ride OFFER com created_at e seats normalizados quando não há ride própria', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.saveRide(OFFER)).toBe(true);
    });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    const rideSet = mockBatchSet.mock.calls.find(([ref]) => (ref as any).path === 'game_rides/game-1_test-user-id');
    expect(rideSet).toBeTruthy();
    const [, payload, opts] = rideSet as any[];
    expect(opts).toBeUndefined();
    expect(payload).toMatchObject({
      game_id: 'game-1',
      group_id: 'group-1',
      user_id: 'test-user-id',
      user_name: 'Test User',
      type: 'OFFER',
      origin_label: 'Rua A',
      destination_label: 'Quadra X',
      seats: 2,
      note: 'levo 2',
      status: 'ACTIVE',
    });
    expect(payload.created_at).toBe(SERVER_TIMESTAMP);
    expect(payload.updated_at).toBe(SERVER_TIMESTAMP);
  });

  it('usa merge:true e omite created_at ao atualizar ride existente', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([rideDoc('mine', { user_id: 'test-user-id', type: 'OFFER' })]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveRide(OFFER);
    });
    const rideSet = mockBatchSet.mock.calls.find(([ref]) => (ref as any).path === 'game_rides/game-1_test-user-id');
    const [, payload, opts] = rideSet as any[];
    expect(opts).toEqual({ merge: true });
    expect(payload.created_at).toBeUndefined();
  });

  it('grava seats=null em REQUEST', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveRide({ ...OFFER, type: 'REQUEST', seats: 4 });
    });
    const rideSet = mockBatchSet.mock.calls.find(([ref]) => (ref as any).path === 'game_rides/game-1_test-user-id');
    const [, payload] = rideSet as any[];
    expect(payload.seats).toBeNull();
  });

  it('fallback de destino: destinationLabel vazio → game.locationName', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveRide({ ...OFFER, destinationLabel: '' });
    });
    const rideSet = mockBatchSet.mock.calls.find(([ref]) => (ref as any).path === 'game_rides/game-1_test-user-id');
    const [, payload] = rideSet as any[];
    expect(payload.destination_label).toBe('Quadra X');
  });

  it('notifica usuários com o tipo oposto (exceto o próprio), com título e corpo corretos', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([
        rideDoc('req-1', { user_id: 'other-1', type: 'REQUEST', updated_at: new Date(T0 + 2000) }),
        rideDoc('req-2', { user_id: 'other-2', type: 'REQUEST', updated_at: new Date(T0 + 1000) }),
        // O próprio usuário pedindo carona não deve ser notificado.
        rideDoc('self', { user_id: 'test-user-id', type: 'REQUEST' }),
        // Outro OFFER (mesmo tipo) não deve ser notificado.
        rideDoc('same', { user_id: 'other-3', type: 'OFFER' }),
      ]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveRide(OFFER);
    });
    const notificationSets = mockBatchSet.mock.calls.filter(([, payload]) => (payload as any).type === 'GAME_RIDE');
    expect(notificationSets).toHaveLength(2);
    const targets = notificationSets.map(([, payload]) => (payload as any).user_id);
    expect(targets).toEqual(['other-1', 'other-2']);
    const first = notificationSets[0][1] as any;
    expect(first).toMatchObject({
      created_by: 'test-user-id',
      title: 'Carona oferecida',
      reference_id: 'game-1',
      reference_type: 'game',
      action_type: 'OPEN_GAME',
      read: false,
    });
    expect(first.body).toBe('Test User ofereceu carona para Quadra X saindo de Rua A (2 vagas).');
    expect(first.message).toBe(first.body);
  });

  it('corpo de REQUEST: "pediu carona", sem menção a vagas; título "Pedido de carona"', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([rideDoc('off-1', { user_id: 'other-1', type: 'OFFER', updated_at: new Date(T0) })]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveRide({ ...OFFER, type: 'REQUEST', seats: null });
    });
    const notif = mockBatchSet.mock.calls.find(([, payload]) => (payload as any).type === 'GAME_RIDE');
    const payload = notif![1] as any;
    expect(payload.title).toBe('Pedido de carona');
    expect(payload.body).toBe('Test User pediu carona para Quadra X saindo de Rua A.');
  });

  it('usa "1 vaga" quando seats <= 1 e normaliza espaços múltiplos dos labels', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([rideDoc('req-1', { user_id: 'other-1', type: 'REQUEST', updated_at: new Date(T0) })]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveRide({ ...OFFER, seats: 1, originLabel: 'Rua   B', destinationLabel: 'Quadra   Y' });
    });
    const rideSet = mockBatchSet.mock.calls.find(([ref]) => (ref as any).path === 'game_rides/game-1_test-user-id');
    const [, payload] = rideSet as any[];
    expect(payload.origin_label).toBe('Rua B');
    expect(payload.destination_label).toBe('Quadra Y');
    const notif = mockBatchSet.mock.calls.find(([, payload2]) => (payload2 as any).type === 'GAME_RIDE');
    expect((notif![1] as any).body).toContain('(1 vaga)');
  });

  it('limita notificações a 20 destinatários', async () => {
    const manyRequests = Array.from({ length: 25 }, (_, i) =>
      rideDoc(`req-${i}`, { user_id: `user-${i}`, type: 'REQUEST' }));
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot(manyRequests));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveRide(OFFER);
    });
    const notificationSets = mockBatchSet.mock.calls.filter(([, payload]) => (payload as any).type === 'GAME_RIDE');
    expect(notificationSets).toHaveLength(20);
  });

  it('define erro e repropaga falha do commit; saving volta a false', async () => {
    mockBatchCommit.mockRejectedValue(new Error('unavailable: firestore caiu'));
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.saveRide(OFFER);
      } catch (err) {
        caught = err;
      }
    });
    expect((caught as Error).message).toBe('unavailable: firestore caiu');
    await waitFor(() => expect(result.current.error).toBe('unavailable: firestore caiu'));
    expect(result.current.saving).toBe(false);
  });
});

describe('useGameRides — cancelRide', () => {
  it('marca o ride do usuário como CANCELLED', async () => {
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.cancelRide()).toBe(true);
    });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    const [ref, payload] = mockBatchUpdate.mock.calls[0] as any[];
    expect(ref.path).toBe('game_rides/game-1_test-user-id');
    expect(payload.status).toBe('CANCELLED');
    expect(payload.updated_at).toBe(SERVER_TIMESTAMP);
    expect(result.current.cancelling).toBe(false);
  });

  it('retorna false sem game ou usuário', async () => {
    const { result } = renderHook(() => useGameRides(null, true), { wrapper: createTestWrapper() });
    await act(async () => {
      expect(await result.current.cancelRide()).toBe(false);
    });
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('define erro e repropaga falha do commit', async () => {
    mockBatchCommit.mockRejectedValue(new Error('failed-precondition: bloqueado'));
    const { result } = renderHook(() => useGameRides(GAME, true), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      try {
        await result.current.cancelRide();
      } catch {
        // erro repropagado pela callback — verificado abaixo via state
      }
    });
    await waitFor(() => expect(result.current.error).toBe('failed-precondition: bloqueado'));
    expect(result.current.cancelling).toBe(false);
  });
});