/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'mock-collection-ref'),
  query: vi.fn(() => 'mock-query'),
  where: vi.fn(() => 'mock-where'),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    format: (d: Date, fmt: string) => {
      if (fmt === 'yyyy-MM-dd') {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return actual.format(d, fmt);
    },
    addDays: (d: Date, n: number) => {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    },
  };
});

import { useFieldGames } from './useFieldGames';

describe('useFieldGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty data when fieldId is empty', () => {
    const { result } = renderHook(() => useFieldGames(''), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.data.byDate.size).toBe(0);
    expect(result.current.data.fullyBookedDates.size).toBe(0);
    expect(result.current.data.conflictDates.size).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading=true and calls onSnapshot when fieldId is provided', async () => {
    const mockUnsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);

    const { result } = renderHook(() => useFieldGames('field-1', 7), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockOnSnapshot.mock.calls[0];
    expect(callArgs[0]).toBe('mock-query');
    expect(typeof callArgs[1]).toBe('function');
    expect(typeof callArgs[2]).toBe('function');
  });

  it('processes game data from snapshot correctly', async () => {
    const mockUnsubscribe = vi.fn();
    mockOnSnapshot.mockImplementation((_query: any, onNext: (snapshot: any) => void) => {
      setTimeout(() => {
        onNext({
          docs: [
            {
              data: () => ({
                date: '2026-06-10',
                time: '19:00',
                end_time: '20:00',
                status: 'CONFIRMED',
              }),
            },
            {
              data: () => ({
                date: '2026-06-10',
                time: '20:30',
                end_time: '21:30',
                status: 'SCHEDULED',
              }),
            },
            {
              data: () => ({
                date: '2026-06-12',
                time: '19:00',
                end_time: '20:00',
                status: 'CONFIRMED',
              }),
            },
          ],
        });
      }, 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFieldGames('field-1', 30), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.byDate.size).toBe(2);
    expect(result.current.data.byDate.has('2026-06-10')).toBe(true);
    expect(result.current.data.byDate.has('2026-06-12')).toBe(true);

    const june10Games = result.current.data.byDate.get('2026-06-10')!;
    expect(june10Games.length).toBe(2);
    expect(june10Games[0].startMinutes).toBe(19 * 60);
    expect(june10Games[0].endMinutes).toBe(20 * 60);
    expect(june10Games[1].startMinutes).toBe(20 * 60 + 30);
    expect(june10Games[1].endMinutes).toBe(21 * 60 + 30);

    expect(result.current.data.conflictDates.has('2026-06-10')).toBe(true);
    expect(result.current.data.conflictDates.has('2026-06-12')).toBe(true);
  });

  it('skips cancelled games', async () => {
    const mockUnsubscribe = vi.fn();
    mockOnSnapshot.mockImplementation((_query: any, onNext: (snapshot: any) => void) => {
      setTimeout(() => {
        onNext({
          docs: [
            {
              data: () => ({
                date: '2026-06-10',
                time: '19:00',
                end_time: '20:00',
                status: 'CANCELLED',
              }),
            },
            {
              data: () => ({
                date: '2026-06-10',
                time: '20:00',
                end_time: '21:00',
                status: 'SCHEDULED',
              }),
            },
          ],
        });
      }, 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFieldGames('field-1'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const june10Games = result.current.data.byDate.get('2026-06-10')!;
    expect(june10Games.length).toBe(1);
    expect(june10Games[0].startMinutes).toBe(20 * 60);
  });

  it('marks dates as fully booked when no free slots remain', async () => {
    const mockUnsubscribe = vi.fn();
    mockOnSnapshot.mockImplementation((_query: any, onNext: (snapshot: any) => void) => {
      setTimeout(() => {
        onNext({
          docs: [
            {
              data: () => ({
                date: '2026-06-10',
                time: '06:00',
                end_time: '23:00',
                status: 'CONFIRMED',
              }),
            },
          ],
        });
      }, 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFieldGames('field-1'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.fullyBookedDates.has('2026-06-10')).toBe(true);
  });

  it('handles error from onSnapshot', async () => {
    const mockUnsubscribe = vi.fn();
    mockOnSnapshot.mockImplementation((_query: any, _onNext: any, onError: (err: Error) => void) => {
      setTimeout(() => {
        onError(new Error('Permission denied'));
      }, 10);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFieldGames('field-1'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });
  });

  it('unsubscribes on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useFieldGames('field-1'), {
      wrapper: createTestWrapper(),
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('resets data when fieldId changes to empty', async () => {
    const mockUnsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);

    const { result, rerender } = renderHook(
      ({ fieldId }: { fieldId: string }) => useFieldGames(fieldId),
      {
        wrapper: createTestWrapper(),
        initialProps: { fieldId: 'field-1' },
      }
    );

    await waitFor(() => {
      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    rerender({ fieldId: '' });

    expect(result.current.data.byDate.size).toBe(0);
    expect(result.current.data.fullyBookedDates.size).toBe(0);
    expect(result.current.loading).toBe(false);
  });
});
