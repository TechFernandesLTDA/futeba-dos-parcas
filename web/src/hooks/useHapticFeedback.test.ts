import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHapticFeedback, type HapticPattern } from './useHapticFeedback';

/**
 * Stub do navigator.vibrate — jsdom pode ou não expor vibrate nativamente;
 * sobrescrevemos com propriedade configurável e restauramos o descritor
 * original no afterEach.
 */
type VibrateFn = (pattern: number | number[]) => boolean;

const originalVibrate = Object.getOwnPropertyDescriptor(window.navigator, 'vibrate')
  ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window.navigator), 'vibrate');
const originalMatchMedia = window.matchMedia;

function installVibrate(impl?: VibrateFn) {
  Object.defineProperty(window.navigator, 'vibrate', {
    value: impl ?? vi.fn(() => true),
    configurable: true,
    writable: true,
  });
}

function removeVibrate() {
  // removeProperty na instância; se vibrate vier do prototype, o descriptor
  // da instância é deletado e o prototype volta a valer.
  delete (window.navigator as unknown as Record<string, unknown>).vibrate;
}

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('useHapticFeedback', () => {
  beforeEach(() => {
    installVibrate();
    setReducedMotion(false);
  });

  afterEach(() => {
    if (originalVibrate) {
      Object.defineProperty(window.navigator, 'vibrate', originalVibrate);
    } else {
      removeVibrate();
    }
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('dispara vibração leve quando nenhum padrão é informado (default light)', () => {
    const { result } = renderHook(() => useHapticFeedback());
    act(() => result.current.trigger());
    expect(window.navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('mapeia cada padrão para a duração/sequência correta', () => {
    const { result } = renderHook(() => useHapticFeedback());
    const expected: Array<[HapticPattern, number | number[]]> = [
      ['light', 10],
      ['medium', 25],
      ['heavy', 50],
      ['success', [40, 30, 40]],
      ['error', [60, 40, 60, 40, 60]],
    ];
    for (const [pattern, expectedValue] of expected) {
      act(() => result.current.trigger(pattern));
      expect(window.navigator.vibrate).toHaveBeenLastCalledWith(expectedValue);
    }
  });

  it('não vibra quando o usuário prefere menos movimento (prefers-reduced-motion)', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useHapticFeedback());
    act(() => result.current.trigger('heavy'));
    expect(window.navigator.vibrate).not.toHaveBeenCalled();
  });

  it('é silencioso quando navigator.vibrate não existe (iOS Safari)', () => {
    removeVibrate();
    const { result } = renderHook(() => useHapticFeedback());
    expect(() => act(() => result.current.trigger('success'))).not.toThrow();
  });

  it('engole exceção lançada por navigator.vibrate (navegadores embarcados)', () => {
    installVibrate(() => {
      throw new Error('vibrate not allowed');
    });
    const { result } = renderHook(() => useHapticFeedback());
    expect(() => act(() => result.current.trigger('error'))).not.toThrow();
  });

  it('retorna false (respeita assinatura) sem afetar o caller', () => {
    installVibrate(vi.fn(() => false));
    const { result } = renderHook(() => useHapticFeedback());
    act(() => result.current.trigger('light'));
    expect(window.navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('trigger é estável entre renders (referência preservada)', () => {
    const { result, rerender } = renderHook(() => useHapticFeedback());
    const first = result.current.trigger;
    rerender();
    expect(result.current.trigger).toBe(first);
  });

  it('cada chamada dispara exatamente uma vibração com o padrão pedido', () => {
    const { result } = renderHook(() => useHapticFeedback());
    act(() => result.current.trigger('light'));
    act(() => result.current.trigger('heavy'));
    expect(window.navigator.vibrate).toHaveBeenCalledTimes(2);
    expect(window.navigator.vibrate).toHaveBeenNthCalledWith(1, 10);
    expect(window.navigator.vibrate).toHaveBeenNthCalledWith(2, 50);
  });
});