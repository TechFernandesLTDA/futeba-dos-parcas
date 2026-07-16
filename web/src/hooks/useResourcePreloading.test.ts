import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizePrefetchRoute, usePrefetchOnHover } from './useResourcePreloading';

function eventFor(element: HTMLElement) {
  return { currentTarget: element };
}

describe('usePrefetchOnHover', () => {
  const prefetch = vi.fn().mockResolvedValue(undefined);
  let element: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    prefetch.mockClear();
    element = document.createElement('button');
    element.dataset.prefetchRoute = '/statistics';
  });

  it('normaliza tabs da Home para o chunk da rota raiz', () => {
    expect(normalizePrefetchRoute('/?tab=1')).toBe('/');
    expect(normalizePrefetchRoute('/?tab=4#profile')).toBe('/');
    expect(normalizePrefetchRoute('/statistics?period=month')).toBe('/statistics');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aguarda 100 ms antes de antecipar um hover persistente', () => {
    const { result } = renderHook(() => usePrefetchOnHover(prefetch));

    act(() => result.current.onMouseEnter(eventFor(element) as never));
    act(() => vi.advanceTimersByTime(99));
    expect(prefetch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(prefetch).toHaveBeenCalledWith('/statistics');
  });

  it('cancela hover breve e antecipa foco imediatamente', () => {
    const { result } = renderHook(() => usePrefetchOnHover(prefetch));

    act(() => result.current.onMouseEnter(eventFor(element) as never));
    act(() => result.current.onMouseLeave());
    act(() => vi.advanceTimersByTime(100));
    expect(prefetch).not.toHaveBeenCalled();

    act(() => result.current.onFocus(eventFor(element) as never));
    expect(prefetch).toHaveBeenCalledWith('/statistics');
  });

  it('cancela o timer pendente ao desmontar', () => {
    const { result, unmount } = renderHook(() => usePrefetchOnHover(prefetch));

    act(() => result.current.onMouseEnter(eventFor(element) as never));
    unmount();
    act(() => vi.advanceTimersByTime(100));

    expect(prefetch).not.toHaveBeenCalled();
  });
});
