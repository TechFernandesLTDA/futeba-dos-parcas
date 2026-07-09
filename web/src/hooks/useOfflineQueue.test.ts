import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockDoc = vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id }));
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args as [unknown, string, string]),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  limit: vi.fn((...args) => args[0]),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

// mockNetworkOnline reservado para compatibilidade — não usado diretamente.
// O hook useNetworkStatus real é usado (tem event listeners para re-render). #2330
const mockNetworkOnline = { value: true };

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { useOfflineQueue } from './useOfflineQueue';

describe('useOfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockNetworkOnline.value = true; // reset para online por padrão
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('inicia com fila vazia e online', () => {
    const { result } = renderHook(() => useOfflineQueue());
    expect(result.current.queueLength).toBe(0);
    expect(result.current.isOnline).toBe(true);
    expect(result.current.processing).toBe(false);
  });

  it('enfileira ação quando offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useOfflineQueue());
    act(() => {
      result.current.enqueue({ collection: 'games', operation: 'set', data: { name: 'test' }, docId: 'doc-1' });
    });
    expect(result.current.queueLength).toBe(1);
  });

  it('enfileira múltiplas ações em FIFO', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useOfflineQueue());
    act(() => {
      result.current.enqueue({ collection: 'games', operation: 'set', data: { name: 'A' }, docId: '1' });
    });
    act(() => {
      result.current.enqueue({ collection: 'games', operation: 'set', data: { name: 'B' }, docId: '2' });
    });
    expect(result.current.queueLength).toBe(2);
  });

  it('persiste fila no localStorage (async — aguarda encriptação)', async () => {
    // A fila é salva via crypto.subtle (AES-GCM) de forma assíncrona.
    // setDoc nunca resolve → processQueue fica pendente → item permanece na fila → saveQueue salva. #2330
    mockSetDoc.mockReturnValue(new Promise(() => {})); // never resolves
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const { result } = renderHook(() => useOfflineQueue());

    // Aguardar loadQueue completar (queueLoaded=true) antes de enqueue
    await waitFor(() => {
      expect(result.current.queueLength).toBe(0);
    });

    act(() => {
      result.current.enqueue({ collection: 'games', operation: 'set', data: { x: 1 }, docId: '1' });
    });

    // Após enqueue, saveQueue é chamado pelo useEffect — aguardar persistência
    await waitFor(() => {
      expect(localStorage.getItem('offline_write_queue')).not.toBeNull();
    }, { timeout: 5000 });

    const raw = localStorage.getItem('offline_write_queue');
    expect(typeof raw).toBe('string');
    expect(raw!.length).toBeGreaterThan(0);
  });

  it('processa fila quando volta a ficar online', async () => {
    // Iniciar offline para enfileirar sem processar imediatamente. #2330
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const { result } = renderHook(() => useOfflineQueue());
    act(() => {
      result.current.enqueue({ collection: 'games', operation: 'set', data: { name: 'sync' }, docId: 'doc-1' });
    });
    expect(result.current.queueLength).toBe(1);
    mockSetDoc.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  it('retorna id único para cada ação enfileirada', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useOfflineQueue());
    let id1: string, id2: string;
    act(() => {
      id1 = result.current.enqueue({ collection: 'games', operation: 'set', data: { a: 1 }, docId: '1' });
    });
    act(() => {
      id2 = result.current.enqueue({ collection: 'games', operation: 'set', data: { b: 2 }, docId: '2' });
    });
    expect(id1!).not.toBe(id2!);
  });

  it('reagenda flush quando uma mutação falha e depois volta a funcionar', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    mockSetDoc
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queueLength).toBe(0);
    });

    act(() => {
      result.current.enqueue({ collection: 'games', operation: 'set', data: { name: 'retry' }, docId: 'doc-1' });
    });

    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
      expect(result.current.queueLength).toBe(0);
    });
  });

  it('torna operações add idempotentes ao reutilizar o mesmo docId no retry', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    mockSetDoc
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queueLength).toBe(0);
    });

    act(() => {
      result.current.enqueue({ collection: 'feedback', operation: 'add', data: { message: 'hello' } });
    });

    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
    });

    const firstDocRef = mockSetDoc.mock.calls[0][0] as { collectionName: string; id: string };
    const secondDocRef = mockSetDoc.mock.calls[1][0] as { collectionName: string; id: string };

    expect(firstDocRef.collectionName).toBe('feedback');
    expect(firstDocRef.id).toBe(secondDocRef.id);
  });
});
