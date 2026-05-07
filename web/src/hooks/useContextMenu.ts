import React, { useState, useCallback, MouseEvent, KeyboardEvent } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  hidden?: boolean;
  disabled?: boolean;
  color?: 'default' | 'error' | 'warning';
}

export interface UseContextMenuReturn {
  anchorPosition: { top: number; left: number } | null;
  handleContextMenu: (event: MouseEvent) => void;
  handleKeyboardContextMenu: (event: KeyboardEvent, anchorEl: HTMLElement | null) => void;
  handleClose: () => void;
  handleItemClick: (item: ContextMenuItem) => void;
  visibleItems: ContextMenuItem[];
}

/**
 * Hook para menu de contexto acessivel.
 * - Right-click: abre no ponto do cursor
 * - Shift+F10: abre na borda inferior do elemento (WCAG 2.1.1)
 */
export function useContextMenu(items: ContextMenuItem[]): UseContextMenuReturn {
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | null>(null);

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      const hasVisible = items.some((item) => !item.hidden);
      if (!hasVisible) return;
      setAnchorPosition({ top: event.clientY, left: event.clientX });
    },
    [items],
  );

  const handleKeyboardContextMenu = useCallback(
    (event: KeyboardEvent, anchorEl: HTMLElement | null) => {
      if (event.key === 'F10' && event.shiftKey) {
        event.preventDefault();
        const hasVisible = items.some((item) => !item.hidden);
        if (!hasVisible) return;
        if (anchorEl) {
          const rect = anchorEl.getBoundingClientRect();
          setAnchorPosition({ top: rect.bottom, left: rect.left });
        } else {
          setAnchorPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
        }
      }
    },
    [items],
  );

  const handleClose = useCallback(() => setAnchorPosition(null), []);

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (!item.disabled) item.onClick();
    setAnchorPosition(null);
  }, []);

  const visibleItems = items.filter((item) => !item.hidden);

  return {
    anchorPosition,
    handleContextMenu,
    handleKeyboardContextMenu,
    handleClose,
    handleItemClick,
    visibleItems,
  };
}
