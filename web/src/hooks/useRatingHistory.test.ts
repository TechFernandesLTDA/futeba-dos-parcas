// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
// Importado APÓS o vi.mock: resolve para o MockTimestamp da factory,
// garantindo o .toDate() usado no mapeamento de calculatedAt.
import { Timestamp } from 'firebase/firestore';

// t ESTÁVEL: o effect depende de [userId, t]; nova função por render
// reexecutaria o fetch em loop.
const mockT = vi.fn((key: string) => key);

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
void mockQuery;
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
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
    query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    limit: (...args: any[]) => mockLimit(...args),
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

import { useRatingHistory } from './useRatingHistory';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function entryDoc(id: string, data: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      position: 'STRIKER',
      rating: 7.5,
      samples: 12,
      calculatedAt: Timestamp.fromMillis(1735689600000),
      ...data,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockT.mockImplementation((key: string) => key);
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockLimit.mockImplementation((n: number) => ({ type: 'limit', n }));
  mockGetDocs.mockResolvedValue({ docs: [] });
});

describe('useRatingHistory', () => {
  it('sem userId: history vazio, loading=false e nenhuma consulta', async () => {
    const { result } = renderHook(() => useRatingHistory(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('userId undefined: mesmo comportamento de null', async () => {
    const { result } = renderHook(() => useRatingHistory(undefined));
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(result.current.history).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('inicia loading=true e consulta users/{uid}/rating_history com orderBy desc e limit 100', async () => {
    const { result } = renderHook(() => useRatingHistory('user-1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users', 'user-1', 'rating_history');
    expect(mockOrderBy).toHaveBeenCalledWith('calculatedAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(100);
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('mapeia entradas: id preservado e calculatedAt convertido para Date', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        entryDoc('e-1', { position: 'MID', rating: 6.2, samples: 8 }),
        entryDoc('e-2', { position: 'GOALKEEPER', rating: 8, samples: 3 }),
      ],
    });
    const { result } = renderHook(() => useRatingHistory('user-1'));
    await waitFor(() => expect(result.current.history).toHaveLength(2));

    const [first, second] = result.current.history;
    expect(first.id).toBe('e-1');
    expect(first.position).toBe('MID');
    expect(first.rating).toBe(6.2);
    expect(first.samples).toBe(8);
    expect(first.calculatedAt).toBeInstanceOf(Date);
    expect(first.calculatedAt.getTime()).toBe(1735689600000);
    expect(second.position).toBe('GOALKEEPER');
  });

  it('calculatedAt ausente/nulo: usa data atual como fallback', async () => {
    const before = Date.now();
    mockGetDocs.mockResolvedValue({
      docs: [entryDoc('e-1', { calculatedAt: null })],
    });
    const { result } = renderHook(() => useRatingHistory('user-1'));
    await waitFor(() => expect(result.current.history).toHaveLength(1));
    const at = result.current.history[0].calculatedAt.getTime();
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('erro Error: expõe err.message e desliga loading', async () => {
    mockGetDocs.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useRatingHistory('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('permission-denied');
    expect(result.current.history).toEqual([]);
  });

  it('erro não-Error (string): usa fallback do i18n', async () => {
    mockGetDocs.mockRejectedValue('boom');
    const { result } = renderHook(() => useRatingHistory('user-1'));
    await waitFor(() => expect(result.current.error).toBe('feedback.ratingHistory.loadError'));
    expect(mockT).toHaveBeenCalledWith('feedback.ratingHistory.loadError');
  });

  it('troca de userId refaz o fetch e usa os dados novos', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [entryDoc('e-old', { rating: 5 })] })
      .mockResolvedValueOnce({ docs: [entryDoc('e-new', { rating: 9 })] });

    const { result, rerender } = renderHook(({ uid }: { uid: string | null }) => useRatingHistory(uid), {
      initialProps: { uid: 'user-1' as string | null },
    });
    await waitFor(() => expect(result.current.history.map((h) => h.id)).toEqual(['e-old']));

    rerender({ uid: 'user-2' });
    await waitFor(() => expect(result.current.history.map((h) => h.id)).toEqual(['e-new']));
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockCollection).toHaveBeenLastCalledWith(expect.anything(), 'users', 'user-2', 'rating_history');
  });

  it('fetch antigo que resolve após troca de userId não sobrescreve o estado (cancelamento)', async () => {
    let resolveFirst!: (v: unknown) => void;
    mockGetDocs
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ docs: [entryDoc('e-new', { rating: 9 })] });

    const { result, rerender } = renderHook(({ uid }: { uid: string | null }) => useRatingHistory(uid), {
      initialProps: { uid: 'user-1' as string | null },
    });
    // user-1 pendente; troca para user-2 (o effect do user-1 é cancelado)
    rerender({ uid: 'user-2' });
    await waitFor(() => expect(result.current.history.map((h) => h.id)).toEqual(['e-new']));

    // O fetch cancelado do user-1 resolve tarde com dados antigos
    await act(async () => {
      resolveFirst({ docs: [entryDoc('e-stale', { rating: 1 })] });
    });
    expect(result.current.history.map((h) => h.id)).toEqual(['e-new']);
    expect(result.current.loading).toBe(false);
  });

  it('fetch que resolve após o unmount não grava estado nem quebra', async () => {
    let resolveGetDocs!: (v: unknown) => void;
    mockGetDocs.mockReturnValue(new Promise((resolve) => { resolveGetDocs = resolve; }));
    const { unmount } = renderHook(() => useRatingHistory('user-1'));
    unmount();
    expect(() => resolveGetDocs({ docs: [entryDoc('e-late')] })).not.toThrow();
    await act(async () => {});
  });
});
