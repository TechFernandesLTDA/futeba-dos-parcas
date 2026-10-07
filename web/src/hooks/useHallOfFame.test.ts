// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: vi.fn((...args: any[]) => args),
  orderBy: vi.fn((...args: any[]) => args),
  limit: vi.fn((value: number) => ({ limit: value })),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  Timestamp: class TimestampMock {},
}));

vi.mock('../services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  functions: {},
  app: {},
  appCheck: null,
}));

import { useHallOfFame } from './useHallOfFame';

function archiveDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCollection.mockImplementation((_db: unknown, ...parts: string[]) => parts.join('/'));
  mockGetDocs.mockResolvedValue({ docs: [] });
});

describe('useHallOfFame', () => {
  it('sem groupId: query desabilitada, não consulta Firestore', () => {
    const { result } = renderHook(() => useHallOfFame(), { wrapper: createTestWrapper() });

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('consulta season-archive/{groupId}/seasons com limit 12 e orderBy archived_at desc', async () => {
    renderHook(() => useHallOfFame('group-7'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());

    expect(mockCollection).toHaveBeenCalledWith({}, 'season-archive', 'group-7', 'seasons');
    const queryArgs = mockGetDocs.mock.calls[0][0] as unknown[];
    expect(queryArgs[0]).toBe('season-archive/group-7/seasons');
    expect(queryArgs[1]).toEqual(['archived_at', 'desc']);
    expect(queryArgs[2]).toEqual({ limit: 12 });
  });

  it('mapeia arquivo de temporada completo (mvp, archivedAt, playersCount)', async () => {
    const archivedAt = new Date('2026-06-30T00:00:00Z');
    mockGetDocs.mockResolvedValue({
      docs: [
        archiveDoc('2026-06', {
          month_key: '2026-06',
          name: 'Junho 2026',
          mvp_user_name: 'Ana',
          mvp_user_id: 'u-1',
          mvp_points: 120,
          archived_at: { toDate: () => archivedAt },
          standings: [{ user_id: 'u-1' }, { user_id: 'u-2' }, { user_id: 'u-3' }],
        }),
      ],
    });
    const { result } = renderHook(() => useHallOfFame('group-7'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data![0]).toEqual({
      id: '2026-06',
      monthKey: '2026-06',
      name: 'Junho 2026',
      mvpUserName: 'Ana',
      mvpUserId: 'u-1',
      mvpPoints: 120,
      archivedAt,
      playersCount: 3,
    });
  });

  it('standings ausente ou vazio → playersCount 0', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        archiveDoc('a-1', { month_key: 'm-1', name: 'A' }),
        archiveDoc('a-2', { month_key: 'm-2', name: 'B', standings: [] }),
      ],
    });
    const { result } = renderHook(() => useHallOfFame('group-7'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(result.current.data![0].playersCount).toBe(0);
    expect(result.current.data![1].playersCount).toBe(0);
  });

  it('campos mvp ausentes ficam undefined; archived_at ausente → fallback Date atual', async () => {
    const before = Date.now();
    mockGetDocs.mockResolvedValue({
      docs: [archiveDoc('a-3', { month_key: 'm-3', name: 'C' })],
    });
    const { result } = renderHook(() => useHallOfFame('group-7'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const archive = result.current.data![0];
    expect(archive.mvpUserName).toBeUndefined();
    expect(archive.mvpUserId).toBeUndefined();
    expect(archive.mvpPoints).toBeUndefined();
    expect(archive.archivedAt).toBeInstanceOf(Date);
    expect(archive.archivedAt.getTime()).toBeGreaterThanOrEqual(before - 5000);
    expect(archive.archivedAt.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it('expõe erro bruto do TanStack quando getDocs falha', async () => {
    mockGetDocs.mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(() => useHallOfFame('group-7'), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect((result.current.error as Error).message).toBe('unavailable');
    expect(result.current.data).toBeUndefined();
  });
});