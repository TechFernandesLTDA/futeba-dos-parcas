// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockNavigate = vi.fn();
const locationHolder = { key: 'entry-1', pathname: '/groups/abc' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => locationHolder,
}));

const mockGetSectionFallback = vi.fn();

vi.mock('../config/navItems', () => ({
  getSectionFallback: (...args: unknown[]) => mockGetSectionFallback(...args),
}));

import { useNavigateBack, useNavigateWithCallback } from './useNavigateBack';

/** jsdom: history.length é getter — sobrescrevemos por teste e restauramos. */
function setHistoryLength(length: number) {
  Object.defineProperty(window.history, 'length', {
    value: length,
    configurable: true,
    writable: true,
  });
}

describe('useNavigateBack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationHolder.key = 'entry-1';
    locationHolder.pathname = '/groups/abc';
    setHistoryLength(3);
    mockGetSectionFallback.mockReturnValue('/?tab=1');
  });

  afterEach(() => {
    // remove a propriedade da instância; getter do prototype volta a valer
    delete (window.history as unknown as Record<string, unknown>).length;
  });

  it('chama navigate(-1) quando há history real', () => {
    const { result } = renderHook(() => useNavigateBack());
    act(() => result.current());
    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockGetSectionFallback).not.toHaveBeenCalled();
  });

  it('usa fallback explícito quando key é "default" (primeira entrada na sessão)', () => {
    locationHolder.key = 'default';
    const { result } = renderHook(() => useNavigateBack('/fallback/seguro'));
    act(() => result.current());
    expect(mockNavigate).toHaveBeenCalledWith('/fallback/seguro', { replace: true });
    expect(mockGetSectionFallback).not.toHaveBeenCalled();
  });

  it('deriva fallback da seção quando key é "default" e fallback omitido', () => {
    locationHolder.key = 'default';
    locationHolder.pathname = '/weekly-ranking';
    const { result } = renderHook(() => useNavigateBack());
    act(() => result.current());
    expect(mockGetSectionFallback).toHaveBeenCalledWith('/weekly-ranking');
    expect(mockNavigate).toHaveBeenCalledWith('/?tab=1', { replace: true });
  });

  it('força fallback quando window.history.length <= 1 mesmo com key real', () => {
    setHistoryLength(1);
    const { result } = renderHook(() => useNavigateBack('/fallback/seguro'));
    act(() => result.current());
    expect(mockNavigate).toHaveBeenCalledWith('/fallback/seguro', { replace: true });
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  it('fallback explícito tem prioridade sobre o fallback da seção', () => {
    locationHolder.key = 'default';
    const { result } = renderHook(() => useNavigateBack('/meu-destino'));
    act(() => result.current());
    expect(mockNavigate).toHaveBeenCalledWith('/meu-destino', { replace: true });
    expect(mockGetSectionFallback).not.toHaveBeenCalled();
  });

  it('usa replace:true no fallback (não empilha entrada no history)', () => {
    locationHolder.key = 'default';
    const { result } = renderHook(() => useNavigateBack());
    act(() => result.current());
    expect(mockNavigate).toHaveBeenCalledWith('/?tab=1', { replace: true });
  });

  it('recompute do callback quando o pathname muda (fallback da nova seção)', () => {
    const { result, rerender } = renderHook(() => useNavigateBack());
    locationHolder.key = 'default';
    locationHolder.pathname = '/badges';
    rerender();
    act(() => result.current());
    expect(mockGetSectionFallback).toHaveBeenLastCalledWith('/badges');
  });

  it('dispara fallback da seção quando history.length === 0 (edge)', () => {
    setHistoryLength(0);
    const { result } = renderHook(() => useNavigateBack());
    act(() => result.current());
    expect(mockNavigate).toHaveBeenCalledWith('/?tab=1', { replace: true });
  });

  it('callback é estável enquanto location e fallback não mudam', () => {
    const { result, rerender } = renderHook(() => useNavigateBack('/fixo'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('useNavigateWithCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navega para o destino e executa o callback', () => {
    const { result } = renderHook(() => useNavigateWithCallback());
    const callback = vi.fn();
    act(() => result.current('/group/123', callback));
    expect(mockNavigate).toHaveBeenCalledWith('/group/123');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('executa o callback somente após o navigate (ordem garantida)', () => {
    const { result } = renderHook(() => useNavigateWithCallback());
    const callback = vi.fn();
    act(() => result.current('/group/123', callback));
    expect(mockNavigate.mock.invocationCallOrder[0]).toBeLessThan(
      callback.mock.invocationCallOrder[0],
    );
  });

  it('não lança quando o callback é omitido', () => {
    const { result } = renderHook(() => useNavigateWithCallback());
    expect(() => act(() => result.current('/home'))).not.toThrow();
    expect(mockNavigate).toHaveBeenCalledWith('/home');
  });

  it('propaga a mesma instância de navigate em renders sucessivos', () => {
    const { result, rerender } = renderHook(() => useNavigateWithCallback());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});