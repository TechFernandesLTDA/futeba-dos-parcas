// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';
// Importado APÓS o vi.mock: resolve para o MockTimestamp definido na factory,
// garantindo que instanceof Timestamp em utils/firestoreHelpers funcione.
import { Timestamp } from 'firebase/firestore';

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

// t ESTÁVEL: hooks com useCallback([t]) entram em loop infinito se t mudar por render.
// USADO pela factory hoisted do vi.mock abaixo — eslint não enxerga a referência.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockT = (key: string) => key;

const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();

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
    limit: vi.fn((...args: any[]) => args),
    startAfter: vi.fn((...args: any[]) => args),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
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
  currentUser: { uid: 'test-user-id' },
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

import { useGameChat, useSendGameMessage, useDeleteGameMessage } from './useGameChat';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function messageDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      sender_id: 'sender-1',
      sender_name: 'Sender One',
      sender_photo_url: null,
      text: `mensagem ${id}`,
      created_at: Timestamp.fromMillis(1700000000000),
      deleted_by: null,
      deleted_at: null,
      ...overrides,
    }),
  };
}

function makeSnapshot(docs: any[], size = docs.length) {
  return { docs, size };
}

const CHAT_PATH = ['games', 'game-1', 'chat'];
void CHAT_PATH;

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockQuery.mockImplementation((...args: unknown[]) => args);
  mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
    onNext(makeSnapshot([]));
    return vi.fn();
  });
  mockGetDocs.mockResolvedValue(makeSnapshot([]));
  mockAddDoc.mockResolvedValue({ id: 'msg-new' });
  mockUpdateDoc.mockResolvedValue(undefined);
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
    currentUser: { uid: 'test-user-id' },
  };
});

