import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion', () => {
  let listeners: Array<(e: { matches: boolean }) => void>;
  let matchMediaOriginal: typeof window.matchMedia;

  beforeEach(() => {
    listeners = [];
    matchMediaOriginal = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  function setupMatchMedia(matches: boolean) {
    window.matchMedia = ((_query: string) => ({
      matches: _query === '(prefers-reduced-motion: reduce)' ? matches : false,
      addEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
        listeners.push(handler);
      },
      removeEventListener: vi.fn(),
    })) as typeof window.matchMedia;
  }

  it('retorna true quando preferência é reduce', () => {
    setupMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('retorna false quando preferência não é reduce', () => {
    setupMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('atualiza quando preferência muda', () => {
    setupMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((l) => l({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it('remove listener no unmount', () => {
    const removeSpy = vi.fn();
    window.matchMedia = ((_query: string) => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: removeSpy,
    })) as typeof window.matchMedia;

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('lida com matchMedia retornando matches false', () => {
    setupMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
