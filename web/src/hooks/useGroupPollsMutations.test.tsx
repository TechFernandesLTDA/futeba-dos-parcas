// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
// Cobertura das MUTAÇÕES de enquetes (useCreateGroupPoll / useVoteGroupPoll).
// A parte realtime (useGroupPolls) já tem suíte dedicada em useGroupPolls.test.tsx.
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';

const mockAddDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: any[]) => mockAddDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  Timestamp: class TimestampMock {},
}));

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../services/cloudFunctions', () => ({ getCallable: vi.fn(() => vi.fn()) }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: mockShowSuccess, showWarning: vi.fn(), showInfo: vi.fn() }),
}));

let mockAuthReturn: any = {
  currentUser: { uid: 'uid-1', displayName: 'Display User' },
  user: { id: 'uid-1', name: 'Nome Perfil' },
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (error: unknown) => `mapped:${(error as { code?: string })?.code ?? 'unknown'}`,
}));

import { useCreateGroupPoll, useVoteGroupPoll } from './useGroupPolls';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.invalidateQueries = mockInvalidate as unknown as typeof client.invalidateQueries;
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddDoc.mockResolvedValue({ id: 'poll-new' });
  mockSetDoc.mockResolvedValue(undefined);
  mockAuthReturn = {
    currentUser: { uid: 'uid-1', displayName: 'Display User' },
    user: { id: 'uid-1', name: 'Nome Perfil' },
    loading: false,
    error: null,
  };
});

describe('useCreateGroupPoll', () => {
  it('cria enquete com payload completo: trim, opções saneadas, created_by e serverTimestamp', async () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(client) });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ question: '  Quem joga sexta?  ', options: [' Sim ', 'Não', '', '  '] });
      } catch (error) {
        thrown = error;
      }
    });
    expect(thrown).toBeUndefined();

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [collectionArg, payload] = mockAddDoc.mock.calls[0];
    expect((collectionArg as { path: string }).path).toBe('group_polls');
    expect(payload.group_id).toBe('g-1');
    expect(payload.question).toBe('Quem joga sexta?');
    expect(payload.options).toEqual([
      { id: 'option_1', text: 'Sim' },
      { id: 'option_2', text: 'Não' },
    ]);
    expect(payload.created_by).toBe('uid-1');
    expect(payload.created_by_name).toBe('Nome Perfil');
    expect(payload.status).toBe('ACTIVE');
    expect(payload.created_at).toEqual({ __serverTimestamp: true });
    expect(payload.updated_at).toEqual({ __serverTimestamp: true });

    expect(mockShowSuccess).toHaveBeenCalledWith('Enquete criada.');
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['group-polls', 'g-1'] });
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('fallback do nome: user.name ausente → displayName; ambos ausentes → Jogador', async () => {
    mockAuthReturn = {
      currentUser: { uid: 'uid-1', displayName: 'Display User' },
      user: { id: 'uid-1' },
      loading: false, error: null,
    };
    const client = makeQueryClient();
    const { result } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(client) });
    await act(async () => { await result.current.mutateAsync({ question: 'Pergunta ok?', options: ['A', 'B'] }); });
    expect(mockAddDoc.mock.calls[0][1].created_by_name).toBe('Display User');

    mockAuthReturn = {
      currentUser: { uid: 'uid-1', displayName: '' },
      user: null,
      loading: false, error: null,
    };
    const client2 = makeQueryClient();
    const { result: result2 } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(client2) });
    await act(async () => { await result2.current.mutateAsync({ question: 'Pergunta ok?', options: ['A', 'B'] }); });
    expect(mockAddDoc.mock.calls[1][1].created_by_name).toBe('Jogador');
  });

  it('trunca o texto da opção em 60 caracteres e numera option_1..N preservando ordem', async () => {
    const longText = 'x'.repeat(80);
    const { result } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    await act(async () => { await result.current.mutateAsync({ question: 'Pergunta?', options: [longText, 'B'] }); });

    const options = mockAddDoc.mock.calls[0][1].options;
    expect(options[0].text).toBe('x'.repeat(60));
    expect(options[0].id).toBe('option_1');
    expect(options[1].id).toBe('option_2');
  });

  it.each([
    [{ question: 'ab', options: ['A', 'B'] }, 'A pergunta deve ter entre 3 e 120 caracteres.'],
    [{ question: 'x'.repeat(121), options: ['A', 'B'] }, 'A pergunta deve ter entre 3 e 120 caracteres.'],
    [{ question: 'Pergunta válida', options: ['A'] }, 'Informe entre 2 e 5 opções.'],
    [{ question: 'Pergunta válida', options: ['1', '2', '3', '4', '5', '6'] }, 'Informe entre 2 e 5 opções.'],
    [{ question: '   ', options: ['A', 'B'] }, 'A pergunta deve ter entre 3 e 120 caracteres.'],
  ])('valida entrada e não grava: %j', async (vars, expectedError) => {
    const { result } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(makeQueryClient()) });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(vars as { question: string; options: string[] });
      } catch (error) {
        thrown = error;
      }
    });
    expect((thrown as Error).message).toBe(expectedError);
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith(expectedError);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('opções que viram vazias após trim contam como ausentes (< 2 reais)', async () => {
    const { result } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    let thrown: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ question: 'Pergunta válida', options: ['  ', 'A', ''] }); }
      catch (error) { thrown = error; }
    });
    expect((thrown as Error).message).toBe('Informe entre 2 e 5 opções.');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('sem grupo ou sem usuário: erro "Grupo não encontrado."', async () => {
    const { result } = renderHook(() => useCreateGroupPoll(), { wrapper: wrapperFor(makeQueryClient()) });
    let thrown: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ question: 'Pergunta válida', options: ['A', 'B'] }); }
      catch (error) { thrown = error; }
    });
    expect((thrown as Error).message).toBe('Grupo não encontrado.');
    expect(mockAddDoc).not.toHaveBeenCalled();

    mockAuthReturn = { currentUser: null, user: null, loading: false, error: null };
    const { result: result2 } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(makeQueryClient()) });
    let thrown2: unknown;
    await act(async () => {
      try { await result2.current.mutateAsync({ question: 'Pergunta válida', options: ['A', 'B'] }); }
      catch (error) { thrown2 = error; }
    });
    expect((thrown2 as Error).message).toBe('Grupo não encontrado.');
  });

  it('erro do Firestore (com code): exibe mensagem mapeada, não a raw', async () => {
    mockAddDoc.mockRejectedValue({ code: 'permission-denied' });
    const { result } = renderHook(() => useCreateGroupPoll('g-1'), { wrapper: wrapperFor(makeQueryClient()) });

    let thrown: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ question: 'Pergunta válida', options: ['A', 'B'] }); }
      catch (error) { thrown = error; }
    });
    expect(thrown).toEqual({ code: 'permission-denied' });
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('mapped:permission-denied'));
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});

