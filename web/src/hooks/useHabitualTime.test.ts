// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

let mockAuthReturn: any = {
  firebaseUser: { uid: 'user-1' },
  user: null,
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { useHabitualTime } from './useHabitualTime';

function setAuth(uid: string | null, userId: string | null = null) {
  mockAuthReturn = {
    firebaseUser: uid ? { uid } : null,
    user: userId ? { id: userId } : null,
    loading: false,
    error: null,
  };
}

function gameDoc(date?: string, time?: string) {
  return { data: () => ({ date, time }) };
}

function makeSnapshot(docs: Array<{ data: () => Record<string, unknown> }>) {
  return { docs };
}

// Labels na MESMA ordem do getDay() (0=Domingo ... 6=Sábado) — espelham o
// mapa interno do hook para validar o wiring do dayLabel.
const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
// 2026-10-02 → sexta (dow F); 2026-10-03 → sábado. Calculados com a MESMA
// construção local do hook (new Date(y, m-1, d)), sem risco de shift de TZ.
const FRIDAY_DATE = '2026-10-02';
const SATURDAY_DATE = '2026-10-03';
const fridayDow = new Date(2026, 9, 2).getDay();
const saturdayDow = new Date(2026, 9, 3).getDay();

describe('useHabitualTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth('user-1');
    mockCollection.mockReturnValue('mock-collection');
    mockQuery.mockReturnValue('mock-query');
    mockWhere.mockReturnValue('mock-where');
    mockOrderBy.mockReturnValue('mock-order');
    mockLimit.mockReturnValue('mock-limit');
  });

  describe('habilitação da query', () => {
    it('não consulta Firestore quando uid está ausente', async () => {
      setAuth(null);
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(result.current.habitualTime).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('não consulta Firestore quando locationId é vazio', async () => {
      const { result } = renderHook(() => useHabitualTime(''), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(result.current.habitualTime).toBeNull();
    });

    it('usa user.id como uid quando firebaseUser está ausente', async () => {
      setAuth(null, 'user-2');
      mockGetDocs.mockResolvedValue(makeSnapshot([]));
      renderHook(() => useHabitualTime('loc-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(mockWhere).toHaveBeenCalled());
      expect(mockWhere).toHaveBeenCalledWith('owner_id', '==', 'user-2');
    });
  });

  describe('montagem da consulta', () => {
    it('consulta games com owner_id, location_id e status in (sem cancelados)', async () => {
      mockGetDocs.mockResolvedValue(makeSnapshot([]));
      renderHook(() => useHabitualTime('loc-1'), { wrapper: createTestWrapper() });
      await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
      expect(mockCollection).toHaveBeenCalledWith({}, 'games');
      expect(mockWhere).toHaveBeenCalledWith('owner_id', '==', 'user-1');
      expect(mockWhere).toHaveBeenCalledWith('location_id', '==', 'loc-1');
      const statusCall = mockWhere.mock.calls.find((c) => c[0] === 'status');
      expect(statusCall?.[1]).toBe('in');
      expect(statusCall?.[2]).toEqual(
        expect.arrayContaining(['SCHEDULED', 'CONFIRMED', 'LIVE', 'FINISHED']),
      );
      expect(statusCall?.[2]).not.toContain('CANCELLED');
      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(30);
    });
  });

  describe('agregação de padrão', () => {
    it('retorna o dia/horário mais frequente com contagem e label', async () => {
      mockGetDocs.mockResolvedValue(
        makeSnapshot([
          gameDoc(FRIDAY_DATE, '20:00'),
          gameDoc(FRIDAY_DATE, '20:00'),
          gameDoc(FRIDAY_DATE, '20:00'),
          gameDoc(SATURDAY_DATE, '19:00'),
        ]),
      );
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.habitualTime).toEqual({
        dayOfWeek: fridayDow,
        dayLabel: DAY_LABELS[fridayDow],
        time: '20:00',
        count: 3,
      });
    });

    it('empate resolve pelo primeiro padrão inserido (ordem do snapshot)', async () => {
      mockGetDocs.mockResolvedValue(
        makeSnapshot([
          gameDoc(FRIDAY_DATE, '20:00'),
          gameDoc(FRIDAY_DATE, '20:00'),
          gameDoc(FRIDAY_DATE, '19:00'),
          gameDoc(FRIDAY_DATE, '19:00'),
        ]),
      );
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.habitualTime).toEqual({
        dayOfWeek: fridayDow,
        dayLabel: DAY_LABELS[fridayDow],
        time: '20:00',
        count: 2,
      });
    });

    it('retorna null quando nenhum padrão repete (count < 2)', async () => {
      mockGetDocs.mockResolvedValue(
        makeSnapshot([
          gameDoc(FRIDAY_DATE, '20:00'),
          gameDoc(SATURDAY_DATE, '19:00'),
          gameDoc(SATURDAY_DATE, '21:00'),
        ]),
      );
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.habitualTime).toBeNull();
    });

    it('retorna null quando snapshot é vazio', async () => {
      mockGetDocs.mockResolvedValue(makeSnapshot([]));
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.habitualTime).toBeNull();
    });

    it('ignora documentos sem date ou sem time', async () => {
      mockGetDocs.mockResolvedValue(
        makeSnapshot([
          gameDoc(undefined, '20:00'),
          gameDoc(FRIDAY_DATE, undefined),
          gameDoc(FRIDAY_DATE, '20:00'),
          gameDoc(FRIDAY_DATE, '20:00'),
        ]),
      );
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.habitualTime).toEqual({
        dayOfWeek: fridayDow,
        dayLabel: DAY_LABELS[fridayDow],
        time: '20:00',
        count: 2,
      });
    });

    it('retorna null quando todos os documentos são inválidos (sem date/time)', async () => {
      mockGetDocs.mockResolvedValue(
        makeSnapshot([gameDoc(undefined, undefined), gameDoc('somente-date', undefined)]),
      );
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.habitualTime).toBeNull();
    });

    it('deriva dayOfWeek da data local sem shift de fuso', async () => {
      mockGetDocs.mockResolvedValue(
        makeSnapshot([gameDoc(SATURDAY_DATE, '09:00'), gameDoc(SATURDAY_DATE, '09:00')]),
      );
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.habitualTime?.dayOfWeek).toBe(saturdayDow);
      expect(result.current.habitualTime?.dayLabel).toBe(DAY_LABELS[saturdayDow]);
    });
  });

  describe('erros', () => {
    it('propaga a mensagem do erro do Firestore em error', async () => {
      mockGetDocs.mockRejectedValue(new Error('permission denied'));
      const { result } = renderHook(() => useHabitualTime('loc-1'), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.error).toBe('permission denied'));
      expect(result.current.habitualTime).toBeNull();
    });
  });
});