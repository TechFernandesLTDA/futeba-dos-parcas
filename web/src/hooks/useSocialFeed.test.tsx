// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockSubmitContentReport = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({
    kind: 'collection',
    path: parts.filter((p) => typeof p === 'string').join('/'),
  })),
  collectionGroup: vi.fn((_db: unknown, name: string) => ({ kind: 'collectionGroup', name })),
  doc: vi.fn((_db: unknown, ...parts: string[]) => ({
    path: parts.filter((p) => typeof p === 'string').join('/'),
  })),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ kind: 'query', source: base, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field: string, direction: string) => ({ type: 'orderBy', field, direction })),
  limit: vi.fn((value: number) => ({ type: 'limit', value })),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('../services/cloudFunctions', () => ({
  submitContentReport: (...args: any[]) => mockSubmitContentReport(...args),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

let mockAuthReturn: any = {
  currentUser: { uid: 'test-user-id' },
  firebaseUser: { uid: 'test-user-id' },
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

let mockUseGroupsReturn: any = {
  groups: [],
  loading: false,
  error: null,
  refetch: vi.fn(async () => {}),
};

vi.mock('./useGroups', () => ({
  useGroups: () => mockUseGroupsReturn,
}));

// mapPost mockado: converte o doc cru para um WallPost mínimo.
vi.mock('./useGroupWall', () => ({
  mapPost: (docSnap: any) => {
    const raw = docSnap.data();
    return {
      id: docSnap.id,
      groupId: raw.group_id,
      authorId: raw.author_id ?? 'author-1',
      authorName: raw.author_name ?? 'Jogador',
      authorPhotoUrl: null,
      text: raw.text ?? '',
      mediaUrl: null,
      mediaPath: null,
      mediaType: null,
      thumbnailPath: null,
      highlightRef: null,
      pinned: false,
      pinnedBy: null,
      createdAt: raw.created_at ?? undefined,
      updatedAt: undefined,
      editedAt: undefined,
      deletedBy: null,
      deletedAt: raw.deleted_at ?? null,
      reactions: null,
      commentsCount: 0,
    };
  },
}));

import { useSocialFeed } from './useSocialFeed';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wallPostDoc(
  id: string,
  opts: {
    groupId: string;
    createdAt?: Date;
    deletedAt?: Date | null;
    text?: string;
  },
) {
  return {
    id,
    data: () => ({
      group_id: opts.groupId,
      text: opts.text ?? `post ${id}`,
      created_at: opts.createdAt ?? new Date('2026-01-01T00:00:00Z'),
      deleted_at: opts.deletedAt ?? null,
    }),
  };
}

function makeGroups(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `group-${i + 1}`,
    name: `Grupo ${i + 1}`,
  }));
}

// Estado dos docs mockados, configurado por teste.
let hiddenDocIds: string[];
let postsByChunk: Map<string, any[]>;
let errorChunkKeys: string[];
let chunkError: Error | null;

beforeEach(() => {
  vi.clearAllMocks();
  hiddenDocIds = [];
  postsByChunk = new Map();
  errorChunkKeys = [];
  chunkError = null;
  mockGetDocs.mockImplementation(async (q: any) => {
    if (q?.kind === 'collection' && q.path.endsWith('hidden_feed_posts')) {
      return { docs: hiddenDocIds.map((id) => ({ id, data: () => ({}) })) };
    }
    if (q?.kind === 'query' && q.source?.kind === 'collectionGroup') {
      const whereConstraint = (q.constraints ?? []).find((c: any) => c?.type === 'where');
      const key = JSON.stringify(whereConstraint?.value);
      if (errorChunkKeys.includes(key)) throw chunkError;
      return { docs: postsByChunk.get(key) ?? [] };
    }
    return { docs: [] };
  });
  mockSetDoc.mockResolvedValue(undefined);
  mockSubmitContentReport.mockResolvedValue({ data: {} });
  mockAuthReturn = {
    currentUser: { uid: 'test-user-id' },
    firebaseUser: { uid: 'test-user-id' },
    loading: false,
    error: null,
  };
  mockUseGroupsReturn = {
    groups: makeGroups(2),
    loading: false,
    error: null,
    refetch: vi.fn(async () => {}),
  };
});

describe('useSocialFeed — consulta do feed', () => {
  it('sem usuário autenticado: nada é consultado e o feed fica vazio', async () => {
    mockAuthReturn = { currentUser: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toEqual([]);
    expect(result.current.hasGroups).toBe(true); // grupos vêm do useGroups mockado
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('sem grupos: hasGroups=false e nenhuma consulta de posts', async () => {
    mockUseGroupsReturn = { groups: [], loading: false, error: null, refetch: vi.fn() };
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasGroups).toBe(false);
    expect(result.current.posts).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('combina posts dos chunks, anexa groupName e ordena por created_at desc', async () => {
    // 2 grupos → 1 chunk ['group-1','group-2'] (a chave é o chunk inteiro)
    postsByChunk.set(JSON.stringify(['group-1', 'group-2']), [
      wallPostDoc('p-old', { groupId: 'group-1', createdAt: new Date('2026-01-01T10:00:00Z') }),
      wallPostDoc('p-new', { groupId: 'group-2', createdAt: new Date('2026-01-02T10:00:00Z') }),
    ]);

    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    expect(result.current.posts.map((p) => p.id)).toEqual(['p-new', 'p-old']);
    expect(result.current.posts[0].groupName).toBe('Grupo 2');
    expect(result.current.posts[1].groupName).toBe('Grupo 1');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('chunka grupos em páginas de 10 (11 grupos → 2 consultas)', async () => {
    mockUseGroupsReturn = { groups: makeGroups(11), loading: false, error: null, refetch: vi.fn() };
    postsByChunk.set(JSON.stringify(makeGroups(10).map((g) => g.id)), [
      wallPostDoc('p-1', { groupId: 'group-1' }),
    ]);
    postsByChunk.set(JSON.stringify(['group-11']), [
      wallPostDoc('p-11', { groupId: 'group-11' }),
    ]);

    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(2));

    const chunkQueries = mockGetDocs.mock.calls
      .map((call) => call[0] as any)
      .filter((q) => q?.kind === 'query');
    expect(chunkQueries).toHaveLength(2);
    expect(chunkQueries[0].constraints.find((c: any) => c.type === 'where').value).toHaveLength(10);
    expect(chunkQueries[1].constraints.find((c: any) => c.type === 'where').value).toEqual(['group-11']);
    // pageSize e orderBy presentes
    expect(chunkQueries[0].constraints.some((c: any) => c.type === 'limit')).toBe(true);
    expect(chunkQueries[0].constraints.some((c: any) => c.type === 'orderBy')).toBe(true);
    expect(result.current.posts.find((p) => p.id === 'p-11')?.groupName).toBe('Grupo 11');
  });

  it('filtra posts deletados (deletedAt) e posts ocultos pelo usuário', async () => {
    hiddenDocIds = ['group-1_hidden-key'];
    postsByChunk.set(JSON.stringify(['group-1', 'group-2']), [
      wallPostDoc('p-ok', { groupId: 'group-1', createdAt: new Date('2026-01-03T00:00:00Z') }),
      wallPostDoc('hidden-key', { groupId: 'group-1', createdAt: new Date('2026-01-02T00:00:00Z') }),
      wallPostDoc('p-deleted', {
        groupId: 'group-1',
        createdAt: new Date('2026-01-04T00:00:00Z'),
        deletedAt: new Date('2026-01-05T00:00:00Z'),
      }),
    ]);

    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    expect(result.current.posts[0].id).toBe('p-ok');
  });

  it('groupName desconhecido ou vazio cai para "Grupo"', async () => {
    mockUseGroupsReturn = {
      groups: [{ id: 'group-1', name: '' }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    };
    postsByChunk.set(JSON.stringify(['group-1']), [
      wallPostDoc('p-1', { groupId: 'group-1' }),
      wallPostDoc('p-ghost', { groupId: 'group-desconhecido' }),
    ]);

    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(2));
    for (const post of result.current.posts) {
      expect(post.groupName).toBe('Grupo');
    }
  });

  it('limita o feed a 30 posts (FEED_PAGE_SIZE)', async () => {
    const many = Array.from({ length: 35 }, (_, i) =>
      wallPostDoc(`p-${i}`, { groupId: 'group-1', createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)) }));
    postsByChunk.set(JSON.stringify(['group-1', 'group-2']), many);

    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(30));
    // os 30 mais recentes
    expect(result.current.posts[0].id).toBe('p-34');
    expect(result.current.posts[29].id).toBe('p-5');
  });

  it('falha parcial: chunk com erro é descartado, os outros aparecem e não há erro exposto', async () => {
    mockUseGroupsReturn = { groups: makeGroups(11), loading: false, error: null, refetch: vi.fn() };
    chunkError = new Error('chunk quebrou');
    errorChunkKeys = [JSON.stringify(makeGroups(10).map((g) => g.id))]; // só o 1º chunk falha
    postsByChunk.set(JSON.stringify(['group-11']), [
      wallPostDoc('p-11', { groupId: 'group-11', createdAt: new Date('2026-01-02T00:00:00Z') }),
    ]);

    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    expect(result.current.posts[0].id).toBe('p-11');
    expect(result.current.error).toBeNull();
  });

  it('todos os chunks falham e nenhum post: propaga o erro do primeiro chunk', async () => {
    chunkError = new Error('permission-denied no feed');
    errorChunkKeys = [JSON.stringify(['group-1', 'group-2'])];
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('permission-denied no feed'));
    expect(result.current.posts).toEqual([]);
  });

  it('posts ocultos são consultados na subcoleção users/{uid}/hidden_feed_posts', async () => {
    postsByChunk.set(JSON.stringify(['group-1', 'group-2']), [wallPostDoc('p-1', { groupId: 'group-1' })]);
    renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
    const collectionCalls = mockGetDocs.mock.calls
      .map((call) => call[0] as any)
      .filter((q) => q?.kind === 'collection');
    expect(collectionCalls).toHaveLength(1);
    expect(collectionCalls[0].path).toBe('users/test-user-id/hidden_feed_posts');
  });
});

describe('useSocialFeed — estado agregado', () => {
  it('loading combina groupsLoading || postsLoading', async () => {
    mockUseGroupsReturn = { groups: makeGroups(1), loading: true, error: null, refetch: vi.fn() };
    const { result, rerender } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    expect(result.current.loading).toBe(true);

    postsByChunk.set(JSON.stringify(['group-1']), [wallPostDoc('p-1', { groupId: 'group-1' })]);
    mockUseGroupsReturn = { groups: makeGroups(1), loading: false, error: null, refetch: vi.fn() };
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(1);
  });

  it('erro do useGroups é exposto antes do erro dos posts', async () => {
    mockUseGroupsReturn = { groups: [], loading: false, error: 'sem grupos', refetch: vi.fn() };
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('sem grupos'));
  });

  it('refetch refaz o fetch de grupos e de posts', async () => {
    const refetchGroups = vi.fn(async () => {});
    mockUseGroupsReturn = { groups: makeGroups(1), loading: false, error: null, refetch: refetchGroups };
    postsByChunk.set(JSON.stringify(['group-1']), [wallPostDoc('p-1', { groupId: 'group-1' })]);

    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    const callsBefore = mockGetDocs.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });
    expect(refetchGroups).toHaveBeenCalled();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('useSocialFeed — hidePost / reportPost', () => {
  function postFixture() {
    return {
      id: 'post-1',
      groupId: 'group-1',
      authorId: 'author-1',
      authorName: 'Autor',
      authorPhotoUrl: null,
      text: 'conteúdo',
      mediaUrl: null,
      mediaPath: null,
      mediaType: null,
      thumbnailPath: null,
      highlightRef: null,
      pinned: false,
      pinnedBy: null,
      deletedBy: null,
      deletedAt: null,
      reactions: null,
      commentsCount: 0,
    } as any;
  }

  it('hidePost grava doc de ocultamento com post_key e target_path e refaz o fetch', async () => {
    postsByChunk.set(JSON.stringify(['group-1', 'group-2']), [wallPostDoc('post-1', { groupId: 'group-1' })]);
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    mockSetDoc.mockClear();

    await act(async () => {
      await result.current.hidePost(postFixture());
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, payload] = mockSetDoc.mock.calls[0];
    expect(docRef.path).toBe('users/test-user-id/hidden_feed_posts/group-1_post-1');
    expect(payload).toMatchObject({
      user_id: 'test-user-id',
      group_id: 'group-1',
      post_id: 'post-1',
      post_key: 'group-1_post-1',
      target_path: 'groups/group-1/wall_posts/post-1',
    });
    expect(payload.hidden_at).toEqual({ __serverTimestamp: true });
  });

  it('hidePost sem autenticação: lança "Usuário não autenticado" e não grava', async () => {
    mockAuthReturn = { currentUser: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await expect(act(async () => {
      await result.current.hidePost(postFixture());
    })).rejects.toThrow('Usuário não autenticado');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('reportPost envia denúncia com targetType, ids e reason fixos', async () => {
    postsByChunk.set(JSON.stringify(['group-1', 'group-2']), [wallPostDoc('post-1', { groupId: 'group-1' })]);
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    await act(async () => {
      await result.current.reportPost(postFixture());
    });

    expect(mockSubmitContentReport).toHaveBeenCalledWith({
      targetType: 'group_wall_post',
      groupId: 'group-1',
      postId: 'post-1',
      reason: 'inappropriate_content',
    });
  });

  it('reportPost sem autenticação: lança e não chama a Cloud Function', async () => {
    mockAuthReturn = { currentUser: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await expect(act(async () => {
      await result.current.reportPost(postFixture());
    })).rejects.toThrow('Usuário não autenticado');
    expect(mockSubmitContentReport).not.toHaveBeenCalled();
  });

  it('hidePost propaga erro do setDoc', async () => {
    postsByChunk.set(JSON.stringify(['group-1', 'group-2']), [wallPostDoc('post-1', { groupId: 'group-1' })]);
    const { result } = renderHook(() => useSocialFeed(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    mockSetDoc.mockRejectedValue(new Error('quota'));

    await expect(act(async () => {
      await result.current.hidePost(postFixture());
    })).rejects.toThrow('quota');
  });
});
