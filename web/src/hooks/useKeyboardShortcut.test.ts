import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcut } from './useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispara callback quando tecla correta é pressionada', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 'Escape' }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('não dispara para tecla errada', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 'Escape' }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('funciona com modificador Ctrl+S', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 's', modifiers: ['ctrl'] }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('funciona com modificador cmd (metaKey)', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 'k', modifiers: ['cmd'] }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignora quando foco está em input se fireInInputs=false', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 'Enter', fireInInputs: false }, callback));

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('dispara mesmo em input quando fireInInputs=true (padrão)', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 'Enter' }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('remove event listener ao desmontar', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut({ key: 'Escape' }, callback));

    unmount();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('funciona com shift como modificador', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 'N', modifiers: ['shift'] }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', shiftKey: true }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('funciona com combinação múltipla de modificadores', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 'I', modifiers: ['shift', 'alt'] }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'I', shiftKey: true, altKey: true }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('não dispara se modificador obrigatório estiver faltando', () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut({ key: 's', modifiers: ['ctrl'] }, callback));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: false }));

    expect(callback).not.toHaveBeenCalled();
  });
});
