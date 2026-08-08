import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const { mockGetFieldAvailability } = vi.hoisted(() => ({
  mockGetFieldAvailability: vi.fn(),
}));

vi.mock('../services/cloudFunctions', () => ({
  getFieldAvailability: mockGetFieldAvailability,
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { useFieldGames } from './useFieldGames';

describe('useFieldGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFieldAvailability.mockResolvedValue({ data: { slots: [] } });
  });

  it('retorna vazio sem chamar o backend quando fieldId está vazio', () => {
    const { result } = renderHook(() => useFieldGames(''), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.data.byDate.size).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetFieldAvailability).not.toHaveBeenCalled();
  });

  it('consulta somente a projeção sanitizada para a quadra e intervalo', async () => {
    const { result } = renderHook(() => useFieldGames('field-1', 7), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetFieldAvailability).toHaveBeenCalledTimes(1);
    expect(mockGetFieldAvailability).toHaveBeenCalledWith({
      fieldId: 'field-1',
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('organiza slots por data sem depender de metadados do jogo', async () => {
    mockGetFieldAvailability.mockResolvedValue({
      data: {
        slots: [
          { date: '2026-07-15', startMinutes: 20 * 60 + 30, endMinutes: 21 * 60 + 30 },
          { date: '2026-07-15', startMinutes: 19 * 60, endMinutes: 20 * 60 },
          { date: '2026-07-16', startMinutes: 19 * 60, endMinutes: 20 * 60 },
        ],
      },
    });

    const { result } = renderHook(() => useFieldGames('field-1', 30), {
      wrapper: createTestWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.byDate.size).toBe(2);
    expect(result.current.data.byDate.get('2026-07-15')).toEqual([
      { date: '2026-07-15', startMinutes: 19 * 60, endMinutes: 20 * 60 },
      { date: '2026-07-15', startMinutes: 20 * 60 + 30, endMinutes: 21 * 60 + 30 },
    ]);
  });

  it('calcula datas lotadas e conflitos usando a janela do local', async () => {
    mockGetFieldAvailability.mockResolvedValue({
      data: {
        slots: [
          { date: '2026-07-15', startMinutes: 6 * 60, endMinutes: 23 * 60 },
          { date: '2026-07-16', startMinutes: 18 * 60, endMinutes: 20 * 60 },
          { date: '2026-07-16', startMinutes: 19 * 60, endMinutes: 21 * 60 },
        ],
      },
    });

    const { result } = renderHook(
      () => useFieldGames('field-1', 60, { openingTime: '06:00', closingTime: '23:00' }),
      { wrapper: createTestWrapper() },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.fullyBookedDates.has('2026-07-15')).toBe(true);
    expect(result.current.data.conflictDates.has('2026-07-16')).toBe(true);
  });

  it('expõe erro recuperável quando o callable falha', async () => {
    mockGetFieldAvailability.mockRejectedValue(new Error('permission denied'));

    const { result } = renderHook(() => useFieldGames('field-1'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });
  });

  it('falha fechado quando o backend informa que a resposta foi truncada', async () => {
    mockGetFieldAvailability.mockResolvedValue({ data: { slots: [], truncated: true } });

    const { result } = renderHook(() => useFieldGames('field-1'), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.data.byDate.size).toBe(0);
  });

  it('ignora resposta atrasada da quadra anterior', async () => {
    let resolveFirst!: (value: { data: { slots: Array<{ date: string; startMinutes: number; endMinutes: number }> } }) => void;
    const firstRequest = new Promise<{ data: { slots: Array<{ date: string; startMinutes: number; endMinutes: number }> } }>(
      (resolve) => { resolveFirst = resolve; },
    );
    mockGetFieldAvailability
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({
        data: { slots: [{ date: '2026-07-20', startMinutes: 600, endMinutes: 660 }] },
      });

    const { result, rerender } = renderHook(
      ({ fieldId }: { fieldId: string }) => useFieldGames(fieldId),
      { wrapper: createTestWrapper(), initialProps: { fieldId: 'field-1' } },
    );

    rerender({ fieldId: 'field-2' });
    await waitFor(() => expect(result.current.data.byDate.has('2026-07-20')).toBe(true));

    await act(async () => {
      resolveFirst({
        data: { slots: [{ date: '2026-07-19', startMinutes: 480, endMinutes: 540 }] },
      });
      await firstRequest;
    });

    expect(result.current.data.byDate.has('2026-07-20')).toBe(true);
    expect(result.current.data.byDate.has('2026-07-19')).toBe(false);
  });
});
