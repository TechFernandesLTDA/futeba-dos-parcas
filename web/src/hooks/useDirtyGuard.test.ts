import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDirtyGuard } from './useDirtyGuard';

describe('useDirtyGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('isBlocked é false inicialmente', () => {
    const { result } = renderHook(() => useDirtyGuard(false));
    expect(result.current.isBlocked).toBe(false);
  });

  it('attemptClose executa callback imediatamente quando não dirty', () => {
    const { result } = renderHook(() => useDirtyGuard(false));
    const callback = vi.fn();
    result.current.attemptClose(callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(result.current.isBlocked).toBe(false);
  });

  it('attemptClose bloqueia quando dirty', () => {
    const { result } = renderHook(() => useDirtyGuard(true));
    const callback = vi.fn();
    act(() => {
      result.current.attemptClose(callback);
    });
    expect(callback).not.toHaveBeenCalled();
    expect(result.current.isBlocked).toBe(true);
  });

  it('proceed executa a ação pendente', () => {
    const { result } = renderHook(() => useDirtyGuard(true));
    const callback = vi.fn();
    act(() => {
      result.current.attemptClose(callback);
    });
    act(() => {
      result.current.proceed();
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(result.current.isBlocked).toBe(false);
  });

  it('cancel descarta a tentativa', () => {
    const { result } = renderHook(() => useDirtyGuard(true));
    const callback = vi.fn();
    act(() => {
      result.current.attemptClose(callback);
    });
    act(() => {
      result.current.cancel();
    });
    expect(callback).not.toHaveBeenCalled();
    expect(result.current.isBlocked).toBe(false);
  });

  it('registra beforeunload quando dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useDirtyGuard(true));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });

  it('remove beforeunload quando deixa de ser dirty', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { rerender } = renderHook(({ isDirty }) => useDirtyGuard(isDirty), {
      initialProps: { isDirty: true },
    });
    rerender({ isDirty: false });
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('permite múltiplas tentativas sequenciais', () => {
    const { result } = renderHook(() => useDirtyGuard(true));
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    act(() => { result.current.attemptClose(cb1); });
    act(() => { result.current.cancel(); });
    expect(cb1).not.toHaveBeenCalled();
    act(() => { result.current.attemptClose(cb2); });
    act(() => { result.current.proceed(); });
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('não bloqueia quando isDirty muda para false', () => {
    const { result, rerender } = renderHook(
      ({ isDirty }) => useDirtyGuard(isDirty),
      { initialProps: { isDirty: true } },
    );
    rerender({ isDirty: false });
    const callback = vi.fn();
    result.current.attemptClose(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
