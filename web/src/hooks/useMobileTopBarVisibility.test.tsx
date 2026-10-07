// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  MobileTopBarOverrideContext,
  useHideMobileTopBar,
  type RegisterMobileTopBarOverride,
} from './useMobileTopBarVisibility';

/**
 * Wrapper que injeta o RegisterMobileTopBarOverride no contexto.
 * O holder mutável permite trocar a função de registro entre renders.
 */
const registerHolder: { current: RegisterMobileTopBarOverride | null } = { current: null };

function ContextWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MobileTopBarOverrideContext.Provider value={registerHolder.current}>
      {children}
    </MobileTopBarOverrideContext.Provider>
  );
}

describe('useHideMobileTopBar', () => {
  beforeEach(() => {
    registerHolder.current = null;
  });

  it('registra override ao montar quando habilitado (default)', () => {
    const register = vi.fn(() => vi.fn());
    registerHolder.current = register;
    const { result } = renderHook(() => useHideMobileTopBar(), { wrapper: ContextWrapper });
    expect(result.current).toBeUndefined();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('retorna a função de unregister do provider no unmount', () => {
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    registerHolder.current = register;
    const { unmount } = renderHook(() => useHideMobileTopBar(), { wrapper: ContextWrapper });
    expect(unregister).not.toHaveBeenCalled();
    unmount();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('não registra quando enabled=false', () => {
    const register = vi.fn(() => vi.fn());
    registerHolder.current = register;
    const { unmount } = renderHook(() => useHideMobileTopBar(false), { wrapper: ContextWrapper });
    expect(register).not.toHaveBeenCalled();
    unmount();
    expect(register).not.toHaveBeenCalled();
  });

  it('não lança quando não há provider (contexto null)', () => {
    expect(() => renderHook(() => useHideMobileTopBar())).not.toThrow();
  });

  it('remove o registro quando enabled muda para false (limpeza do efeito)', () => {
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    registerHolder.current = register;
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useHideMobileTopBar(enabled),
      { wrapper: ContextWrapper, initialProps: { enabled: true } },
    );
    expect(register).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('re-registra quando a função de registro do provider muda', () => {
    const unregister1 = vi.fn();
    const unregister2 = vi.fn();
    const register1 = vi.fn(() => unregister1);
    registerHolder.current = register1;
    const { rerender } = renderHook(() => useHideMobileTopBar(), { wrapper: ContextWrapper });
    expect(register1).toHaveBeenCalledTimes(1);

    const register2 = vi.fn(() => unregister2);
    registerHolder.current = register2;
    rerender();
    // Cleanup do efeito antigo + novo registro
    expect(unregister1).toHaveBeenCalledTimes(1);
    expect(register2).toHaveBeenCalledTimes(1);
  });

  it('remove o registro apenas uma vez ao desmontar (sem dupla limpeza)', () => {
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    registerHolder.current = register;
    const { unmount, rerender } = renderHook(() => useHideMobileTopBar(), { wrapper: ContextWrapper });
    rerender();
    expect(register).toHaveBeenCalledTimes(1);
    unmount();
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});