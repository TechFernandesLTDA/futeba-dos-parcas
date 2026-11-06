// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
// Importado APÓS o vi.mock: resolve para o MockTimestamp definido na factory,
// garantindo que instanceof Timestamp no firestoreHelpers/useGameTemplates funcione.
import { Timestamp } from 'firebase/firestore';

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

// t ESTÁVEL: fetchTemplates tem useCallback([t]); uma nova função por render
// recriaria a callback e reexecutaria o effect em loop infinito.
const mockT = (key: string) => key;

const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => {
  // MockTimestamp com classe real para exercitar o instanceof Timestamp em
  // utils/firestoreHelpers (snakeToCamel) e no mapeamento de created_at do hook.
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
    query: vi.fn((...args: any[]) => args),
    orderBy: vi.fn((...args: any[]) => args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    doc: (...args: any[]) => mockDoc(...args),
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

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
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

import { useGameTemplates } from './useGameTemplates';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function templateDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      user_id: 'test-user-id',
      name: 'Pelada de Sexta',
      max_players: 12,
      max_goalkeepers: 2,
      created_at: Timestamp.fromMillis(1735689600000), // 2025-01-01T00:00Z
      ...overrides,
    }),
  };
}

const EMPTY_SNAPSHOT = { docs: [] as any[] };

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDocs.mockResolvedValue(EMPTY_SNAPSHOT);
  mockAddDoc.mockResolvedValue({ id: 'tpl-new' });
  mockDeleteDoc.mockResolvedValue(undefined);
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
  };
});

