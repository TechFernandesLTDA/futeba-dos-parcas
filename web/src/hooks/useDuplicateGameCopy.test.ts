// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

const mockGetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => {
  // MockTimestamp com classe real para exercitar o instanceof em
  // utils/firestoreHelpers (snakeToCamel preserva timestamps com toDate()).
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
    doc: (...args: any[]) => mockDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    collection: (...args: any[]) => mockCollection(...args),
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

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let mockAuthReturn: any = {
  firebaseUser: { uid: 'test-user-id', displayName: 'Renan', photoURL: null },
  user: { id: 'test-user-id', name: 'Renan', photoUrl: null },
  loading: false, error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

const mockQueryClient = { invalidateQueries: vi.fn() };

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useDuplicateGameCopy } from './useDuplicateGameCopy';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function rawGame(overrides: Record<string, unknown> = {}) {
  return {
    location_id: 'loc-1',
    location_name: 'Quadra Centro',
    location_address: 'Rua A, 123',
    field_id: 'field-1',
    field_name: 'Campo 1',
    date: '2026-01-10',
    time: '19:00',
    end_time: '21:00',
    field_type: 'SOCIETY',
    max_players: 10,
    max_goalkeepers: 2,
    number_of_teams: 2,
    total_cost: 100,
    price_manual_override: true,
    daily_price: 12,
    pix_payment_enabled: true,
    pix_key: 'pix-key-1',
    pix_key_type: 'CPF',
    pix_beneficiary_name: 'Beneficiário',
    rules: 'SemHardware',
    visibility: 'PUBLIC_OPEN',
    recurrence: 'none',
    group_id: 'group-1',
    group_name: 'Grupo X',
    stream_url: 'https://stream.example',
    location_lat: -23.55,
    location_lng: -46.63,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    id: 'game-1',
    data: () => rawGame(),
  });
  mockAddDoc.mockResolvedValue({ id: 'new-game-id' });
  mockAuthReturn = {
    firebaseUser: { uid: 'test-user-id', displayName: 'Renan', photoURL: null },
    user: { id: 'test-user-id', name: 'Renan', photoUrl: null },
    loading: false, error: null,
  };
});

