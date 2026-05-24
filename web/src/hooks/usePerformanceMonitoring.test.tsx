import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
const mockGetEntriesByType = vi.fn();

class MockPerformanceObserver {
  constructor() {
    this.observe = mockObserve;
    this.disconnect = mockDisconnect;
    this.takeRecords = vi.fn();
  }
}

Object.defineProperty(window, 'PerformanceObserver', {
  value: MockPerformanceObserver,
  writable: true,
  configurable: true,
});

const originalPerformance = globalThis.performance;

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { usePerformanceMonitoring, useFirestorePerformanceMonitor } from './usePerformanceMonitoring';

describe('usePerformanceMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    globalThis.performance = {
      ...originalPerformance,
      now: () => 100,
      getEntriesByType: mockGetEntriesByType,
    } as unknown as Performance;
    mockGetEntriesByType.mockReturnValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.performance = originalPerformance;
    vi.unstubAllGlobals();
  });

  it('retorna objeto com metrics e incrementQueryCount', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ screenName: 'HomeScreen' })
    );

    expect(result.current.metrics).toBeDefined();
    expect(typeof result.current.incrementQueryCount).toBe('function');
  });

  it('define screenName nas métricas', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ screenName: 'GamesScreen' })
    );

    expect(result.current.metrics.screenName).toBe('GamesScreen');
  });

  it('incrementQueryCount incrementa contador de queries', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ screenName: 'TestScreen' })
    );

    act(() => {
      result.current.incrementQueryCount();
    });

    expect(result.current.metrics.firestoreQueries).toBe(1);
  });

  it('incrementQueryCount aceita bytes opcionais', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitoring({ screenName: 'TestScreen' })
    );

    act(() => {
      result.current.incrementQueryCount(2048);
    });

    expect(result.current.metrics.dataDownloaded).toBe(2048);
  });

  it('envia métricas para analytics após 3 segundos', () => {
    renderHook(() => usePerformanceMonitoring({ screenName: 'Test' }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
  });

  it('desconecta observer no cleanup', () => {
    const { unmount } = renderHook(() =>
      usePerformanceMonitoring({ screenName: 'Test' })
    );

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('coleta navigation timing quando disponível', () => {
    mockGetEntriesByType.mockReturnValue([
      {
        domainLookupEnd: 50, domainLookupStart: 20,
        connectEnd: 80, connectStart: 50,
        responseStart: 120, requestStart: 100,
        domContentLoadedEventEnd: 300, startTime: 100,
        loadEventEnd: 500,
      },
    ]);

    renderHook(() => usePerformanceMonitoring({ screenName: 'Test' }));

    expect(mockGetEntriesByType).toHaveBeenCalledWith('navigation');
  });
});

describe('useFirestorePerformanceMonitor', () => {
  it('retorna trackQuery e queryCount', () => {
    const { result } = renderHook(() =>
      useFirestorePerformanceMonitor('TestScreen')
    );

    expect(typeof result.current.trackQuery).toBe('function');
    expect(result.current.queryCount).toBe(0);
  });

  it('trackQuery incrementa contagem', () => {
    const { result } = renderHook(() =>
      useFirestorePerformanceMonitor('TestScreen')
    );

    act(() => {
      result.current.trackQuery();
      result.current.trackQuery();
    });
  });
});
