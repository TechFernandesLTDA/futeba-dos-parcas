/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    private value: Date;

    constructor(value: Date) {
      this.value = value;
    }

    toDate() {
      return this.value;
    }

    static fromDate(value: Date) {
      return new MockTimestamp(value);
    }
  }

  return {
    collection: (...args: any[]) => mockCollection(...args),
    query: (...args: any[]) => mockQuery(...args),
    where: (...args: any[]) => mockWhere(...args),
    orderBy: (...args: any[]) => mockOrderBy(...args),
    limit: (...args: any[]) => mockLimit(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    Timestamp: MockTimestamp,
  };
});

vi.mock('../services/firebase', () => ({
  db: {},
  app: {},
}));

vi.mock('../services/cloudFunctions', () => ({
  joinPublicGame: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../utils/firestoreHelpers', () => ({
  snakeToCamel: (value: unknown) => value,
}));

vi.mock('../utils/gameLifecycle', () => ({
  isFutureGame: () => true,
}));

import { usePublicGames } from './usePublicGames';

describe('usePublicGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('games-collection');
    mockQuery.mockReturnValue('games-query');
    mockWhere.mockImplementation((...args) => args);
    mockOrderBy.mockImplementation((...args) => args);
    mockLimit.mockImplementation((...args) => args);
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('usa dateTime server-side para jogos publicos abertos', async () => {
    renderHook(() => usePublicGames('open'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalledWith('games-query');
    });

    expect(mockWhere).toHaveBeenCalledWith('is_public', '==', true);
    expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'PUBLIC_OPEN');
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'SCHEDULED');
    expect(mockWhere).toHaveBeenCalledWith(
      'dateTime',
      '>=',
      expect.objectContaining({ toDate: expect.any(Function) }),
    );
    expect(mockOrderBy).toHaveBeenCalledWith('dateTime', 'asc');
  });

  it('usa status e dateTime server-side para jogos publicos do mapa', async () => {
    renderHook(() => usePublicGames('map'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalledWith('games-query');
    });

    expect(mockWhere).toHaveBeenCalledWith('is_public', '==', true);
    expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['SCHEDULED', 'CONFIRMED']);
    expect(mockWhere).toHaveBeenCalledWith(
      'dateTime',
      '>=',
      expect.objectContaining({ toDate: expect.any(Function) }),
    );
    expect(mockOrderBy).toHaveBeenCalledWith('dateTime', 'asc');
  });
});