describe('useDuplicateGameCopy', () => {
  it('não autenticado: retorna null, mostra erro de auth e não consulta Firestore', async () => {
    mockAuthReturn = { firebaseUser: null, user: null, loading: false, error: null };
    const { result } = renderHook(() => useDuplicateGameCopy());
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.duplicateGame('game-1');
    });
    expect(returned).toBeNull();
    expect(mockShowError).toHaveBeenCalledWith('feedback.auth.notAuthenticated');
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('usa user.id como fallback de uid quando firebaseUser é null', async () => {
    mockAuthReturn = {
      firebaseUser: null,
      user: { id: 'fallback-uid', name: 'Renan', photoUrl: null },
      loading: false, error: null,
    };
    const { result } = renderHook(() => useDuplicateGameCopy());
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.duplicateGame('game-1');
    });
    expect(returned).toBe('new-game-id');
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.owner_id).toBe('fallback-uid');
    expect(payload.owner_name).toBe('Renan');
  });

  it('jogo inexistente: retorna null, mostra notFound e não cria documento', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, id: 'game-1', data: () => ({}) });
    const { result } = renderHook(() => useDuplicateGameCopy());
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.duplicateGame('game-1');
    });
    expect(returned).toBeNull();
    expect(mockShowError).toHaveBeenCalledWith('feedback.games.notFound');
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('fluxo feliz: cria a cópia, invalida queries e retorna o novo id', async () => {
    const { result } = renderHook(() => useDuplicateGameCopy());
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.duplicateGame('game-1');
    });
    expect(returned).toBe('new-game-id');
    expect(mockShowSuccess).toHaveBeenCalledWith('feedback.duplicateGame.success');
    expect(mockShowError).not.toHaveBeenCalled();

    expect(mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'games/game-1' }));
    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'games');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['games'], exact: false });
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['public-games'], exact: false });
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['nextGame'] });
  });

  it('payload da cópia: campos resets, owner e timestamp', async () => {
    const { result } = renderHook(() => useDuplicateGameCopy());
    await act(async () => {
      await result.current.duplicateGame('game-1');
    });
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;

    // Copiado do jogo de origem
    expect(payload.location_id).toBe('loc-1');
    expect(payload.location_name).toBe('Quadra Centro');
    expect(payload.field_id).toBe('field-1');
    expect(payload.field_type).toBe('SOCIETY');
    expect(payload.max_players).toBe(10);
    expect(payload.max_goalkeepers).toBe(2);
    expect(payload.total_cost).toBe(100);
    expect(payload.price_manual_override).toBe(true);
    expect(payload.visibility).toBe('PUBLIC_OPEN');
    expect(payload.group_id).toBe('group-1');
    expect(payload.stream_url).toBe('https://stream.example');
    expect(payload.location_lat).toBe(-23.55);
    expect(payload.location_lng).toBe(-46.63);

    // Resetado na cópia
    expect(payload.recurrence).toBe('none');
    expect(payload.team1_name).toBe('Time 1');
    expect(payload.team2_name).toBe('Time 2');
    expect(payload.confirmation_deadline_hours).toBe(0);
    expect(payload.require_checkin).toBe(false);
    expect(payload.checkin_radius_meters).toBe(100);
    expect(payload.status).toBe('SCHEDULED');
    expect(payload.players_count).toBe(0);
    expect(payload.goalkeepers_count).toBe(0);
    expect(payload.players).toEqual([]);
    expect(payload.team1_score).toBe(0);
    expect(payload.team2_score).toBe(0);
    expect(payload.co_organizers).toEqual([]);

    expect(payload.owner_id).toBe('test-user-id');
    expect(payload.owner_name).toBe('Renan');
    expect(payload.created_at).toBe(SERVER_TIMESTAMP);
    expect(payload.updated_at).toBe(SERVER_TIMESTAMP);

    // is_public derivado da visibility
    expect(payload.is_public).toBe(true);

    // dateTime = data recorrente + hora original (recurrence 'none' avança 7 dias)
    const dateTime = (payload.dateTime as any as { toDate(): Date }).toDate();
    expect(dateTime.getFullYear()).toBe(2026);
    expect(dateTime.getMonth()).toBe(0); // janeiro
    expect(dateTime.getDate()).toBe(17); // 10 + 7 dias
    expect(dateTime.getHours()).toBe(19);
    expect(dateTime.getMinutes()).toBe(0);
  });

  it('preço: com override usa daily_price; sem override calcula total_cost/max_players', async () => {
    const { result } = renderHook(() => useDuplicateGameCopy());
    await act(async () => {
      await result.current.duplicateGame('game-1');
    });
    const withOverride = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(withOverride.daily_price).toBe(12);
    expect(withOverride.price_manual_override).toBe(true);

    mockAddDoc.mockClear();
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'game-2',
      data: () => rawGame({ total_cost: 90, max_players: 12, price_manual_override: false, daily_price: 50 }),
    });
    await act(async () => {
      await result.current.duplicateGame('game-2');
    });
    const calculated = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(calculated.daily_price).toBe(7.5);
    expect(calculated.price_manual_override).toBe(false);
  });

  it('duração: usa durationMinutes existente; senão calcula de time/end_time', async () => {
    const { result } = renderHook(() => useDuplicateGameCopy());
    await act(async () => {
      await result.current.duplicateGame('game-1');
    });
    expect((mockAddDoc.mock.calls[0][1] as Record<string, unknown>).duration_minutes).toBe(120);

    mockAddDoc.mockClear();
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'game-2',
      data: () => rawGame({ duration_minutes: 90 }),
    });
    await act(async () => {
      await result.current.duplicateGame('game-2');
    });
    expect((mockAddDoc.mock.calls[0][1] as Record<string, unknown>).duration_minutes).toBe(90);
  });

  it('sem time: usa 19:00 como horário padrão e duração default de 60 min', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'game-1',
      data: () => rawGame({ time: undefined, end_time: undefined }),
    });
    const { result } = renderHook(() => useDuplicateGameCopy());
    await act(async () => {
      await result.current.duplicateGame('game-1');
    });
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.time).toBeUndefined();
    expect(payload.end_time).toBeNull();
    expect(payload.duration_minutes).toBe(60);
    const dateTime = (payload.dateTime as any as { toDate(): Date }).toDate();
    expect(dateTime.getHours()).toBe(19);
  });

  it('jogo sem date: não lança e grava date vazio', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'game-1',
      data: () => rawGame({ date: undefined }),
    });
    const { result } = renderHook(() => useDuplicateGameCopy());
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.duplicateGame('game-1');
    });
    expect(returned).toBe('new-game-id');
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.date).toBe('');
  });

  it('recurrence semanal avança 7 dias; mensal avança 1 mês', async () => {
    const { result } = renderHook(() => useDuplicateGameCopy());

    mockGetDoc.mockResolvedValue({
      exists: () => true, id: 'game-w',
      data: () => rawGame({ recurrence: 'weekly', date: '2026-01-10' }),
    });
    await act(async () => {
      await result.current.duplicateGame('game-w');
    });
    const weekly = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(weekly.date).toBe('2026-01-17');

    mockAddDoc.mockClear();
    mockGetDoc.mockResolvedValue({
      exists: () => true, id: 'game-m',
      data: () => rawGame({ recurrence: 'monthly', date: '2026-01-10' }),
    });
    await act(async () => {
      await result.current.duplicateGame('game-m');
    });
    const monthly = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(monthly.date).toBe('2026-02-10');
  });

  it('omitem location_lat/lng quando ausentes na origem', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true, id: 'game-1',
      data: () => rawGame({ location_lat: 0, location_lng: undefined }),
    });
    const { result } = renderHook(() => useDuplicateGameCopy());
    await act(async () => {
      await result.current.duplicateGame('game-1');
    });
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect('location_lat' in payload).toBe(false);
    expect('location_lng' in payload).toBe(false);
  });

  it('owner_name cai para Organizador quando não há displayName nem name', async () => {
    mockAuthReturn = {
      firebaseUser: { uid: 'test-user-id', displayName: null, photoURL: null },
      user: { id: 'test-user-id', name: null, photoUrl: null },
      loading: false, error: null,
    };
    const { result } = renderHook(() => useDuplicateGameCopy());
    await act(async () => {
      await result.current.duplicateGame('game-1');
    });
    expect((mockAddDoc.mock.calls[0][1] as Record<string, unknown>).owner_name).toBe('Organizador');
  });

  it('loading oscila true durante a operação e false ao final', async () => {
    const { result } = renderHook(() => useDuplicateGameCopy());
    let promise!: Promise<string | null>;
    act(() => {
      promise = result.current.duplicateGame('game-1');
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await promise;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('erro no addDoc: expõe message, mostra toast, retorna null e desliga loading', async () => {
    mockAddDoc.mockRejectedValue(new Error('Quota exceeded'));
    const { result } = renderHook(() => useDuplicateGameCopy());
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.duplicateGame('game-1');
    });
    expect(returned).toBeNull();
    expect(result.current.error).toBe('Quota exceeded');
    expect(result.current.loading).toBe(false);
    expect(mockShowError).toHaveBeenCalledWith('Quota exceeded');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('não invalida queries quando falha antes de criar', async () => {
    mockGetDoc.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useDuplicateGameCopy());
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.duplicateGame('game-1');
    });
    expect(returned).toBeNull();
    expect(result.current.error).toBe('network down');
    expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});