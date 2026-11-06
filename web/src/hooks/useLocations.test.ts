/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// useLocations (#4370) consulta POR CIDADE/UF com cursor — sem orderBy/limit(200).
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] });
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
  ToastProvider: ({ children }: { children: unknown }) => children,
}));
import { useLocations, useLocationDetail, useLocationsByIds } from './useLocations';

const CURITIBA = { city: 'Curitiba', state: 'PR' };

const locationData = (overrides = {}) => ({
  name: 'Campo do Zé',
  address: 'Rua A, 123',
  city: 'Curitiba',
  state: 'PR',
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
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockWhere.mockImplementation((...args) => ({ type: 'where', args }));
    mockLimit.mockImplementation((value) => ({ type: 'limit', value }));
  });

  it('sem cidade definida não consulta o Firestore', () => {
    const { result } = renderHook(() => useLocations(null), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(false);
    expect(result.current.locations).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('retorna loading=true enquanto carrega a cidade', () => {
    const { result } = renderHook(() => useLocations(CURITIBA), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('consulta a coleção locations por cidade e UF, sem orderBy nem limit(200)', async () => {
    const { result } = renderHook(() => useLocations(CURITIBA), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockCollection).toHaveBeenCalledWith({}, 'locations');
    expect(mockWhere).toHaveBeenCalledWith('city', '==', 'Curitiba');
    expect(mockWhere).toHaveBeenCalledWith('state', '==', 'PR');
    expect(mockOrderBy).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalledWith(200);
  });

  it('só filtra por cidade quando a UF é desconhecida', async () => {
    const { result } = renderHook(() => useLocations({ city: 'Curitiba', state: '' }), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockWhere).toHaveBeenCalledWith('city', '==', 'Curitiba');
    expect(mockWhere).not.toHaveBeenCalledWith('state', '==', expect.anything());
  });

  it('retorna as quadras do snapshot (snake_case → camelCase)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'loc-1', data: () => locationData() },
        { id: 'loc-2', data: () => locationData({ name: 'Arena Parças', address: 'Av. B, 456' }) },
      ],
    });

    const { result } = renderHook(() => useLocations(CURITIBA), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations).toHaveLength(2);
    expect(result.current.locations[0]).toMatchObject({ id: 'loc-1', isVerified: true, isActive: true });
  });

  it('inclui rascunhos importados (não verificados) para quem está logado', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'loc-draft',
          data: () => locationData({
            name: 'Quadra Importada',
            is_verified: false,
            publication_status: 'DRAFT',
            owner_id: 'system-venue-import',
            has_active_fields: false,
          }),
        },
      ],
    });

    const { result } = renderHook(() => useLocations(CURITIBA), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations.map((l) => l.id)).toEqual(['loc-draft']);
    expect(result.current.locations[0].isVerified).toBe(false);
  });

  it('esconde quadras suspensas, rejeitadas, inativas ou sem mensalidade válida', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'loc-active', data: () => locationData({ name: 'Arena Ativa' }) },
        { id: 'loc-suspended', data: () => locationData({ publication_status: 'SUSPENDED' }) },
        { id: 'loc-rejected', data: () => locationData({ publication_status: 'REJECTED' }) },
        { id: 'loc-overdue', data: () => locationData({ subscription_status: 'OVERDUE' }) },
        { id: 'loc-inactive', data: () => locationData({ is_active: false }) },
      ],
    });

    const { result } = renderHook(() => useLocations(CURITIBA), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations.map((l) => l.id)).toEqual(['loc-active']);
  });

  it('não esconde quadras quando a cidade passa de 300 (pagina por cursor)', async () => {
    const page = (start: number, count: number) => ({
      docs: Array.from({ length: count }, (_, i) => ({
        id: `loc-${start + i}`,
        data: () => locationData({ name: `Quadra ${start + i}` }),
      })),
    });
    mockGetDocs
      .mockResolvedValueOnce(page(0, 300))
      .mockResolvedValueOnce(page(300, 40));

    const { result } = renderHook(() => useLocations(CURITIBA), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations).toHaveLength(340);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('trata erros da query', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Location error'));

    const { result } = renderHook(() => useLocations(CURITIBA), { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(result.current.error).toBe('Location error');
      expect(result.current.loading).toBe(false);
    });
  });
});

describe('useLocationsByIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((_db, _col, id) => `ref-${id}`);
  });

  it('busca cada quadra por id sem repetir e ignora as inexistentes', async () => {
    mockGetDoc.mockImplementation(async (ref: string) => ref === 'ref-gone'
      ? { exists: () => false }
      : { exists: () => true, id: ref.replace('ref-', ''), data: () => locationData({ name: ref }) });

    const { result } = renderHook(
      () => useLocationsByIds(['a', 'b', 'a', '', 'gone']),
      { wrapper: createTestWrapper() },
    );

    await waitFor(() => expect(result.current.map((l) => l.id).sort()).toEqual(['a', 'b']));
    expect(mockGetDoc).toHaveBeenCalledTimes(3);
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