describe('useGameChat', () => {
  it('retorna estado vazio e loading=false quando gameId é undefined', async () => {
    const { result } = renderHook(() => useGameChat(undefined), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('escuta a subcoleção games/{gameId}/chat', () => {
    renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'games', 'game-1', 'chat');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('mapeia mensagens em ordem cronológica (reverse do snapshot desc)', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([messageDoc('m3'), messageDoc('m2'), messageDoc('m1')]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(result.current.messages[0]).toMatchObject({
      senderId: 'sender-1',
      senderName: 'Sender One',
      senderPhotoUrl: null,
      text: 'mensagem m1',
      deletedBy: null,
      deletedAt: null,
    });
    expect(result.current.messages[0].createdAt).toBeInstanceOf(Date);
  });

  it('usa fallbacks quando campos faltam (senderName "Jogador", deletedAt null)', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([messageDoc('m1', { sender_name: undefined, sender_photo_url: undefined })]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages[0].senderName).toBe('Jogador');
    expect(result.current.messages[0].senderPhotoUrl).toBeNull();
    expect(result.current.messages[0].deletedAt).toBeNull();
  });

  it('define hasMore=true quando o snapshot atinge o tamanho da página (50)', async () => {
    const docs = Array.from({ length: 50 }, (_, i) => messageDoc(`m${i}`));
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot(docs));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.messages).toHaveLength(50);
  });

  it('deduplica mensagens entre snapshots consecutivos (mergeRealtimePageById)', async () => {
    mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
      onNext(makeSnapshot([messageDoc('m1'), messageDoc('m2')]));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(2);
    // Segunda emissão com os mesmos ids não duplica nem perde mensagens.
    const onNext = mockOnSnapshot.mock.calls[0][1] as (snap: any) => void;
    await act(async () => {
      onNext(makeSnapshot([messageDoc('m2'), messageDoc('m1')]));
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('trata erros do snapshot via getFirestoreErrorMessage', async () => {
    mockOnSnapshot.mockImplementation((_q: any, _onNext: any, onError: any) => {
      onError(new Error('Permission denied'));
      return vi.fn();
    });
    const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Permission denied');
  });

  it('remove o listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  describe('loadMore', () => {
    function renderWithFullPage() {
      // Snapshot chega em ordem desc (padrão do orderBy desc) — o hook reverte.
      const docs = Array.from({ length: 50 }, (_, i) => messageDoc(`old-${String(49 - i).padStart(2, '0')}`));
      mockOnSnapshot.mockImplementation((_q: any, onNext: any) => {
        onNext(makeSnapshot(docs));
        return vi.fn();
      });
      return renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
    }

    it('precede mensagens antigas e atualiza hasMore', async () => {
      // getDocs retorna em ordem desc (igual ao Firestore) — o hook reverte.
      mockGetDocs.mockResolvedValue(makeSnapshot([messageDoc('older-2'), messageDoc('older-1')]));
      const { result } = renderWithFullPage();
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.loadMore();
      });
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
      expect(result.current.messages.map((m) => m.id)).toEqual(['older-1', 'older-2', ...Array.from({ length: 50 }, (_, i) => `old-${String(i).padStart(2, '0')}`)]);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.loadingMore).toBe(false);
    });

    it('não busca quando hasMore=false', async () => {
      const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.loadMore();
      });
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('não busca em paralelo (loadingMore guard) enquanto a anterior está em voo', async () => {
      // getDocs nunca resolve: mantém loadingMore=true no render.
      mockGetDocs.mockImplementation(() => new Promise(() => {}));
      const { result } = renderWithFullPage();
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        result.current.loadMore();
      });
      await waitFor(() => expect(result.current.loadingMore).toBe(true));
      const callsAfterFirst = mockGetDocs.mock.calls.length;
      // Closure re-renderizada com loadingMore=true deve ignorar a chamada.
      await act(async () => {
        await result.current.loadMore();
      });
      expect(mockGetDocs.mock.calls.length).toBe(callsAfterFirst);
    });

    it('define erro quando a paginação falha', async () => {
      mockGetDocs.mockRejectedValue(new Error('unavailable: offline'));
      const { result } = renderWithFullPage();
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.loadMore();
      });
      expect(result.current.error).toBe('unavailable: offline');
      expect(result.current.loadingMore).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('lança "Jogo não encontrado." sem gameId', async () => {
      const { result } = renderHook(() => useGameChat(undefined), { wrapper: createTestWrapper() });
      await expect(act(async () => { await result.current.sendMessage('oi'); }))
        .rejects.toThrow('Jogo não encontrado.');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('rejeita mensagem vazia (só espaços) e acima de 500 caracteres', async () => {
      const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
      await expect(act(async () => { await result.current.sendMessage('   '); }))
        .rejects.toThrow('A mensagem deve ter entre 1 e 500 caracteres.');
      await expect(act(async () => { await result.current.sendMessage('a'.repeat(501)); }))
        .rejects.toThrow('A mensagem deve ter entre 1 e 500 caracteres.');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('grava payload snake_case com texto trimado e metadados do usuário', async () => {
      const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
      await act(async () => {
        await result.current.sendMessage('  Olá, pelada!  ');
      });
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const [collRef, payload] = mockAddDoc.mock.calls[0] as any[];
      expect(collRef.path).toBe('games/game-1/chat');
      expect(payload).toMatchObject({
        sender_id: 'test-user-id',
        sender_name: 'Test User',
        sender_photo_url: null,
        text: 'Olá, pelada!',
        deleted_by: null,
        deleted_at: null,
      });
      expect(payload.created_at).toBe(SERVER_TIMESTAMP);
    });

    it('usa fallbacks: user.name ausente → currentUser.displayName → "Jogador"', async () => {
      mockAuthReturn = {
        user: { id: 'test-user-id', name: '', photoUrl: undefined },
        firebaseUser: { uid: 'test-user-id', displayName: '', photoURL: null },
        loading: false, error: null,
        currentUser: { uid: 'test-user-id', photoURL: 'https://photo.example/u.png' },
      };
      const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
      await act(async () => {
        await result.current.sendMessage('oi');
      });
      const payload = mockAddDoc.mock.calls[0][1] as any;
      expect(payload.sender_name).toBe('Jogador');
      expect(payload.sender_photo_url).toBe('https://photo.example/u.png');
    });
  });

  describe('deleteMessage', () => {
    it('marca deleted_by/deleted_at no doc da mensagem', async () => {
      const { result } = renderHook(() => useGameChat('game-1'), { wrapper: createTestWrapper() });
      await act(async () => {
        await result.current.deleteMessage('msg-9');
      });
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const [docRef, payload] = mockUpdateDoc.mock.calls[0] as any[];
      expect(docRef.path).toBe('games/game-1/chat/msg-9');
      expect(payload.deleted_by).toBe('test-user-id');
      expect(payload.deleted_at).toBe(SERVER_TIMESTAMP);
    });

    it('lança "Jogo não encontrado." sem gameId', async () => {
      const { result } = renderHook(() => useGameChat(undefined), { wrapper: createTestWrapper() });
      await expect(act(async () => { await result.current.deleteMessage('msg-9'); }))
        .rejects.toThrow('Jogo não encontrado.');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });
});

describe('useSendGameMessage', () => {
  it('mostra toast de sucesso e reseta sending após envio', async () => {
    const { result } = renderHook(() => useSendGameMessage('game-1'), { wrapper: createTestWrapper() });
    expect(result.current.sending).toBe(false);
    await act(async () => {
      await result.current.send('bora jogar');
    });
    expect(mockAddDoc).toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalledWith('Mensagem enviada.');
    expect(result.current.sending).toBe(false);
  });

  it('mostra toast de erro e repropaga a exceção', async () => {
    const { result } = renderHook(() => useSendGameMessage('game-1'), { wrapper: createTestWrapper() });
    await expect(act(async () => { await result.current.send(''); }))
      .rejects.toThrow('A mensagem deve ter entre 1 e 500 caracteres.');
    expect(mockShowError).toHaveBeenCalledWith('A mensagem deve ter entre 1 e 500 caracteres.');
    expect(result.current.sending).toBe(false);
  });
});

describe('useDeleteGameMessage', () => {
  it('reseta deleting após exclusão bem-sucedida', async () => {
    const { result } = renderHook(() => useDeleteGameMessage('game-1'), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.remove('msg-1');
    });
    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(result.current.deleting).toBe(false);
  });

  it('mostra toast de erro e repropaga a exceção', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('not-found: mensagem sumiu'));
    const { result } = renderHook(() => useDeleteGameMessage('game-1'), { wrapper: createTestWrapper() });
    await expect(act(async () => { await result.current.remove('msg-1'); }))
      .rejects.toThrow('not-found: mensagem sumiu');
    expect(mockShowError).toHaveBeenCalledWith('not-found: mensagem sumiu');
    expect(result.current.deleting).toBe(false);
  });
});