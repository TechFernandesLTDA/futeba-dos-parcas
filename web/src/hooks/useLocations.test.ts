/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// Mocks
const mockOnSnapshot = vi.fn();
const mockGetDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

import { useLocations, useLocationDetail } from './useLocations';

describe('useLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('configura listener na coleção locations', () => {
    renderHook(() => useLocations(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'locations');
  });

  it('ordena locais por nome (asc)', () => {
    renderHook(() => useLocations(), { wrapper: createTestWrapper() });
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
  });

  it('retorna lista de locais do snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          {
            id: 'loc-1',
            data: () => ({ name: 'Campo do Zé', address: 'Rua A, 123', rating: 4.5 }),
          },
          {
            id: 'loc-2',
            data: () => ({ name: 'Arena Parças', address: 'Av. B, 456', rating: 4.0 }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.locations).toHaveLength(2);
    expect(result.current.locations[0].id).toBe('loc-1');
  });

  it('trata erros do snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any, onError: any) => {
      onError(new Error('Location error'));
      return vi.fn();
    });

    const { result } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('Location error');
      expect(result.current.loading).toBe(false);
    });
  });

  it('remove listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('useLocationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  it('retorna loading=false para locationId undefined', async () => {
    const { result } = renderHook(() => useLocationDetail(undefined), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.location).toBeNull();
  });

  it('busca local específico por ID', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'loc-1',
      data: () => ({ name: 'Campo do Zé', address: 'Rua A, 123', latitude: -23.5, longitude: -46.6 }),
    });

    const { result } = renderHook(() => useLocationDetail('loc-1'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.location).not.toBeNull();
    expect(result.current.location?.id).toBe('loc-1');
  });

  it('trata erros ao buscar local', async () => {
    mockGetDoc.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useLocationDetail('loc-invalid'), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('Not found');
      expect(result.current.loading).toBe(false);
    });
  });
});
