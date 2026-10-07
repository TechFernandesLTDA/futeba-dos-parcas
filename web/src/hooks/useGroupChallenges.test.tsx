// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// t ESTÁVEL
const mockT = (key: string) => key;

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockWriteBatch = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    ms: number;
    constructor(ms: number) { this.ms = ms; }
    toDate(): Date { return new Date(this.ms); }
    toMillis(): number { return this.ms; }
    static fromDate(d: Date): MockTimestamp { return new MockTimestamp(d.getTime()); }
    static fromMillis(ms: number): MockTimestamp { return new MockTimestamp(ms); }
    static now(): MockTimestamp { return new MockTimestamp(Date.now()); }
  }
  return {
    collection: (...args: any[]) => mockCollection(...args),
    doc: (...args: any[]) => mockDoc(...args),
    query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
    orderBy: vi.fn((field: string, direction: string) => ({ type: 'orderBy', field, direction })),
    limit: vi.fn((value: number) => ({ type: 'limit', value })),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    addDoc: (...args: any[]) => mockAddDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    writeBatch: () => mockWriteBatch(),
    serverTimestamp: () => SERVER_TIMESTAMP,
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
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

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: unknown) => {
    const code = (err as { code?: string })?.code;
    if (code) return `ff:${code}`;
    return err instanceof Error ? err.message : 'ff:unknown';
  },
}));

import {
  useGroupChallenges,
  useChallengeGroup,
  useRespondChallenge,
  useUpdateChallengeProgress,
  type GroupChallenge,
} from './useGroupChallenges';
import { Timestamp } from 'firebase/firestore';

