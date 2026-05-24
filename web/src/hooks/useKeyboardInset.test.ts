import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardInset } from './useKeyboardInset';

describe('useKeyboardInset', () => {
  const originalVisualViewport = window.visualViewport;
  let handlers: Record<string, () => void>;

  beforeEach(() => {
    handlers = {};
    const mockVv = {
      height: 800,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        handlers[event] = handler;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'visualViewport', {
      value: mockVv,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      value: originalVisualViewport,
      writable: true,
      configurable: true,
    });
  });

  it('retorna 0 quando teclado está fechado', () => {
    window.innerHeight = 900;
    window.visualViewport!.height = 900;
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it('retorna altura correta quando teclado está visível', () => {
    window.innerHeight = 900;
    window.visualViewport!.height = 600;
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(300);
  });

  it('atualiza altura no evento resize', () => {
    window.innerHeight = 900;
    window.visualViewport!.height = 900;
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);

    act(() => {
      window.visualViewport!.height = 500;
      handlers.resize();
    });

    expect(result.current).toBe(400);
  });

  it('remove event listeners no unmount', () => {
    const removeSpy = vi.spyOn(window.visualViewport!, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardInset());
    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(2);
  });

  it('usa Math.max para evitar valores negativos', () => {
    window.innerHeight = 800;
    window.visualViewport!.height = 900;
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it('registra listeners de resize e scroll', () => {
    const addSpy = vi.spyOn(window.visualViewport!, 'addEventListener');
    renderHook(() => useKeyboardInset());
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
