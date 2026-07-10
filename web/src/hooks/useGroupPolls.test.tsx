// @vitest-environment jsdom
import type React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface SnapshotDoc {
  id: string;
  data: () => Record<string, unknown>;
}

interface Subscription {
  next: (snapshot: { docs: SnapshotDoc[] }) => void;
  error: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

const subscriptions = new Map<string, Subscription[]>();
const mockOnSnapshot = vi.fn();
let mockUid = 'user-1';

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  limit: vi.fn((value: number) => ({ limit: value })),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((base: { path: string }, ...constraints: unknown[]) => ({ base, constraints })),
  serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
  setDoc: vi.fn(),
  Timestamp: class TimestampMock {},
  where: vi.fn((...parts: unknown[]) => ({ where: parts })),
}));
vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../services/cloudFunctions', () => ({
  getCallable: vi.fn(() => vi.fn()),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: mockUid, displayName: mockUid },
    user: { name: mockUid },
  }),
}));
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));
vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Erro',
}));

import { useGroupPolls } from './useGroupPolls';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function emit(path: string, docs: SnapshotDoc[]) {
  act(() => subscriptions.get(path)?.forEach((subscription) => subscription.next({ docs })));
}

function pollDoc(): SnapshotDoc {
  return {
    id: 'poll-1',
    data: () => ({
      group_id: 'group-1',
      question: 'Quem joga?',
      options: [{ id: 'yes', text: 'Sim' }, { id: 'no', text: 'Não' }],
      created_by: 'owner',
      created_by_name: 'Owner',
      status: 'ACTIVE',
      created_at: new Date(),
    }),
  };
}

describe('useGroupPolls realtime aggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptions.clear();
    mockUid = 'user-1';
    mockOnSnapshot.mockImplementation(
      (
        reference: { base?: { path?: string }; path?: string },
        next: Subscription['next'],
        error: Subscription['error'],
      ) => {
        const path = reference.base?.path ?? reference.path ?? '';
        const subscription = { next, error, unsubscribe: vi.fn() };
        subscriptions.set(path, [...(subscriptions.get(path) ?? []), subscription]);
        return subscription.unsubscribe;
      },
    );
  });

  it('mantém dois clientes consistentes agregando 1000 votos sem N+1', async () => {
    const firstClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const secondClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = renderHook(() => useGroupPolls('group-1'), { wrapper: wrapperFor(firstClient) });
    const second = renderHook(() => useGroupPolls('group-1'), { wrapper: wrapperFor(secondClient) });

    const members = Array.from({ length: 1000 }, (_, index) => ({
      id: `user-${index}`,
      data: () => ({ status: 'ACTIVE' }),
    }));
    const votes = Array.from({ length: 1000 }, (_, index) => ({
      id: `vote-${index}`,
      data: () => ({
        poll_id: 'poll-1',
        group_id: 'group-1',
        user_id: `user-${index}`,
        option_id: index % 2 === 0 ? 'yes' : 'no',
      }),
    }));
    emit('group_polls', [pollDoc()]);
    emit('groups/group-1/members', members);
    emit('group_poll_votes', votes);

    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(first.result.current.polls[0].voteCounts).toEqual({ yes: 500, no: 500 });
    expect(second.result.current.polls[0].voteCounts).toEqual({ yes: 500, no: 500 });
    expect(first.result.current.polls[0].totalVotes).toBe(1000);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(6); // 3 constant listeners per client

    const updatedVotes = votes.map((vote, index) => index === 1 ? {
      ...vote,
      data: () => ({ ...vote.data(), option_id: 'yes' }),
    } : vote);
    emit('group_poll_votes', updatedVotes);
    await waitFor(() => expect(first.result.current.polls[0].voteCounts.yes).toBe(501));
    expect(second.result.current.polls[0].voteCounts).toEqual({ yes: 501, no: 499 });

    first.unmount();
    second.unmount();
    subscriptions.forEach((items) => items.forEach((item) => {
      expect(item.unsubscribe).toHaveBeenCalledOnce();
    }));
  });

  it('expõe erro, reconecta os três listeners e limpa a assinatura anterior', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => useGroupPolls('group-1'), { wrapper: wrapperFor(client) });
    const firstPollSubscription = subscriptions.get('group_polls')?.[0];
    act(() => firstPollSubscription?.error(new Error('offline')));
    await waitFor(() => expect(hook.result.current.error).toBe('offline'));

    await act(async () => hook.result.current.refetch());
    await waitFor(() => expect(subscriptions.get('group_polls')).toHaveLength(2));
    expect(firstPollSubscription?.unsubscribe).toHaveBeenCalledOnce();

    emit('group_polls', [pollDoc()]);
    emit('groups/group-1/members', [{ id: 'user-1', data: () => ({ status: 'ACTIVE' }) }]);
    emit('group_poll_votes', []);
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    hook.unmount();
  });
});
