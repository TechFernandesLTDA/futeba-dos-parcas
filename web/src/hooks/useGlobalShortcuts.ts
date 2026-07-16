import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseGlobalShortcutsOptions {
  paletteOpen: boolean;
  onOpenPalette: () => void;
  onClosePalette: () => void;
  shortcutsOpen: boolean;
  onOpenShortcuts: () => void;
  onCloseShortcuts: () => void;
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.isContentEditable;
}

/** Registra os atalhos uma vez e lê o estado atual dos diálogos por refs. */
export function useGlobalShortcuts({
  paletteOpen,
  onOpenPalette,
  onClosePalette,
  shortcutsOpen,
  onOpenShortcuts,
  onCloseShortcuts,
}: UseGlobalShortcutsOptions) {
  const navigate = useNavigate();
  const paletteOpenRef = useRef(paletteOpen);
  const shortcutsOpenRef = useRef(shortcutsOpen);

  useEffect(() => {
    paletteOpenRef.current = paletteOpen;
    shortcutsOpenRef.current = shortcutsOpen;
  }, [paletteOpen, shortcutsOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const commandKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (commandKey && key === 'k') {
        event.preventDefault();
        if (paletteOpenRef.current) onClosePalette();
        else onOpenPalette();
        return;
      }

      if (commandKey && event.shiftKey && key === 'n') {
        event.preventDefault();
        navigate('/group/create');
        return;
      }

      if (commandKey && key === 'n') {
        event.preventDefault();
        navigate('/game/create');
        return;
      }

      if (commandKey && key === ',') {
        event.preventDefault();
        navigate('/settings');
        return;
      }

      if (event.key === '?' && !event.altKey && !commandKey) {
        event.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (event.key === 'Escape' && shortcutsOpenRef.current) {
        onCloseShortcuts();
      }
    };

    const handleOpenShortcuts = () => onOpenShortcuts();
    const handleOpenPalette = () => onOpenPalette();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-shortcuts', handleOpenShortcuts);
    window.addEventListener('open-command-palette', handleOpenPalette);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-shortcuts', handleOpenShortcuts);
      window.removeEventListener('open-command-palette', handleOpenPalette);
    };
  }, [navigate, onClosePalette, onCloseShortcuts, onOpenPalette, onOpenShortcuts]);
}
