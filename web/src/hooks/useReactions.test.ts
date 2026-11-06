// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// t ESTÁVEL: toggleReaction tem useCallback([t]); t instável recriaria a
// callback a cada render e reexecutaria effects em loop infinito.
const mockT = (key: string) => key;

const mockDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockArrayUnion = vi.fn((...args: unknown[]) => ({ __op: 'arrayUnion', args }));
const mockArrayRemove = vi.fn((...args: unknown[]) => ({ __op: 'arrayRemove', args }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
  arrayRemove: (...args: any[]) => mockArrayRemove(...args),
  serverTimestamp: () => ({ __serverTimestamp: true }),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

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
  currentUser: { uid: 'test-user-id' },
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

import { useReactions } from './useReactions';
import type { ReactionsMap } from '../constants/reactions';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

const TARGET_PATH = 'games/game-1/chat/msg-1';

function initialReactions(): ReactionsMap {
  return { '🔥': ['other-1', 'test-user-id'], '😂': ['other-1'] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockUpdateDoc.mockResolvedValue(undefined);
  mockSetDoc.mockResolvedValue(undefined);
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
    currentUser: { uid: 'test-user-id' },
  };
});

describe('useReactions', () => {
  it('retorna currentUserId e pending=false inicialmente', () => {
    const initial = initialReactions();
    const { result } = renderHook(() => useReactions(TARGET_PATH, initial), { wrapper: createTestWrapper() });
    expect(result.current.currentUserId).toBe('test-user-id');
    expect(result.current.pending).toBe(false);
    expect(result.current.reactions).toEqual(initialReactions());
  });

  it('sincroniza optimisticReactions quando a prop reactions muda', async () => {
    const initial = initialReactions();
    const { result, rerender } = renderHook(
      ({ reactions }: { reactions: ReactionsMap | null }) => useReactions(TARGET_PATH, reactions),
      { initialProps: { reactions: initial as ReactionsMap | null }, wrapper: createTestWrapper() },
    );
    const next: ReactionsMap = { '👏': ['other-9'] };
    rerender({ reactions: next });
    await waitFor(() => expect(result.current.reactions).toEqual(next));
  });

  it('usa {} quando reactions é null', () => {
    const { result } = renderHook(() => useReactions(TARGET_PATH, null), { wrapper: createTestWrapper() });
    expect(result.current.reactions).toEqual({});
  });

  it('não faz nada sem usuário autenticado', async () => {
    mockAuthReturn = {
      user: null, firebaseUser: null, loading: false, error: null, currentUser: null,
    };
    const initial = initialReactions();
    const { result } = renderHook(() => useReactions(TARGET_PATH, initial), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.toggleReaction('🔥');
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it('adiciona nova reação: remove o uid de todas as chaves e faz arrayUnion na escolhida', async () => {
    // Usuário ainda sem reação (uid não está no mapa).
    const reactions: ReactionsMap = { '🔥': ['other-1'], '😂': ['other-1'] };
    const { result } = renderHook(() => useReactions(TARGET_PATH, reactions), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.toggleReaction('😂');
    });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [ref, updates] = mockUpdateDoc.mock.calls[0] as any[];
    expect(ref.path).toBe(TARGET_PATH);
    expect(updates['reactions.🔥'].__op).toBe('arrayRemove');
    expect(updates['reactions.😂'].__op).toBe('arrayUnion');
    // Otimista: uid entra em 😂 e não está em 🔥.
    expect(result.current.reactions['😂']).toContain('test-user-id');
    expect(result.current.reactions['🔥']).not.toContain('test-user-id');
    expect(result.current.pending).toBe(false);
  });

  it('troca de reação: uid sai da anterior e entra na nova', async () => {
    const initial = initialReactions();
    const { result } = renderHook(() => useReactions(TARGET_PATH, initial), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.toggleReaction('😂');
    });
    expect(result.current.reactions['🔥']).toEqual(['other-1']);
    expect(result.current.reactions['😂']).toEqual(['other-1', 'test-user-id']);
    // Última escrita de reactions.😂 vence (union sobrescreve o remove).
    const updates = mockUpdateDoc.mock.calls[0][1] as any;
    expect(updates['reactions.😂'].__op).toBe('arrayUnion');
  });

  it('desfaz a própria reação ao clicar no mesmo emoji (sem arrayUnion)', async () => {
    const initial = initialReactions();
    const { result } = renderHook(() => useReactions(TARGET_PATH, initial), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.toggleReaction('🔥');
    });
    const updates = mockUpdateDoc.mock.calls[0][1] as any;
    for (const key of Object.keys(updates)) {
      expect(updates[key].__op).toBe('arrayRemove');
    }
    expect(result.current.reactions['🔥']).toEqual(['other-1']);
    expect(result.current.reactions['🔥']).not.toContain('test-user-id');
  });

  it('usa updateDoc por padrão; setDoc+merge quando createData é fornecido', async () => {
    const initial = initialReactions();
    const createData = { group_id: 'group-1', user_id: 'test-user-id' };
    const { result } = renderHook(
      () => useReactions(TARGET_PATH, initial, { createData }),
      { wrapper: createTestWrapper() },
    );
    await act(async () => {
      await result.current.toggleReaction('👑');
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [ref, payload, opts] = mockSetDoc.mock.calls[0] as any[];
    expect(ref.path).toBe(TARGET_PATH);
    expect(opts).toEqual({ merge: true });
    expect(payload.group_id).toBe('group-1');
    expect(payload.user_id).toBe('test-user-id');
    expect(payload.reactions['👑'].__op).toBe('arrayUnion');
    expect(payload.reactions['🔥'].__op).toBe('arrayRemove');
    expect(payload.reactions['😂'].__op).toBe('arrayRemove');
    expect(payload.updated_at).toEqual({ __serverTimestamp: true });
  });

  it('respeita reactionField customizado nas chaves de update', async () => {
    const initial = initialReactions();
    const { result } = renderHook(
      () => useReactions(TARGET_PATH, initial, { reactionField: 'reactions_map' }),
      { wrapper: createTestWrapper() },
    );
    await act(async () => {
      await result.current.toggleReaction('😂');
    });
    const updates = mockUpdateDoc.mock.calls[0][1] as any;
    expect(Object.keys(updates).every((key) => key.startsWith('reactions_map.'))).toBe(true);
    expect(updates['reactions_map.😂'].__op).toBe('arrayUnion');
  });

  it('reverte reação otimista e mostra toast quando o update falha', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('permission-denied'));
    const initial = initialReactions();
    const { result } = renderHook(() => useReactions(TARGET_PATH, initial), { wrapper: createTestWrapper() });
    await act(async () => {
      await result.current.toggleReaction('😂');
    });
    expect(result.current.reactions).toEqual(initial);
    expect(result.current.reactions['🔥']).toContain('test-user-id');
    expect(mockShowError).toHaveBeenCalledWith('reactions.updateError');
    expect(result.current.pending).toBe(false);
  });

  it('não dispara segunda reação enquanto há uma pendente (guard de pending)', async () => {
    // updateDoc nunca resolve: pending fica true no render.
    mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
    const initial = initialReactions();
    const { result } = renderHook(() => useReactions(TARGET_PATH, initial), { wrapper: createTestWrapper() });
    await act(async () => {
      result.current.toggleReaction('🔥');
    });
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => {
      await result.current.toggleReaction('😂');
    });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });
});