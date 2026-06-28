/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// useLocations usa useQuery/getDocs; listener redundante removido em #2933.
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: vi.fn((...args) => args[0]),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }) => children,
}));
import { useLocations, useLocationDetail } from './useLocations';

const activeLocationData = (overrides = {}) => ({
  name: 'Campo do Zé',
  address: 'Rua A, 123',
  rating: 4.5,
  is_active: true,
  is_verified: true,
  publication_status: 'PUBLISHED',
  subscription_status: 'ACTIVE',
  has_active_fields: true,
  ...overrides,
});

describe('useLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('consulta a coleção locations', () => {
    renderHook(() => useLocations(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'locations');
  });

  it('ordena locais por nome (asc)', () => {
    renderHook(() => useLocations(), { wrapper: createTestWrapper() });
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
  });

  it('retorna lista de locais do snapshot', async () => {
    // useLocations usa getDocs via useQuery — simular via mockGetDocs. #2330
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'loc-1',
          data: () => activeLocationData(),
        },
        {
          id: 'loc-2',
          data: () => activeLocationData({
            name: 'Arena Parças',
            address: 'Av. B, 456',
            rating: 4.0,
          }),
        },
      ],
    });

    const { result } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.locations).toHaveLength(2);
    expect(result.current.locations[0].id).toBe('loc-1');
  });

  it('filtra locais suspensos comercialmente', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'loc-active',
          data: () => activeLocationData({ name: 'Arena Ativa' }),
        },
        {
          id: 'loc-suspended',
          data: () => activeLocationData({
            name: 'Arena Suspensa',
            publication_status: 'SUSPENDED',
          }),
        },
        {
          id: 'loc-overdue',
          data: () => activeLocationData({
            name: 'Arena Vencida',
            subscription_status: 'OVERDUE',
          }),
        },
        {
          id: 'loc-no-active-fields',
          data: () => activeLocationData({
            name: 'Arena Sem Quadra Ativa',
            has_active_fields: false,
          }),
        },
      ],
    });

    const { result } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.locations).toHaveLength(1);
    expect(result.current.locations[0].id).toBe('loc-active');
  });

  it('trata erros da query', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Location error'));

    const { result } = renderHook(() => useLocations(), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('Location error');
      expect(result.current.loading).toBe(false);
    });
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
