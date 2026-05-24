import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextMenu } from './useContextMenu';

const mockItems = [
  { id: 'edit', label: 'Editar', onClick: vi.fn() },
  { id: 'delete', label: 'Excluir', onClick: vi.fn(), color: 'error' as const },
];

describe('useContextMenu', () => {
  it('anchorPosition é null inicialmente', () => {
    const { result } = renderHook(() => useContextMenu(mockItems));
    expect(result.current.anchorPosition).toBeNull();
  });

  it('handleContextMenu abre no ponto do cursor', () => {
    const { result } = renderHook(() => useContextMenu(mockItems));
    const event = { clientY: 100, clientX: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => {
      result.current.handleContextMenu(event);
    });
    expect(result.current.anchorPosition).toEqual({ top: 100, left: 200 });
  });

  it('handleContextMenu previne default', () => {
    const { result } = renderHook(() => useContextMenu(mockItems));
    const preventDefault = vi.fn();
    const event = { clientY: 0, clientX: 0, preventDefault } as unknown as React.MouseEvent;
    act(() => {
      result.current.handleContextMenu(event);
    });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('handleClose fecha o menu', () => {
    const { result } = renderHook(() => useContextMenu(mockItems));
    act(() => {
      result.current.handleContextMenu({ clientY: 100, clientX: 200, preventDefault: vi.fn() } as unknown as React.MouseEvent);
    });
    expect(result.current.anchorPosition).not.toBeNull();
    act(() => {
      result.current.handleClose();
    });
    expect(result.current.anchorPosition).toBeNull();
  });

  it('handleItemClick executa onClick e fecha menu', () => {
    const { result } = renderHook(() => useContextMenu(mockItems));
    act(() => {
      result.current.handleItemClick(mockItems[0]);
    });
    expect(mockItems[0].onClick).toHaveBeenCalledTimes(1);
    expect(result.current.anchorPosition).toBeNull();
  });

  it('visibleItems filtra itens hidden', () => {
    const items = [
      { id: 'a', label: 'A', onClick: vi.fn() },
      { id: 'b', label: 'B', onClick: vi.fn(), hidden: true },
    ];
    const { result } = renderHook(() => useContextMenu(items));
    expect(result.current.visibleItems).toHaveLength(1);
    expect(result.current.visibleItems[0].id).toBe('a');
  });

  it('não abre menu quando todos os itens são hidden', () => {
    const items = [
      { id: 'a', label: 'A', onClick: vi.fn(), hidden: true },
    ];
    const { result } = renderHook(() => useContextMenu(items));
    const preventDefault = vi.fn();
    act(() => {
      result.current.handleContextMenu({ clientY: 100, clientX: 200, preventDefault } as unknown as React.MouseEvent);
    });
    expect(result.current.anchorPosition).toBeNull();
  });

  it('não executa onClick quando item está disabled', () => {
    const onClick = vi.fn();
    const items = [
      { id: 'a', label: 'A', onClick, disabled: true },
    ];
    const { result } = renderHook(() => useContextMenu(items));
    act(() => {
      result.current.handleItemClick(items[0]);
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('handleKeyboardContextMenu abre com Shift+F10', () => {
    const { result } = renderHook(() => useContextMenu(mockItems));
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ bottom: 300, left: 100, top: 200, right: 400, width: 300, height: 100 } as DOMRect);
    const event = { key: 'F10', shiftKey: true, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyboardContextMenu(event, el);
    });
    expect(result.current.anchorPosition).toEqual({ top: 300, left: 100 });
  });
});
