export type SearchShortcutTranslationKey =
  | 'shortcuts.searchKeyApple'
  | 'shortcuts.searchKeyDefault';

/** Retorna a chave localizada do atalho conforme a convenção da plataforma. */
export function getSearchShortcutTranslationKey(platform?: string): SearchShortcutTranslationKey {
  const currentPlatform = platform
    ?? (typeof navigator !== 'undefined' ? navigator.platform : '');
  return /Mac|iPod|iPhone|iPad/i.test(currentPlatform)
    ? 'shortcuts.searchKeyApple'
    : 'shortcuts.searchKeyDefault';
}
