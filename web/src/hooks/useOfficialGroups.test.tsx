// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

// t ESTÁVEL: mockT ignora opções de interpolação e devolve a chave.
const mockT = (key: string) => key;

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field: string, direction?: string) => ({ type: 'orderBy', field, direction })),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  writeBatch: vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit })),
  serverTimestamp: vi.fn(() => SERVER_TIMESTAMP),
  // Classe com toDate() real para parseOfficialGroup (created_at).
  Timestamp: class TimestampMock {
    ms: number;
    constructor(ms: number) {
      this.ms = ms;
    }
    toDate(): Date {
      return new Date(this.ms);
    }
    toMillis(): number {
      return this.ms;
    }
    static fromDate(d: Date) {
      return new TimestampMock(d.getTime());
    }
    static fromMillis(ms: number) {
      return new TimestampMock(ms);
    }
    static now() {
      return new TimestampMock(Date.now());
    }
  },
  // services/firebase.ts precisa existir no mock. #2330
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

let mockAuthReturn: any = {
  user: { id: 'u-1', name: 'Test User' },
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: any) => `fb:${err?.code ?? err?.message ?? 'unknown'}`,
}));

import { useOfficialGroups, useIsInOfficialGroup, useJoinOfficialGroup } from './useOfficialGroups';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function officialDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      category: 'LIGAS',
      name: `Oficial ${id}`,
      member_count: 42,
      is_public: true,
      created_at: { toDate: () => new Date('2026-01-15T08:00:00') },
      ...overrides,
    }),
  };
}

const OFFICIAL_GROUP = {
  id: 'og-1',
  name: 'Oficial og-1',
  description: 'Descrição',
  memberCount: 42,
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDocs.mockResolvedValue({ docs: [] as any[] });
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  mockSetDoc.mockResolvedValue(undefined);
  mockBatchSet.mockReturnValue(undefined);
  mockBatchCommit.mockResolvedValue(undefined);
  mockAuthReturn = { user: { id: 'u-1', name: 'Test User' } };
});

