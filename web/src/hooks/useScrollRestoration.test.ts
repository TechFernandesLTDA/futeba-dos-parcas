import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollRestoration } from './useScrollRestoration';

const mockLocation = { pathname: '/home' };

vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
}));

describe('useScrollRestoration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.scrollTo = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('não chama scrollTo quando não há posição salva', () => {
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('restaura scroll salvo quando existe posição', () => {
    sessionStorage.setItem('scroll-positions', JSON.stringify({ '/home': 150 }));
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 150);
  });

  it('restaura scroll para zero quando posição é zero', () => {
    sessionStorage.setItem('scroll-positions', JSON.stringify({ '/home': 0 }));
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('lida com JSON corrompido no sessionStorage', () => {
    sessionStorage.setItem('scroll-positions', 'invalid-json');
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('não quebra com sessionStorage vazio', () => {
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('não restaura novamente para mesmo pathname', () => {
    sessionStorage.setItem('scroll-positions', JSON.stringify({ '/home': 150 }));
    const { rerender } = renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    mockLocation.pathname = '/home';
    rerender();
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });
});
