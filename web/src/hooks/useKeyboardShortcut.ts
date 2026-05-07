import { useEffect } from 'react';

type ModifierKey = 'cmd' | 'ctrl' | 'shift' | 'alt';

interface ShortcutOptions {
  /** Tecla principal (ex: 'k', 'Escape') */
  key: string;
  /** Modificadores obrigatórios */
  modifiers?: ModifierKey[];
  /** Se verdadeiro, dispara mesmo quando foco está em input/textarea */
  fireInInputs?: boolean;
}

/**
 * Hook genérico para atalhos de teclado globais.
 * Registra listener em `window` e limpa ao desmontar.
 *
 * Uso:
 *   useKeyboardShortcut({ key: 'k', modifiers: ['cmd'] }, () => setOpen(true));
 *
 * 'cmd' casa com Meta (Mac) OU Ctrl (Win/Linux) para compatibilidade cross-platform.
 */
export function useKeyboardShortcut(
  options: ShortcutOptions,
  callback: (e: KeyboardEvent) => void
): void {
  const { key, modifiers = [], fireInInputs = true } = options;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const needsCmdOrCtrl = modifiers.includes('cmd') || modifiers.includes('ctrl');
      const needsShift = modifiers.includes('shift');
      const needsAlt = modifiers.includes('alt');

      // cmd e ctrl são tratados como equivalentes (Cmd no Mac, Ctrl no Windows/Linux)
      if (needsCmdOrCtrl && !(e.metaKey || e.ctrlKey)) return;
      if (needsShift && !e.shiftKey) return;
      if (needsAlt && !e.altKey) return;
      if (e.key !== key) return;

      // Bloqueia disparo em inputs quando fireInInputs=false
      if (!fireInInputs) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }

      e.preventDefault();
      callback(e);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, modifiers, fireInInputs, callback]);
}
