import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();
const mockStartAfter = vi.fn((cursor?: unknown) => ({ cursor }));
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...parts: unknown[]) => ({ type: 'collection', parts })),
  doc: vi.fn((...parts: unknown[]) => ({ type: 'doc', parts })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: vi.fn((value: number) => ({ limit: value })),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  orderBy: vi.fn((field: string, direction?: string) => ({ field, direction })),
  query: vi.fn((...parts: unknown[]) => ({ type: 'query', parts })),
  serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
  startAfter: (...args: unknown[]) => mockStartAfter(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: vi.fn((...parts: unknown[]) => ({ where: parts })),
}));

vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../services/cloudFunctions', () => ({ sendDirectMessage: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'user-1' } }),
}));
vi.mock('../utils/firestoreHelpers', () => ({
  toDate: (value: Date | { toDate?: () => Date } | null | undefined) =>
    value instanceof Date ? value : value?.toDate?.(),
}));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import { useDirectChat } from './useDirectMessages';

interface MessageOptions {
  deleted?: boolean;
}

function messageDoc(id: string, options: MessageOptions = {}) {
  return {
    id,
    data: () => ({
      sender_id: 'user-2',
      sender_name: 'Outro jogador',
      sender_photo_url: null,
      text: `Mensagem ${id}`,
      created_at: new Date(Number(id.match(/\d+/)?.[0] ?? 0)),
      deleted_by: options.deleted ? 'user-2' : null,
      deleted_at: options.deleted ? { toDate: () => new Date(1_000) } : null,
    }),
  };
}

function chatSnapshot() {
  return {
    id: 'chat-1',
    exists: () => true,
    data: () => ({
      participants: ['user-1', 'user-2'],
      participant_names: { 'user-2': 'Outro jogador' },
      participant_photos: {},
      unread_count: { 'user-1': 0 },
    }),
  };
}

describe('useDirectChat realtime pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('preserva histórico, atualiza soft-delete e mantém o cursor histórico após novo snapshot', async () => {
    const initialLiveDocs = Array.from({ length: 50 }, (_, index) => messageDoc(`live-${50 - index}`));
    const olderDocs = Array.from({ length: 50 }, (_, index) => messageDoc(`old-${50 - index}`));
    let emitMessages: ((snapshot: { docs: ReturnType<typeof messageDoc>[]; size: number }) => void) | undefined;
    let listenerCall = 0;

    mockOnSnapshot.mockImplementation((_reference, next: (snapshot: unknown) => void) => {
      listenerCall += 1;
      if (listenerCall === 1) {
        next(chatSnapshot());
      } else {
        emitMessages = next as typeof emitMessages;
        next({ docs: initialLiveDocs, size: initialLiveDocs.length });
      }
      return vi.fn();
    });
    mockGetDocs
      .mockResolvedValueOnce({ docs: olderDocs, size: olderDocs.length })
      .mockResolvedValueOnce({ docs: [], size: 0 });

    const { result } = renderHook(() => useDirectChat('chat-1'));
    await waitFor(() => expect(result.current.messages).toHaveLength(50));

    await act(async () => result.current.loadMore());
    expect(result.current.messages).toHaveLength(100);
    expect(mockStartAfter).toHaveBeenNthCalledWith(1, initialLiveDocs[initialLiveDocs.length - 1]);

    const nextLiveDocs = [
      messageDoc('live-51'),
      ...Array.from({ length: 49 }, (_, index) => {
        const id = `live-${50 - index}`;
        return messageDoc(id, { deleted: id === 'live-25' });
      }),
    ];
    act(() => emitMessages?.({ docs: nextLiveDocs, size: nextLiveDocs.length }));

    expect(result.current.messages).toHaveLength(101);
    expect(result.current.messages.find((message) => message.id === 'live-25')?.deletedAt).toEqual(new Date(1_000));
    expect(new Set(result.current.messages.map((message) => message.id)).size).toBe(101);

    await act(async () => result.current.loadMore());
    expect(mockStartAfter).toHaveBeenNthCalledWith(2, olderDocs[olderDocs.length - 1]);
    expect(result.current.messages).toHaveLength(101);
    expect(result.current.hasMore).toBe(false);
  });
});
