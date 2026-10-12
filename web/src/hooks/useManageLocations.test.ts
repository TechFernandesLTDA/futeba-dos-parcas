import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Listener { next: (snapshot: unknown) => void; error: (error: Error) => void }
const listeners: Listener[] = [];
const mockOnSnapshot = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockStartAfter = vi.fn();
const unsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'locations-ref'),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  startAfter: (...args: unknown[]) => mockStartAfter(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));
vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import {
  MANAGE_LOCATIONS_MAX_PAGES,
  MANAGE_LOCATIONS_PAGE_SIZE,
  useManageLocations,
} from './useManageLocations';

const doc = (id: string, name = id) => ({ id, data: () => ({ name, city: 'Curitiba', owner_id: 'o1' }) });
const page = (start: number, count: number) => ({
  docs: Array.from({ length: count }, (_, i) => doc(`l${start + i}`)),
});

describe('useManageLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.length = 0;
    mockQuery.mockImplementation((...args: unknown[]) => ({ args }));
    mockWhere.mockImplementation((...args: unknown[]) => ({ type: 'where', args }));
    mockOrderBy.mockImplementation((...args: unknown[]) => ({ type: 'orderBy', args }));
    mockLimit.mockImplementation((value: number) => ({ type: 'limit', value }));
    mockStartAfter.mockImplementation((cursor: unknown) => ({ type: 'startAfter', cursor }));
    mockOnSnapshot.mockImplementation((_query: unknown, next: Listener['next'], error: Listener['error']) => {
      listeners.push({ next, error });
      return unsubscribe;
    });
  });

  it('admin: consulta ordenada por nome, sem filtro de dono', () => {
    renderHook(() => useManageLocations({ isAdmin: true, userId: 'admin-1' }));
    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    expect(mockLimit).toHaveBeenCalledWith(MANAGE_LOCATIONS_PAGE_SIZE);
  });

  it('dono: só as próprias quadras', () => {
    renderHook(() => useManageLocations({ isAdmin: false, userId: 'dono-1' }));
    expect(mockWhere).toHaveBeenCalledWith('owner_id', '==', 'dono-1');
  });

  it('carrega a primeira página, converte snake_case e encerra o loading', async () => {
    const { result } = renderHook(() => useManageLocations({ isAdmin: true, userId: 'a' }));
    expect(result.current.loading).toBe(true);

    act(() => listeners[0].next(page(0, 3)));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.locations.map((l) => l.id)).toEqual(['l0', 'l1', 'l2']);
    expect(result.current.locations[0]).toMatchObject({ ownerId: 'o1', city: 'Curitiba' });
    expect(result.current.loadingMore).toBe(false);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('SEM teto de 200: página cheia dispara a próxima com cursor, e tudo é somado', async () => {
    const { result } = renderHook(() => useManageLocations({ isAdmin: true, userId: 'a' }));
    const full = page(0, MANAGE_LOCATIONS_PAGE_SIZE);

    act(() => listeners[0].next(full));

    await waitFor(() => expect(mockOnSnapshot).toHaveBeenCalledTimes(2));
    expect(mockStartAfter).toHaveBeenCalledWith(full.docs[full.docs.length - 1]);
    expect(result.current.loadingMore).toBe(true);
    expect(result.current.loading).toBe(false);

    act(() => listeners[1].next(page(MANAGE_LOCATIONS_PAGE_SIZE, 40)));

    await waitFor(() => expect(result.current.locations).toHaveLength(MANAGE_LOCATIONS_PAGE_SIZE + 40));
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.truncated).toBe(false);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('atualização em tempo real de uma página não duplica nem perde as outras', async () => {
    const { result } = renderHook(() => useManageLocations({ isAdmin: true, userId: 'a' }));
    act(() => listeners[0].next(page(0, MANAGE_LOCATIONS_PAGE_SIZE)));
    await waitFor(() => expect(listeners).toHaveLength(2));
    act(() => listeners[1].next(page(MANAGE_LOCATIONS_PAGE_SIZE, 2)));

    act(() => listeners[1].next(page(MANAGE_LOCATIONS_PAGE_SIZE, 1))); // uma quadra foi excluída

    await waitFor(() => expect(result.current.locations).toHaveLength(MANAGE_LOCATIONS_PAGE_SIZE + 1));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('avisa (não esconde em silêncio) ao atingir o teto de segurança de páginas', async () => {
    const { result } = renderHook(() => useManageLocations({ isAdmin: true, userId: 'a' }));
    for (let index = 0; index < MANAGE_LOCATIONS_MAX_PAGES; index++) {
      await waitFor(() => expect(listeners).toHaveLength(index + 1));
      act(() => listeners[index].next(page(index * MANAGE_LOCATIONS_PAGE_SIZE, MANAGE_LOCATIONS_PAGE_SIZE)));
    }
    await waitFor(() => expect(result.current.truncated).toBe(true));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(MANAGE_LOCATIONS_MAX_PAGES);
  });

  it('erro de leitura aparece em error e encerra o loading', async () => {
    const { result } = renderHook(() => useManageLocations({ isAdmin: true, userId: 'a' }));
    act(() => listeners[0].error(new Error('permission-denied')));
    await waitFor(() => expect(result.current.error?.message).toBe('permission-denied'));
    expect(result.current.loading).toBe(false);
  });

  it('desmontar cancela todas as assinaturas; reloadKey recomeça do zero', async () => {
    const { rerender, unmount } = renderHook(
      ({ reloadKey }: { reloadKey: number }) => useManageLocations({ isAdmin: true, userId: 'a', reloadKey }),
      { initialProps: { reloadKey: 0 } },
    );
    act(() => listeners[0].next(page(0, MANAGE_LOCATIONS_PAGE_SIZE)));
    await waitFor(() => expect(listeners).toHaveLength(2));

    rerender({ reloadKey: 1 });
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(3);
  });

  it('respostas de assinaturas já canceladas são ignoradas', async () => {
    const { result, rerender } = renderHook(
      ({ reloadKey }: { reloadKey: number }) => useManageLocations({ isAdmin: true, userId: 'a', reloadKey }),
      { initialProps: { reloadKey: 0 } },
    );
    const stale = listeners[0];
    rerender({ reloadKey: 1 });
    act(() => stale.next(page(0, 5)));
    expect(result.current.locations).toEqual([]);
  });
});
