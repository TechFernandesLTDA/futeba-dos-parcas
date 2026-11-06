import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();
const gameSubscriptions: Array<{
  next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
  error: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('firebase/firestore', () => {
  class TimestampMock {
    toDate() { return new Date(); }
  }
  return {
    addDoc: vi.fn(),
    collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
    doc: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
    getDoc: vi.fn(),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    limit: vi.fn((value: number) => ({ limit: value })),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
    orderBy: vi.fn((...parts: unknown[]) => ({ orderBy: parts })),
    query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
    serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
    Timestamp: TimestampMock,
    updateDoc: vi.fn(),
    where: vi.fn((...parts: unknown[]) => ({ where: parts })),
    writeBatch: vi.fn(() => ({ delete: vi.fn(), update: vi.fn(), commit: vi.fn() })),
  };
});
vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../services/cloudFunctions', () => ({ confirmGamePresence: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'User' },
    firebaseUser: { uid: 'user-1' },
    currentUser: { uid: 'user-1' },
  }),
}));
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import { useGames } from './useGames';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function gameDoc(id: string, status: string): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => ({ id, status, owner_id: 'owner', dateTime: new Date('2026-08-10T19:00:00Z') }),
  };
}

describe('useGames shared realtime cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gameSubscriptions.length = 0;
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockOnSnapshot.mockImplementation((
      _query: unknown,
      next: (snapshot: { docs: ReturnType<typeof gameDoc>[] }) => void,
      error: (error: Error) => void,
    ) => {
      const subscription = { next, error, unsubscribe: vi.fn() };
      gameSubscriptions.push(subscription);
      return subscription.unsubscribe;
    });
  });

  it('compartilha um listener por queryKey e aplica criação, status e remoção remotos', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => ({
      first: useGames({ statuses: ['SCHEDULED', 'CONFIRMED'] }),
      second: useGames({ statuses: ['SCHEDULED', 'CONFIRMED'] }),
    }), { wrapper: wrapperFor(client) });

    expect(gameSubscriptions).toHaveLength(1);
    expect(mockGetDocs).not.toHaveBeenCalled();
    act(() => gameSubscriptions[0].next({ docs: [gameDoc('game-1', 'SCHEDULED')] }));
    await waitFor(() => expect(hook.result.current.first.games).toHaveLength(1));
    expect(hook.result.current.second.games[0].status).toBe('SCHEDULED');

    act(() => gameSubscriptions[0].next({ docs: [
      gameDoc('game-1', 'CONFIRMED'),
      gameDoc('game-2', 'SCHEDULED'),
    ] }));
    await waitFor(() => expect(hook.result.current.first.games).toHaveLength(2));
    expect(hook.result.current.second.games[0].status).toBe('CONFIRMED');

    act(() => gameSubscriptions[0].next({ docs: [gameDoc('game-2', 'SCHEDULED')] }));
    await waitFor(() => expect(hook.result.current.first.games.map((game) => game.id)).toEqual(['game-2']));

    hook.unmount();
    expect(gameSubscriptions[0].unsubscribe).toHaveBeenCalledOnce();
  });

  it('propaga erro aos consumidores e reconecta sem criar double-fetch', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => ({ first: useGames(), second: useGames() }), {
      wrapper: wrapperFor(client),
    });
    act(() => gameSubscriptions[0].error(new Error('offline')));
    await waitFor(() => expect(hook.result.current.first.error).toBe('offline'));
    expect(hook.result.current.second.error).toBe('offline');

    await act(async () => hook.result.current.first.refetch());
    expect(gameSubscriptions).toHaveLength(2);
    expect(gameSubscriptions[0].unsubscribe).toHaveBeenCalledOnce();
    act(() => gameSubscriptions[1].next({ docs: [gameDoc('game-3', 'LIVE')] }));
    await waitFor(() => expect(hook.result.current.first.error).toBeNull());
    expect(hook.result.current.second.games[0].id).toBe('game-3');
    expect(mockGetDocs).not.toHaveBeenCalled();
    hook.unmount();
  });
});
