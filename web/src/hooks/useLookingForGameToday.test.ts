// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
// Importado APÓS o vi.mock: resolve para o MockTimestamp da factory, permitindo
// comparar toMillis() do payload com o fim do dia esperado.
import { Timestamp } from 'firebase/firestore';

const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn();

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    constructor(ms: number) {
      this.ms = ms;
    }
    ms: number;
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
    doc: (...args: any[]) => mockDoc(...args),
    updateDoc: (...args: any[]) => mockUpdateDoc(...args),
    serverTimestamp: vi.fn(() => SERVER_TIMESTAMP),
    Timestamp: MockTimestamp,
    // services/firebase.ts precisa existir no mock. #2330
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

import { useLookingForGameToday } from './useLookingForGameToday';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function expectedEndOfToday(): number {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockUpdateDoc.mockResolvedValue(undefined);
});

describe('useLookingForGameToday', () => {
  it('escreve em users/{userId} via updateDoc', async () => {
    const { result } = renderHook(() => useLookingForGameToday('u-1'));
    await act(async () => {
      await result.current.setLookingForGameToday(true);
    });
    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'u-1');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('ativa: flag true até o fim do dia e updated_at com serverTimestamp', async () => {
    const { result } = renderHook(() => useLookingForGameToday('u-1'));
    await act(async () => {
      await result.current.setLookingForGameToday(true);
    });
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.looking_for_game_today).toBe(true);
    expect((payload.looking_for_game_today_until as Timestamp).toMillis())
      .toBe(expectedEndOfToday());
    expect(payload.looking_for_game_today_updated_at).toBe(SERVER_TIMESTAMP);
    expect(result.current.error).toBeNull();
  });

  it('desativa: flag false e until=null', async () => {
    const { result } = renderHook(() => useLookingForGameToday('u-1'));
    await act(async () => {
      await result.current.setLookingForGameToday(false);
    });
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.looking_for_game_today).toBe(false);
    expect(payload.looking_for_game_today_until).toBeNull();
    expect(payload.looking_for_game_today_updated_at).toBe(SERVER_TIMESTAMP);
  });

  it('sem userId: lança Missing authenticated user e não escreve', async () => {
    const { result } = renderHook(() => useLookingForGameToday(undefined));
    await expect(
      act(async () => {
        await result.current.setLookingForGameToday(true);
      }),
    ).rejects.toThrow('Missing authenticated user');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('loading alterna true→false enquanto o updateDoc está pendente', async () => {
    let resolveUpdate!: () => void;
    mockUpdateDoc.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const { result } = renderHook(() => useLookingForGameToday('u-1'));
    let callPromise!: Promise<void>;
    act(() => {
      callPromise = result.current.setLookingForGameToday(true);
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolveUpdate();
      await callPromise;
    });
    expect(result.current.loading).toBe(false);
  });

  it('erro no updateDoc: seta error com a mensagem e repropaga', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useLookingForGameToday('u-1'));
    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.setLookingForGameToday(true);
      } catch (err) {
        caught = err;
      }
    });
    expect((caught as Error).message).toBe('permission-denied');
    expect(result.current.error).toBe('permission-denied');
    expect(result.current.loading).toBe(false);
  });
});
