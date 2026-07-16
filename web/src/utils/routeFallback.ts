export type SpecificRouteFallback = 'list' | 'about' | 'form' | 'statistics';

const LIST_ROUTES = new Set([
  '/notifications',
  '/weekly-ranking',
  '/dream-team',
  '/feed',
  '/players/nearby',
]);

/** Retorna apenas overrides mais específicos; `null` mantém o matcher legado. */
export function getSpecificRouteFallback(pathname: string): SpecificRouteFallback | null {
  if (LIST_ROUTES.has(pathname)) return 'list';
  if (pathname === '/whats-new') return 'about';
  if (pathname === '/dev') return 'form';
  if (pathname === '/owner/dashboard') return 'statistics';
  return null;
}