describe('useVoteGroupPoll', () => {
  it('grava voto com id determinístico {pollId}_{uid} e payload snake_case', async () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useVoteGroupPoll('g-1'), { wrapper: wrapperFor(client) });

    await act(async () => { await result.current.mutateAsync({ pollId: 'poll-9', optionId: 'option_2' }); });

    const [docRef, payload] = mockSetDoc.mock.calls[0];
    expect((docRef as { path: string }).path).toBe('group_poll_votes/poll-9_uid-1');
    expect(payload).toEqual({
      poll_id: 'poll-9',
      group_id: 'g-1',
      option_id: 'option_2',
      user_id: 'uid-1',
      updated_at: { __serverTimestamp: true },
    });
    expect(mockShowSuccess).toHaveBeenCalledWith('Voto registrado.');
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['group-polls', 'g-1'] });
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('sem grupo: erro "Grupo não encontrado." e nenhum setDoc', async () => {
    const { result } = renderHook(() => useVoteGroupPoll(), { wrapper: wrapperFor(makeQueryClient()) });
    let thrown: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ pollId: 'poll-9', optionId: 'option_1' }); }
      catch (error) { thrown = error; }
    });
    expect((thrown as Error).message).toBe('Grupo não encontrado.');
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith('Grupo não encontrado.');
  });

  it('erro do Firestore no voto: mensagem mapeada e sem toast de sucesso', async () => {
    mockSetDoc.mockRejectedValue({ code: 'unavailable' });
    const { result } = renderHook(() => useVoteGroupPoll('g-1'), { wrapper: wrapperFor(makeQueryClient()) });

    await act(async () => {
      try { await result.current.mutateAsync({ pollId: 'poll-9', optionId: 'option_1' }); }
      catch { /* propagado */ }
    });
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('mapped:unavailable'));
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});