import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockOnSnapshot = vi.fn();
const mockWhere = vi.fn((...parts: unknown[]) => ({ where: parts }));
const mockUnsubscribe = vi.fn();
const mockStartAfter = vi.fn((cursor: unknown) => ({ cursor }));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn((...parts: unknown[]) => ({ type: 'collection', parts })),
  doc: vi.fn((...parts: unknown[]) => ({ type: 'doc', parts })),
  documentId: vi.fn(() => '__name__'),
  getDocs: (reference: unknown) => mockGetDocs(reference),
  limit: vi.fn((value: number) => ({ limit: value })),
  onSnapshot: (reference: unknown, next: unknown, error: unknown) => mockOnSnapshot(reference, next, error),
  orderBy: vi.fn((field: string, direction?: string) => ({ field, direction })),
  query: vi.fn((...parts: unknown[]) => ({ type: 'query', parts })),
  serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
  startAfter: (cursor: unknown) => mockStartAfter(cursor),
  updateDoc: vi.fn(),
  where: (field: unknown, operator: unknown, value: unknown) => mockWhere(field, operator, value),
}));

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'user-1' }, user: { name: 'Jogador' } }),
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import {
  COMMENT_PARENT_QUERY_CHUNK_SIZE,
  getMissingCommentParentIds,
  mergeGameCommentsById,
  type GameComment,
  useGameComments,
} from './useGameComments';

function commentDoc(id: string, parentId: string | null = null, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      author_id: `author-${id}`,
      author_name: `Autor ${id}`,
      author_photo_url: null,
      text: `Comentário ${id}`,
      parent_id: parentId,
      created_at: new Date(2026, 6, 13),
      edited_at: null,
      deleted_at: null,
      deleted_by: null,
      reactions: {},
      context: 'game',
      ...overrides,
    }),
  };
}

function snapshot(docs: ReturnType<typeof commentDoc>[]) {
  return { docs, size: docs.length };
}

function emitSnapshot(docs: ReturnType<typeof commentDoc>[]) {
  const next = mockOnSnapshot.mock.calls.at(-1)?.[1] as (value: ReturnType<typeof snapshot>) => Promise<void>;
  return next(snapshot(docs));
}

describe('useGameComments parent hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);
    mockGetDocs.mockResolvedValue(snapshot([]));
  });

  it('carrega o pai fora da página e mantém a resposta recente', async () => {
    mockGetDocs.mockResolvedValueOnce(snapshot([commentDoc('parent-old')]));
    const { result } = renderHook(() => useGameComments('game-1'));

    await act(async () => emitSnapshot([commentDoc('reply-new', 'parent-old')]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['parent-old', 'reply-new']);
    expect(result.current.hasMore).toBe(false);
    expect(mockWhere).toHaveBeenCalledWith('__name__', 'in', ['parent-old']);
  });

  it('deduplica IDs de pai e divide consultas em chunks de no máximo 10', async () => {
    const replies = Array.from({ length: COMMENT_PARENT_QUERY_CHUNK_SIZE + 2 }, (_, index) =>
      commentDoc(`reply-${index}`, `parent-${index}`));
    replies.push(commentDoc('reply-duplicate', 'parent-0'));
    const { result } = renderHook(() => useGameComments('game-1'));

    await act(async () => emitSnapshot(replies));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const queriedChunks = mockWhere.mock.calls.map((call) => call[2] as string[]);
    expect(queriedChunks).toHaveLength(2);
    expect(queriedChunks.map((chunk) => chunk.length)).toEqual([10, 2]);
    expect(new Set(queriedChunks.flat()).size).toBe(12);
    expect(result.current.comments).toHaveLength(13);
  });

  it('ordena pais hidratados pela primeira reply mesmo se o Firestore responder fora de ordem', async () => {
    mockGetDocs.mockResolvedValueOnce(snapshot([
      commentDoc('parent-2'),
      commentDoc('parent-1'),
    ]));
    const { result } = renderHook(() => useGameComments('game-1'));

    await act(async () => emitSnapshot([
      commentDoc('reply-2', 'parent-2'),
      commentDoc('reply-1', 'parent-1'),
    ]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments.map((comment) => comment.id)).toEqual([
      'parent-1',
      'parent-2',
      'reply-1',
      'reply-2',
    ]);
  });

  it('expõe erro quando a hidratação dos pais falha', async () => {
    mockGetDocs.mockRejectedValueOnce({ code: 'permission-denied' });
    const { result } = renderHook(() => useGameComments('game-1'));

    await act(async () => emitSnapshot([commentDoc('reply', 'parent')]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.comments).toEqual([]);
  });

  it('mantém a reply quando o pai realmente não existe', async () => {
    const { result } = renderHook(() => useGameComments('game-1'));

    await act(async () => emitSnapshot([commentDoc('reply', 'missing-parent')]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.comments.map((comment) => comment.id)).toEqual(['reply']);
  });

  it('hidrata pais na paginação sem mover o cursor nem duplicar comentários', async () => {
    const recentDocs = Array.from({ length: 30 }, (_, index) => commentDoc(`recent-${index}`));
    const paginatedReply = commentDoc('older-reply', 'oldest-parent');
    mockGetDocs
      .mockResolvedValueOnce(snapshot([paginatedReply]))
      .mockResolvedValueOnce(snapshot([commentDoc('oldest-parent')]));
    const { result } = renderHook(() => useGameComments('game-1'));
    await act(async () => emitSnapshot(recentDocs));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    await act(async () => result.current.loadMore());

    expect(mockStartAfter).toHaveBeenCalledWith(recentDocs[recentDocs.length - 1]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.comments).toHaveLength(32);
    expect(new Set(result.current.comments.map((comment) => comment.id)).size).toBe(32);
    expect(result.current.comments.slice(0, 2).map((comment) => comment.id)).toEqual([
      'oldest-parent',
      'older-reply',
    ]);
  });

  it('ignora uma hidratação concluída depois do cleanup', async () => {
    let resolveParents: ((value: ReturnType<typeof snapshot>) => void) | undefined;
    mockGetDocs.mockReturnValueOnce(new Promise((resolve) => { resolveParents = resolve; }));
    const { result, unmount } = renderHook(() => useGameComments('game-1'));

    let pending: Promise<void> | undefined;
    act(() => { pending = emitSnapshot([commentDoc('reply', 'parent')]); });
    unmount();
    resolveParents?.(snapshot([commentDoc('parent')]));
    await pending;

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
    expect(result.current.comments).toEqual([]);
  });
});

describe('game comment parent helpers', () => {
  const baseComment = (id: string, parentId: string | null): GameComment => ({
    id,
    authorId: 'author',
    authorName: 'Autor',
    authorPhotoUrl: null,
    text: id,
    parentId,
    editedAt: null,
    deletedAt: null,
    deletedBy: null,
    reactions: {},
    context: 'game',
  });

  it('não consulta pais já conhecidos e deduplica referências repetidas', () => {
    expect(getMissingCommentParentIds([
      baseComment('reply-1', 'parent-1'),
      baseComment('reply-2', 'parent-1'),
      baseComment('reply-3', 'parent-2'),
    ], ['parent-2'])).toEqual(['parent-1']);
  });

  it('mescla por ID sem duplicar e deixa a versão mais recente vencer', () => {
    const old = baseComment('same', null);
    const updated = { ...old, text: 'atualizado' };
    expect(mergeGameCommentsById([old], [updated])).toEqual([updated]);
  });
});
