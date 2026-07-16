export type SearchShortcutTranslationKey =
  | 'shortcuts.searchKeyApple'
  | 'shortcuts.searchKeyDefault';

export function isApplePlatform(platform?: string): boolean {
  const currentPlatform = platform
    ?? (typeof navigator !== 'undefined' ? navigator.platform : '');
  return /Mac|iPod|iPhone|iPad/i.test(currentPlatform);
}

/** Retorna a chave localizada do atalho conforme a convenção da plataforma. */
export function getSearchShortcutTranslationKey(platform?: string): SearchShortcutTranslationKey {
  return isApplePlatform(platform)
    ? 'shortcuts.searchKeyApple'
    : 'shortcuts.searchKeyDefault';
}
