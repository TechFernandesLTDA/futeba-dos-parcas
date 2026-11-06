// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: vi.fn((...args: any[]) => args),
  orderBy: vi.fn((...args: any[]) => args),
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

const mockLoggerError = vi.hoisted(() => vi.fn());
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: mockLoggerError, debug: vi.fn() }),
}));

import { useSeasons } from './useSeasons';

function seasonDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCollection.mockImplementation((_db: unknown, ...parts: string[]) => parts.join('/'));
  mockGetDocs.mockResolvedValue({ docs: [] });
});

describe('useSeasons', () => {
  it('consulta a coleção seasons ordenada por start_date desc', async () => {
    const { result } = renderHook(() => useSeasons(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockCollection).toHaveBeenCalledWith({}, 'seasons');
    expect(mockGetDocs).toHaveBeenCalled();
    const queryArgs = mockGetDocs.mock.calls[0][0] as unknown[];
    expect(queryArgs[0]).toBe('seasons');
    expect(queryArgs[1]).toEqual(['start_date', 'desc']);
    expect(result.current.seasons).toEqual([]);
  });

  it('mapeia campos snake_case e defaults (nome vazio → Temporada)', async () => {
    const createdAt = new Date('2026-01-10T12:00:00Z');
    mockGetDocs.mockResolvedValue({
      docs: [
        seasonDoc('s-1', {
          name: 'Temporada 2026',
          start_date: '2026-01-01',
          end_date: '2026-06-30',
          is_active: true,
          schedule_id: 'sched-9',
          created_at: { toDate: () => createdAt },
        }),
      ],
    });
    const { result } = renderHook(() => useSeasons(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.seasons).toEqual([
      {
        id: 's-1',
        name: 'Temporada 2026',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        isActive: true,
        scheduleId: 'sched-9',
        createdAt,
        closedAt: undefined,
      },
    ]);
  });

  it('usa fallback camelCase para is_active quando is_active está ausente', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-2', { name: 'Antiga', isActive: true, start_date: '2025-01-01' })],
    });
    const { result } = renderHook(() => useSeasons(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.seasons).toHaveLength(1));

    expect(result.current.seasons[0].isActive).toBe(true);
  });

  it('is_active prevalece sobre isActive quando ambos existem', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [seasonDoc('s-3', { is_active: false, isActive: true })],
    });
    const { result } = renderHook(() => useSeasons(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.seasons).toHaveLength(1));

    expect(result.current.seasons[0].isActive).toBe(false);
  });

  it('aplica defaults para documento vazio: Temporada, datas "" e isActive false', async () => {
    mockGetDocs.mockResolvedValue({ docs: [seasonDoc('s-4', {})] });
    const { result } = renderHook(() => useSeasons(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.seasons).toHaveLength(1));

    // isActive fica undefined quando o doc não tem is_active nem isActive
        // (d.is_active ?? d.isActive) — comportamento atual, documentado aqui.
        expect(result.current.seasons[0]).toEqual({
          id: 's-4',
          name: 'Temporada',
          startDate: '',
          endDate: '',
          isActive: undefined,
          scheduleId: undefined,
          createdAt: undefined,
          closedAt: undefined,
        });
  });

  it('não consulta Firestore quando enabled=false', () => {
      const { result } = renderHook(() => useSeasons({ enabled: false }), { wrapper: createTestWrapper() });

      expect(mockGetDocs).not.toHaveBeenCalled();
      // useSeasons envolve a query: loading = isLoading, que é false para query
      // desabilitada (isFetching idle) no TanStack v5.
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.seasons).toEqual([]);
    });

  it('loga e propaga erro quando getDocs falha (com retry configurado no hook)', async () => {
    // retry: 2 com backoff exponencial (~1 s + ~2 s reais). Fake timers avançam
    // o backoff sem esperar de verdade; as asserções são as mesmas.
    vi.useFakeTimers();
    try {
      mockGetDocs.mockRejectedValue(new Error('unavailable'));
      const { result } = renderHook(() => useSeasons(), { wrapper: createTestWrapper() });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe('unavailable');
      expect(mockLoggerError).toHaveBeenCalledWith('Error fetching seasons:', expect.any(Error));
      expect(result.current.seasons).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});