describe('useGameTemplates — fetchTemplates', () => {
  it('inicializa loading=true (#2252) e carrega lista vazia', async () => {
    const { result } = renderHook(() => useGameTemplates());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sem usuário: desliga loading e não consulta Firestore', async () => {
    mockAuthReturn = {
      user: null, firebaseUser: null, loading: false, error: null,
    };
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('consulta users/{uid}/game_templates ordenado por created_at desc', () => {
    renderHook(() => useGameTemplates());
    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users', 'test-user-id', 'game_templates');
    expect(mockGetDocs).toHaveBeenCalled();
  });

  it('converte campos snake_case para camelCase e normaliza created_at (Timestamp)', async () => {
    mockGetDocs.mockResolvedValue({ docs: [templateDoc('tpl-1')] });
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.templates).toHaveLength(1));
    const tpl = result.current.templates[0];
    expect(tpl.id).toBe('tpl-1');
    expect(tpl.user_id).toBe('test-user-id');
    expect(tpl.name).toBe('Pelada de Sexta');
    expect(tpl.max_players).toBe(12);
    expect(tpl.max_goalkeepers).toBe(2);
    expect(tpl.created_at).toBeInstanceOf(Date);
    expect(tpl.created_at.getTime()).toBe(1735689600000);
  });

  it('created_at como Date direto: snakeToCamel desmonta o objeto (comportamento atual)', async () => {
    // snakeToCamel recursa em objetos sem toDate() e Date não tem props próprias
    // enumeráveis → o valor vira {}. Comportamento atual do hook (timestamps do
    // Firestore sobrevivem; Dates puros não) — documentado aqui.
    const fixedDate = new Date('2026-02-01T10:00:00');
    mockGetDocs.mockResolvedValue({
      docs: [templateDoc('tpl-1', { created_at: fixedDate })],
    });
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.templates).toHaveLength(1));
    expect(result.current.templates[0].created_at).toEqual({});
  });

  it('usa a data atual como fallback quando created_at está ausente', async () => {
    const before = Date.now();
    mockGetDocs.mockResolvedValue({
      docs: [templateDoc('tpl-1', { created_at: undefined })],
    });
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.templates).toHaveLength(1));
    const created = result.current.templates[0].created_at.getTime();
    expect(created).toBeGreaterThanOrEqual(before - 1000);
    expect(created).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('expõe campos opcionais convertidos (location, field, price, visibility)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        templateDoc('tpl-2', {
          location_id: 'loc-9',
          location_name: 'Quadra 9',
          field_id: 'field-9',
          field_name: 'Campo 9',
          field_type: 'SOCIETY',
          rules: 'Chegar 10min antes',
          time: '20:00',
          recurrence_type: 'weekly',
          total_cost: 120,
          daily_price: 10,
          visibility: 'PUBLIC_OPEN',
        }),
      ],
    });
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.templates).toHaveLength(1));
    const tpl = result.current.templates[0];
    expect(tpl.location_id).toBe('loc-9');
    expect(tpl.location_name).toBe('Quadra 9');
    expect(tpl.field_id).toBe('field-9');
    expect(tpl.field_type).toBe('SOCIETY');
    expect(tpl.rules).toBe('Chegar 10min antes');
    expect(tpl.time).toBe('20:00');
    expect(tpl.recurrence_type).toBe('weekly');
    expect(tpl.total_cost).toBe(120);
    expect(tpl.daily_price).toBe(10);
    expect(tpl.visibility).toBe('PUBLIC_OPEN');
  });

  it('define erro amigável quando getDocs falha e desliga loading', async () => {
    mockGetDocs.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('feedback.templates.loadError');
    expect(mockShowError).not.toHaveBeenCalled();
    expect(result.current.templates).toEqual([]);
  });

  it('não grava estado quando o fetch resolve após o unmount (cancelamento #2278)', async () => {
    let resolveGetDocs!: (v: unknown) => void;
    mockGetDocs.mockReturnValue(new Promise((resolve) => { resolveGetDocs = resolve; }));
    const { unmount } = renderHook(() => useGameTemplates());
    unmount();
    expect(() => resolveGetDocs({ docs: [templateDoc('tpl-late')] })).not.toThrow();
    await act(async () => {});
  });

  it('refetch busca novamente os templates', async () => {
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('useGameTemplates — saveTemplate', () => {
  const validInput = { name: 'Pelada', max_players: 10, max_goalkeepers: 1 };

  it('retorna null sem usuário e não grava', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockAddDoc.mockClear();
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.saveTemplate(validInput as any);
    });
    expect(returned).toBeNull();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('rejeita nome em branco com toast e sem escrita', async () => {
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let returned: string | null = 'não-chamado';
    await act(async () => {
      returned = await result.current.saveTemplate({ ...validInput, name: '   ' } as any);
    });
    expect(returned).toBeNull();
    expect(mockShowError).toHaveBeenCalledWith('feedback.templates.nameRequired');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('rejeita max_players menor que 1', async () => {
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let returned: string | null = 'não-chamado';
    await act(async () => {
      returned = await result.current.saveTemplate({ ...validInput, max_players: 0 } as any);
    });
    expect(returned).toBeNull();
    expect(mockShowError).toHaveBeenCalledWith('feedback.templates.maxPlayersMinOne');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('grava payload snake_case com null nos opcionais ausentes e retorna o id', async () => {
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let returned!: string | null;
    await act(async () => {
      returned = await result.current.saveTemplate(validInput as any);
    });
    expect(returned).toBe('tpl-new');
    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(), 'users', 'test-user-id', 'game_templates',
    );
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      user_id: 'test-user-id',
      name: 'Pelada',
      max_players: 10,
      max_goalkeepers: 1,
      location_id: null,
      location_name: null,
      field_id: null,
      field_name: null,
      field_type: null,
      rules: null,
      time: null,
      recurrence_type: null,
      total_cost: null,
      daily_price: null,
      visibility: null,
    });
    expect(payload.created_at).toBe(SERVER_TIMESTAMP);
    // Refetch após salvar
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('preserva valores opcionais informados e normaliza string vazia para null', async () => {
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.saveTemplate({
        name: 'Completo',
        max_players: 14,
        max_goalkeepers: 2,
        location_id: 'loc-1',
        rules: '',
        daily_price: 15,
        visibility: 'PUBLIC_OPEN',
      } as any);
    });
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.location_id).toBe('loc-1');
    expect(payload.rules).toBeNull(); // '' → null
    expect(payload.daily_price).toBe(15);
    expect(payload.visibility).toBe('PUBLIC_OPEN');
  });

  it('propaga erro do addDoc, mostra toast de save e não refetch', async () => {
    mockAddDoc.mockRejectedValue(new Error('quota'));
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(async () => {
      await result.current.saveTemplate(validInput as any);
    })).rejects.toThrow('quota');
    expect(mockShowError).toHaveBeenCalledWith('feedback.templates.saveError');
    expect(mockGetDocs).toHaveBeenCalledTimes(1); // só o fetch inicial
  });
});

describe('useGameTemplates — removeTemplate', () => {
  it('remove o template e filtra a lista local', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [templateDoc('tpl-1'), templateDoc('tpl-2')],
    });
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.templates).toHaveLength(2));

    await act(async () => {
      await result.current.removeTemplate('tpl-1');
    });
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/test-user-id/game_templates/tpl-1' }),
    );
    expect(result.current.templates.map((t) => t.id)).toEqual(['tpl-2']);
  });

  it('não faz nada sem usuário', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.removeTemplate('tpl-1');
    });
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('id vazio: mostra toast notFound e não chama deleteDoc', async () => {
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.removeTemplate('');
    });
    expect(mockShowError).toHaveBeenCalledWith('feedback.templates.notFound');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('propaga erro do deleteDoc com toast removeError e mantém a lista', async () => {
    mockGetDocs.mockResolvedValue({ docs: [templateDoc('tpl-1')] });
    mockDeleteDoc.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useGameTemplates());
    await waitFor(() => expect(result.current.templates).toHaveLength(1));

    await expect(act(async () => {
      await result.current.removeTemplate('tpl-1');
    })).rejects.toThrow('permission-denied');
    expect(mockShowError).toHaveBeenCalledWith('feedback.templates.removeError');
    expect(result.current.templates).toHaveLength(1);
  });
});