function makeDocRef(...segments: unknown[]) {
  // collection refs mockados são objetos { path } — doc(collection(...)) encadeia.
  const parts = segments
    .map((s) => (typeof s === 'string' ? s : ((s as any)?.path ?? '')))
    .filter(Boolean);
  const path = parts.join('/');
  return { id: parts[parts.length - 1] ?? '', path };
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

function challengeDoc(id: string, raw: Record<string, unknown>) {
  return { id, data: () => raw };
}

// Promise.all consome DOIS getDocs — dispatch pelo campo do where, nunca fila.
function dispatchByDirection(incomingRaw: any[], outgoingRaw: any[]) {
  mockGetDocs.mockImplementation(async (q: any) => {
    const w = (q?.constraints ?? []).find((c: any) => c?.type === 'where');
    if (w?.field === 'challenged_group_id') return { docs: incomingRaw };
    if (w?.field === 'challenger_group_id') return { docs: outgoingRaw };
    return { docs: [] };
  });
}

const VALID_CHALLENGE_INPUT = {
  challengerGroupId: 'g-a',
  challengerGroupName: 'Grupo A',
  challengedGroupId: 'g-b',
  challengedGroupName: 'Grupo B',
  goal: ' Vencer 3 jogos ',
  targetCount: 3.7,
  deadline: '2026-12-31',
};

function makeChallenge(overrides: Partial<GroupChallenge> = {}): GroupChallenge {
  return {
    id: 'ch-1',
    challengerGroupId: 'g-a',
    challengerGroupName: 'Grupo A',
    challengedGroupId: 'g-b',
    challengedGroupName: 'Grupo B',
    createdBy: 'creator-id',
    status: 'PENDING',
    goal: 'Vencer 5',
    targetCount: 5,
    currentProgress: 2,
    deadline: '2026-12-31',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function setupBatchMock() {
  mockBatchUpdate.mockClear();
  mockBatchSet.mockClear();
  mockBatchCommit.mockReset().mockResolvedValue(undefined);
  mockWriteBatch.mockImplementation(() => ({
    update: mockBatchUpdate,
    set: mockBatchSet,
    commit: mockBatchCommit,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockAddDoc.mockResolvedValue({ id: 'ch-new' });
  mockUpdateDoc.mockResolvedValue(undefined);
  setupBatchMock();
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
    loading: false, error: null,
  };
});

describe('useGroupChallenges — carga', () => {
  it('combina recebidos e enviados, deduplica por id e ordena por createdAt desc', async () => {
    dispatchByDirection(
      [
        challengeDoc('ch-1', {
          challenger_group_id: 'g-other', challenger_group_name: 'Rivais',
          challenged_group_id: 'g-1', challenged_group_name: 'Parças',
          created_by: 'someone', status: 'PENDING', goal: 'Mais gols',
          target_count: 3, current_progress: 1, deadline: '2026-06-01',
          created_at: Timestamp.fromMillis(2000),
        }),
        challengeDoc('ch-2', {
          challenger_group_id: 'g-1', challenged_group_id: 'g-other', status: 'ACCEPTED',
          created_at: Timestamp.fromMillis(1000),
        }),
      ],
      [
        // mesmo id do incoming — Map remove o duplicado
        challengeDoc('ch-2', {
          challenger_group_id: 'g-1', challenged_group_id: 'g-other', status: 'ACCEPTED',
          created_at: Timestamp.fromMillis(1000),
        }),
        challengeDoc('ch-3', {
          challenger_group_id: 'g-1', challenged_group_id: 'g-x', status: 'PENDING',
          created_at: Timestamp.fromMillis(3000),
        }),
      ],
    );

    const { result } = renderHook(() => useGroupChallenges('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.challenges).toHaveLength(3));

    expect(result.current.challenges.map((c) => c.id)).toEqual(['ch-3', 'ch-1', 'ch-2']);
    const first = result.current.challenges[0];
    expect(first.challengerGroupId).toBe('g-1');
    expect(first.targetCount).toBe(1); // default quando ausente
    expect(first.currentProgress).toBe(0);
  });

  it('parseChallenge: campos snake→camel, datas via toDate e fallback new Date(0)', async () => {
    dispatchByDirection(
      [
        challengeDoc('ch-full', {
          challenger_group_id: 'g-other', challenger_group_name: 'Rivais',
          challenged_group_id: 'g-1', challenged_group_name: 'Parças',
          created_by: 'someone', status: 'ACCEPTED', goal: 'Gol 5x',
          target_count: 5, current_progress: 4, deadline: '2026-08-01',
          proposed_date: '2026-07-20', game_id: 'game-9', responded_by: 'resp-1',
          completed_at: Timestamp.fromMillis(5000), created_at: Timestamp.fromMillis(6000),
        }),
      ],
      [],
    );

    const { result } = renderHook(() => useGroupChallenges('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.challenges).toHaveLength(1));

    const c = result.current.challenges[0];
    expect(c).toMatchObject({
      id: 'ch-full',
      challengerGroupId: 'g-other',
      challengerGroupName: 'Rivais',
      challengedGroupId: 'g-1',
      challengedGroupName: 'Parças',
      createdBy: 'someone',
      status: 'ACCEPTED',
      goal: 'Gol 5x',
      targetCount: 5,
      currentProgress: 4,
      deadline: '2026-08-01',
      proposedDate: '2026-07-20',
      gameId: 'game-9',
      respondedBy: 'resp-1',
    });
    expect(c.completedAt).toEqual(new Date(5000));
    expect(c.createdAt).toEqual(new Date(6000));
  });

  it('sem created_at: createdAt cai para epoch (new Date(0))', async () => {
    dispatchByDirection([challengeDoc('ch-epoch', { status: 'PENDING' })], []);
    const { result } = renderHook(() => useGroupChallenges('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.challenges).toHaveLength(1));
    expect(result.current.challenges[0].createdAt.getTime()).toBe(0);
    expect(result.current.challenges[0].completedAt).toBeUndefined();
  });

  it('sem groupId ou sem usuário: [] sem consultar Firestore', async () => {
    const none = renderHook(() => useGroupChallenges(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {});
    expect(none.result.current.challenges).toBeUndefined();
    expect(mockGetDocs).not.toHaveBeenCalled();
    none.unmount();

    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const noUser = renderHook(() => useGroupChallenges('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {});
    expect(noUser.result.current.challenges).toBeUndefined();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('expõe erro da query quando Promise.all rejeita', async () => {
    mockGetDocs.mockRejectedValue(new Error('quota-estourada'));
    const { result } = renderHook(() => useGroupChallenges('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await waitFor(() => expect(result.current.error).toBe('quota-estourada'));
    expect(result.current.challenges).toBeUndefined();
  });
});

describe('useChallengeGroup', () => {
  it('cria desafio com payload snake_case normalizado e invalida a lista', async () => {
    const client = makeQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useChallengeGroup(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync(VALID_CHALLENGE_INPUT);
    });

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'group-challenges');
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      challenger_group_id: 'g-a',
      challenger_group_name: 'Grupo A',
      challenged_group_id: 'g-b',
      challenged_group_name: 'Grupo B',
      created_by: 'test-user-id',
      status: 'PENDING',
      goal: 'Vencer 3 jogos', // trim
      target_count: 3, // floor de 3.7
      current_progress: 0,
      deadline: '2026-12-31',
      proposed_date: '',
    });
    expect(payload.created_at).toBe(SERVER_TIMESTAMP);
    expect(payload.updated_at).toBe(SERVER_TIMESTAMP);
    expect(mockShowSuccess).toHaveBeenCalledWith('feedback.challenges.sendSuccess');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['group-challenges'] }));
  });

  it('preserva proposedDate informado', async () => {
    const { result } = renderHook(() => useChallengeGroup(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, proposedDate: '2026-11-05' });
    });
    expect((mockAddDoc.mock.calls[0][1] as any).proposed_date).toBe('2026-11-05');
  });

  it('exige login', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useChallengeGroup(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await result.current.mutateAsync(VALID_CHALLENGE_INPUT); } catch (e) {
        expect((e as Error).message).toBe('feedback.officialGroups.loginRequired');
      }
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('rejeita grupos idênticos, ids ausentes e nomes em branco', async () => {
    const { result } = renderHook(() => useChallengeGroup(), { wrapper: wrapperFor(makeQueryClient()) });

    await act(async () => {
      try { await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, challengedGroupId: 'g-a' }); }
      catch (e) { expect((e as Error).message).toBe('challenges.validationSameGroup'); }
      try { await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, challengerGroupId: '' }); }
      catch (e) { expect((e as Error).message).toBe('Grupo não especificado.'); }
      try { await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, challengedGroupName: '   ' }); }
      catch (e) { expect((e as Error).message).toBe('O nome do grupo é obrigatório.'); }
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('rejeita goal em branco, targetCount inválido e deadline ausente', async () => {
    const { result } = renderHook(() => useChallengeGroup(), { wrapper: wrapperFor(makeQueryClient()) });

    await act(async () => {
      try { await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, goal: '  ' }); }
      catch (e) { expect((e as Error).message).toBe('challenges.validationGoal'); }
      try { await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, targetCount: 0 }); }
      catch (e) { expect((e as Error).message).toBe('challenges.validationTarget'); }
      try { await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, targetCount: NaN }); }
      catch (e) { expect((e as Error).message).toBe('challenges.validationTarget'); }
      try { await result.current.mutateAsync({ ...VALID_CHALLENGE_INPUT, deadline: '' }); }
      catch (e) { expect((e as Error).message).toBe('challenges.validationDeadline'); }
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('erro com code do Firestore vira mensagem mapeada', async () => {
    mockAddDoc.mockRejectedValue(Object.assign(new Error('negado'), { code: 'permission-denied' }));
    const { result } = renderHook(() => useChallengeGroup(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await result.current.mutateAsync(VALID_CHALLENGE_INPUT); } catch { /* esperado */ }
    });
    expect(mockShowError).toHaveBeenCalledWith('ff:permission-denied');
  });

  it('erro sem code (Error puro) mostra a própria mensagem', async () => {
    mockAddDoc.mockRejectedValue(new Error('mensageiro offline'));
    const { result } = renderHook(() => useChallengeGroup(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await result.current.mutateAsync(VALID_CHALLENGE_INPUT); } catch { /* esperado */ }
    });
    expect(mockShowError).toHaveBeenCalledWith('mensageiro offline');
  });
});

describe('useRespondChallenge', () => {
  it('aceita desafio: updateDoc com status, responded_at/by e toast de aceite', async () => {
    const client = makeQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRespondChallenge(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await result.current.mutateAsync({ challengeId: 'ch-1', status: 'ACCEPTED' });
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'group-challenges/ch-1' }),
      expect.objectContaining({
        status: 'ACCEPTED',
        responded_at: SERVER_TIMESTAMP,
        responded_by: 'test-user-id',
        updated_at: SERVER_TIMESTAMP,
      }),
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('Desafio aceito!');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['group-challenges'] }));
  });

  it('recusa desafio com toast específico', async () => {
    const { result } = renderHook(() => useRespondChallenge(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync({ challengeId: 'ch-1', status: 'DECLINED' });
    });
    expect(mockShowSuccess).toHaveBeenCalledWith('Desafio recusado.');
  });

  it('exige challengeId e login', async () => {
    const loggedIn = renderHook(() => useRespondChallenge(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await loggedIn.result.current.mutateAsync({ challengeId: '', status: 'ACCEPTED' }); }
      catch (e) { expect((e as Error).message).toBe('Desafio não encontrado.'); }
    });
    loggedIn.unmount();

    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const anonymous = renderHook(() => useRespondChallenge(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await anonymous.result.current.mutateAsync({ challengeId: 'ch-1', status: 'ACCEPTED' }); }
      catch (e) { expect((e as Error).message).toBe('Faça login para responder ao desafio.'); }
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('erro do Firestore vira toast mapeado', async () => {
    mockUpdateDoc.mockRejectedValue(Object.assign(new Error('x'), { code: 'unavailable' }));
    const { result } = renderHook(() => useRespondChallenge(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await result.current.mutateAsync({ challengeId: 'ch-1', status: 'ACCEPTED' }); } catch { /* esperado */ }
    });
    expect(mockShowError).toHaveBeenCalledWith('ff:unavailable');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});

describe('useUpdateChallengeProgress', () => {
  it('progresso parcial: atualiza current_progress, preserva status e não notifica', async () => {
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    let returned: { completed: boolean } | undefined;

    await act(async () => {
      returned = await result.current.mutateAsync({
        challenge: makeChallenge(),
        progress: 4,
      });
    });

    expect(returned).toEqual({ completed: false });
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'group-challenges/ch-1' }),
      expect.objectContaining({
        current_progress: 4,
        status: 'PENDING',
        updated_at: SERVER_TIMESTAMP,
      }),
    );
    const payload = mockBatchUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.completed_at).toBeUndefined();
    expect(payload.completed_by).toBeUndefined();
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockShowSuccess).toHaveBeenCalledWith('challenges.progressSuccess');
  });

  it('completa por quem não é o criador: FINISHED + notificação para o criador', async () => {
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    let returned: { completed: boolean } | undefined;

    await act(async () => {
      returned = await result.current.mutateAsync({ challenge: makeChallenge(), progress: 5 });
    });

    expect(returned).toEqual({ completed: true });
    const updatePayload = mockBatchUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(updatePayload.status).toBe('FINISHED');
    expect(updatePayload.completed_at).toBe(SERVER_TIMESTAMP);
    expect(updatePayload.completed_by).toBe('test-user-id');

    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications' }),
      expect.objectContaining({
        created_by: 'test-user-id',
        user_id: 'creator-id',
        type: 'SYSTEM',
        title: 'challenges.completedNotificationTitle',
        body: 'challenges.completedNotificationBody',
        read: false,
        reference_id: 'ch-1',
        reference_type: 'group_challenge',
        group_id: 'g-b',
        created_at: SERVER_TIMESTAMP,
      }),
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('challenges.completedSuccess');
  });

  it('completa e o criador respondeu: notificação vai para respondedBy', async () => {
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync({
        challenge: makeChallenge({ createdBy: 'test-user-id', respondedBy: 'responder-id' }),
        progress: 5,
      });
    });
    expect((mockBatchSet.mock.calls[0][1] as any).user_id).toBe('responder-id');
  });

  it('completa sem destinatário: sem notificação', async () => {
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync({
        challenge: makeChallenge({ createdBy: 'test-user-id', respondedBy: undefined }),
        progress: 5,
      });
    });
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalledWith('challenges.completedSuccess');
  });

  it('clamp: negativo satura em 0 e acima do alvo satura em targetCount (completa)', async () => {
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });

    await act(async () => {
      const r1 = await result.current.mutateAsync({ challenge: makeChallenge(), progress: -3 });
      expect(r1).toEqual({ completed: false });
      expect((mockBatchUpdate.mock.calls[0][1] as any).current_progress).toBe(0);

      const r2 = await result.current.mutateAsync({ challenge: makeChallenge(), progress: 99 });
      expect(r2).toEqual({ completed: true });
      expect((mockBatchUpdate.mock.calls[1][1] as any).current_progress).toBe(5);
    });
  });

  it('progresso fracionado é truncado (floor)', async () => {
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync({ challenge: makeChallenge(), progress: 2.9 });
    });
    expect((mockBatchUpdate.mock.calls[0][1] as any).current_progress).toBe(2);
  });

  it('targetCount inválido (0) normaliza o alvo para 1', async () => {
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      const r = await result.current.mutateAsync({
        challenge: makeChallenge({ targetCount: 0 }),
        progress: 1,
      });
      expect(r).toEqual({ completed: true });
    });
    const payload = mockBatchUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.current_progress).toBe(1);
    expect(payload.status).toBe('FINISHED');
  });

  it('exige login', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try {
        await result.current.mutateAsync({ challenge: makeChallenge(), progress: 1 });
      } catch (e) {
        expect((e as Error).message).toBe('feedback.officialGroups.loginRequired');
      }
    });
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('falha no commit exibe toast mapeado e não exibe sucesso', async () => {
    mockBatchCommit.mockRejectedValue(Object.assign(new Error('x'), { code: 'failed-precondition' }));
    const { result } = renderHook(() => useUpdateChallengeProgress(), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => {
      try { await result.current.mutateAsync({ challenge: makeChallenge(), progress: 1 }); } catch { /* esperado */ }
    });
    expect(mockShowError).toHaveBeenCalledWith('ff:failed-precondition');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
