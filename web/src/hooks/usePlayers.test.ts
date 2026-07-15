import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn((_db: unknown, ...parts: string[]) => parts.join('/'));

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    toDate() { return new Date(0); }
  }
  return {
    collection: vi.fn((_db: unknown, ...parts: string[]) => parts.join('/')),
    doc: (...args: unknown[]) => mockDoc(...args),
    documentId: vi.fn(() => '__name__'),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    limit: vi.fn((value: number) => ({ limit: value })),
    query: vi.fn((...parts: unknown[]) => ({ parts })),
    Timestamp: MockTimestamp,
    where: vi.fn((...parts: unknown[]) => ({ where: parts })),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../services/cloudFunctions', () => ({
  getLeaguePlayers: vi.fn().mockResolvedValue({ data: { players: [] } }),
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import { usePlayerDetail } from './usePlayers';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

function userDocument(name: string) {
  return {
    exists: () => true,
    data: () => ({ name, experience_points: 10 }),
  };
}

const missingDocument = { exists: () => false, data: () => ({}) };

describe('usePlayerDetail', () => {
  const responses = new Map<string, () => Promise<unknown>>();

  beforeEach(() => {
    vi.clearAllMocks();
    responses.clear();
    mockGetDoc.mockImplementation((reference: string) => {
      const response = responses.get(reference);
      if (!response) throw new Error(`Resposta ausente para ${reference}`);
      return response();
    });
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('limpa o perfil anterior durante troca de parâmetro e trata usuário inexistente', async () => {
    const missingB = deferred<typeof missingDocument>();
    responses.set('users/A', async () => userDocument('Alpha'));
    responses.set('statistics/A', async () => missingDocument);
    responses.set('users/B', () => missingB.promise);
    responses.set('statistics/B', async () => missingDocument);

    const { result, rerender } = renderHook(
      ({ userId }) => usePlayerDetail(userId),
      { initialProps: { userId: 'A' } },
    );
    await waitFor(() => expect(result.current.player?.name).toBe('Alpha'));

    rerender({ userId: 'B' });
    expect(result.current.player).toBeNull();
    expect(result.current.loading).toBe(true);

    act(() => missingB.resolve(missingDocument));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.player).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ignora resposta tardia do userId anterior', async () => {
    const slowA = deferred<ReturnType<typeof userDocument>>();
    responses.set('users/A', () => slowA.promise);
    responses.set('statistics/A', async () => missingDocument);
    responses.set('users/B', async () => userDocument('Beta'));
    responses.set('statistics/B', async () => missingDocument);

    const { result, rerender } = renderHook(
      ({ userId }) => usePlayerDetail(userId),
      { initialProps: { userId: 'A' } },
    );
    rerender({ userId: 'B' });
    await waitFor(() => expect(result.current.player?.name).toBe('Beta'));

    act(() => slowA.resolve(userDocument('Alpha')));
    await act(async () => { await slowA.promise; });
    expect(result.current.player?.name).toBe('Beta');
  });

  it('expõe refetch real após erro transitório', async () => {
    let shouldFail = true;
    responses.set('users/A', async () => {
      if (shouldFail) throw new Error('offline');
      return userDocument('Alpha recuperado');
    });
    responses.set('statistics/A', async () => missingDocument);

    const { result } = renderHook(() => usePlayerDetail('A'));
    await waitFor(() => expect(result.current.error).toBe('offline'));

    shouldFail = false;
    act(() => result.current.refetch());
    expect(result.current.player).toBeNull();
    await waitFor(() => expect(result.current.player?.name).toBe('Alpha recuperado'));
    expect(result.current.error).toBeNull();
  });
});