describe('useOfficialGroups', () => {
  it('consulta official-groups ordenado por category e name', () => {
    renderHook(() => useOfficialGroups(), { wrapper: wrapperFor(makeQueryClient()) });
    expect(mockCollection).toHaveBeenCalledWith({}, 'official-groups');
    expect(mockGetDocs).toHaveBeenCalled();
  });

  it('mapeia docs snake_case para camelCase com id e created_at como Date', async () => {
    mockGetDocs.mockResolvedValue({ docs: [officialDoc('og-1'), officialDoc('og-2')] });
    const { result } = renderHook(() => useOfficialGroups(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    const first = result.current.data![0] as any;
    expect(first.id).toBe('og-1');
    expect(first.memberCount).toBe(42);
    expect(first.name).toBe('Oficial og-1');
    expect(first.createdAt).toBeInstanceOf(Date);
    // new Date('2026-01-15T08:00:00') é interpretado no fuso local (UTC-3 no host)
    expect(first.createdAt.toISOString()).toBe(new Date('2026-01-15T08:00:00').toISOString());
  });

  it('createdAt cai para Date atual quando created_at está ausente', async () => {
    mockGetDocs.mockResolvedValue({ docs: [officialDoc('og-1', { created_at: undefined })] });
    const { result } = renderHook(() => useOfficialGroups(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect((result.current.data![0] as any).createdAt).toBeInstanceOf(Date);
  });

  it('desabilitado sem usuário: não consulta', () => {
    mockAuthReturn = { user: null };
    renderHook(() => useOfficialGroups(), { wrapper: wrapperFor(makeQueryClient()) });
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('erro do fetch: expõe error do useQuery e data undefined (retry:false)', async () => {
    mockGetDocs.mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(() => useOfficialGroups(), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });
});

describe('useIsInOfficialGroup', () => {
  it('retorna true quando o usuário já está no grupo', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ id: 'og-1' }] });
    const { result } = renderHook(() => useIsInOfficialGroup('og-1'), {
      wrapper: wrapperFor(makeQueryClient()),
    });
    await waitFor(() => expect(result.current.data).toBe(true));
  });

  it('retorna false quando não há membership', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    const { result } = renderHook(() => useIsInOfficialGroup('og-1'), {
      wrapper: wrapperFor(makeQueryClient()),
    });
    await waitFor(() => expect(result.current.data).toBe(false));
  });

  it('desabilitado sem groupId: não consulta', () => {
    renderHook(() => useIsInOfficialGroup(undefined), { wrapper: wrapperFor(makeQueryClient()) });
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('consulta users/{uid}/groups filtrando por group_id', () => {
    renderHook(() => useIsInOfficialGroup('og-1'), { wrapper: wrapperFor(makeQueryClient()) });
    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'u-1', 'groups');
  });
});

describe('useJoinOfficialGroup', () => {
  it('grupo inexistente: cria grupo ANTES do batch e depois membro + user-group', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    const client = makeQueryClient();
    const { result } = renderHook(() => useJoinOfficialGroup(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current.mutateAsync(OFFICIAL_GROUP);
    });

    // Criação do grupo em write separado, antes do batch (regras leem pré-batch)
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][0].path).toBe('groups/og-1');
    expect(mockSetDoc.mock.calls[0][1]).toMatchObject({
      name: 'Oficial og-1',
      description: 'Descrição',
      is_public: true,
      status: 'ACTIVE',
      owner_id: 'u-1',
      admin_ids: ['u-1'],
      created_at: SERVER_TIMESTAMP,
      updated_at: SERVER_TIMESTAMP,
    });
    expect(mockBatchCommit.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockSetDoc.mock.invocationCallOrder[0],
    );

    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    const payloads = mockBatchSet.mock.calls.map(([, payload]) => payload as Record<string, unknown>);
    expect(payloads[0]).toMatchObject({
      user_id: 'u-1',
      user_name: 'Test User',
      role: 'MEMBER',
      total_games: 0,
      level: 0,
      status: 'ACTIVE',
      joined_at: SERVER_TIMESTAMP,
    });
    expect(payloads[1]).toMatchObject({
      group_id: 'og-1',
      group_name: 'Oficial og-1',
      role: 'MEMBER',
      member_count: 42,
      joined_at: SERVER_TIMESTAMP,
    });
  });

  it('grupo já existente: NÃO recria o grupo (só o batch de membro/user-group)', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Oficial og-1' }) });
    const client = makeQueryClient();
    const { result } = renderHook(() => useJoinOfficialGroup(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current.mutateAsync(OFFICIAL_GROUP);
    });
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('onSuccess: toast de sucesso e invalidação das 3 queries', async () => {
    const client = makeQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useJoinOfficialGroup(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current.mutateAsync(OFFICIAL_GROUP);
    });
    expect(mockShowSuccess).toHaveBeenCalledWith('feedback.officialGroups.joinSuccess');
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as any).queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ['official-groups'],
        ['groups', 'u-1'],
        ['official-group-member', 'u-1', 'og-1'],
      ]),
    );
  });

  it('sem login: mutation falha com loginRequired e onError mostra toast', async () => {
    mockAuthReturn = { user: null };
    const { result } = renderHook(() => useJoinOfficialGroup(), { wrapper: wrapperFor(makeQueryClient()) });
    await expect(
      act(async () => {
        await result.current.mutateAsync(OFFICIAL_GROUP);
      }),
    ).rejects.toThrow('feedback.officialGroups.loginRequired');
    expect(mockShowError).toHaveBeenCalledWith('fb:feedback.officialGroups.loginRequired');
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('commit falhando: onError mostra toast e não mostra sucesso', async () => {
    mockBatchCommit.mockRejectedValue(
      Object.assign(new Error('failed-precondition'), { code: 'failed-precondition' }),
    );
    const client = makeQueryClient();
    const { result } = renderHook(() => useJoinOfficialGroup(), { wrapper: wrapperFor(client) });
    await expect(
      act(async () => {
        await result.current.mutateAsync(OFFICIAL_GROUP);
      }),
    ).rejects.toThrow('failed-precondition');
    expect(mockShowError).toHaveBeenCalledWith('fb:failed-precondition');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
