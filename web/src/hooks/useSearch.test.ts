/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mocks
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  limit: (...args: any[]) => mockLimit(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

import { useSearch } from './useSearch';

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockWhere.mockReturnValue('mock-where');
    mockLimit.mockReturnValue('mock-limit');
  });

  it('retorna resultados vazios inicialmente', () => {
    const { result } = renderHook(() => useSearch(''));
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('não busca com query vazia', async () => {
    renderHook(() => useSearch(''));
    // Aguardar possível debounce
    await new Promise((r) => setTimeout(r, 400));
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('não busca com query de espaços em branco', async () => {
    renderHook(() => useSearch('   '));
    await new Promise((r) => setTimeout(r, 400));
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('busca usuários por prefixo do nome', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'user-1',
          data: () => ({ name: 'João Silva', level: 5, photo_url: null }),
        },
      ],
    });

    const { result } = renderHook(() => useSearch('João', 'users'));

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    }, { timeout: 3000 });

    expect(result.current.results[0]).toEqual(
      expect.objectContaining({
        id: 'user-1',
        type: 'user',
        name: 'João Silva',
      })
    );
  });

  it('busca grupos por prefixo do nome', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'group-1',
          data: () => ({ name: 'Pelada da Sexta', member_count: 12 }),
        },
      ],
    });

    const { result } = renderHook(() => useSearch('Pelada', 'groups'));

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    }, { timeout: 3000 });

    expect(result.current.results[0]).toEqual(
      expect.objectContaining({
        id: 'group-1',
        type: 'group',
        name: 'Pelada da Sexta',
      })
    );
  });

  it('busca usuários e grupos quando type é "all"', async () => {
    let callCount = 0;
    mockGetDocs.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          docs: [{ id: 'user-1', data: () => ({ name: 'Test User', level: 3 }) }],
        });
      }
      return Promise.resolve({
        docs: [{ id: 'group-1', data: () => ({ name: 'Test Group', member_count: 5 }) }],
      });
    });

    const { result } = renderHook(() => useSearch('Test', 'all'));

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    }, { timeout: 3000 });

    const types = result.current.results.map((r) => r.type);
    expect(types).toContain('user');
    expect(types).toContain('group');
  });

  it('trata erros de busca', async () => {
    mockGetDocs.mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(() => useSearch('Test', 'users'));

    await waitFor(() => {
      expect(result.current.error).toBe('Search failed');
    }, { timeout: 3000 });
  });

  it('aplica limit de 10 na query', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    renderHook(() => useSearch('Test', 'users'));

    await waitFor(() => {
      expect(mockLimit).toHaveBeenCalledWith(10);
    }, { timeout: 3000 });
  });

  it('limpa resultados quando query muda para vazio', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'user-1', data: () => ({ name: 'Test', level: 1 }) }],
    });

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useSearch(q, 'users'),
      { initialProps: { q: 'Test' } }
    );

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    }, { timeout: 3000 });

    rerender({ q: '' });

    await waitFor(() => {
      expect(result.current.results).toEqual([]);
    });
  });
});
