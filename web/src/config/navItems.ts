import React from 'react';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  EmojiEvents,
  Person,
  Notifications as NotificationsIcon,
  ChatBubble as MessagesIcon,
  BarChart,
  MilitaryTech,
  LocationOn,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { UserRole } from '../types/user';

export type NavSection = 'primary' | 'more';
export type NavItemId =
  | 'home'
  | 'games'
  | 'groups'
  | 'league'
  | 'profile'
  | 'statistics'
  | 'badges'
  | 'locations'
  | 'settings'
  | 'notifications'
  | 'messages';

export interface NavItem {
  id: NavItemId;
  icon: React.ReactElement;
  labelKey: string;
  path: string;
  matchPaths: string[];
  showInBottomNav: boolean;
  section: NavSection;
  /** Destinos privilegiados; `path` permanece o fallback de menor privilégio. */
  pathByRole?: Partial<Record<UserRole, string>>;
  /** Item primary que serve de umbrella em superfícies onde este item não existe. */
  parentItemId?: NavItemId;
}

export const NAV_ITEMS: NavItem[] = [
  // ── Primary (tabs) ──────────────────────────────────────────────
  {
    id: 'home',
    icon: React.createElement(HomeIcon),
    labelKey: 'nav.home',
    path: '/?tab=0',
    // O feed é uma extensão da experiência inicial, acessada pelos atalhos da Home.
    matchPaths: ['/feed'],
    showInBottomNav: true,
    section: 'primary',
  },
  {
    id: 'games',
    icon: React.createElement(SportsSoccer),
    labelKey: 'nav.games',
    path: '/?tab=1',
    // #2226: /map/games e /public-games são conceitualmente Jogos.
    matchPaths: ['/games', '/game', '/map/games', '/public-games'],
    showInBottomNav: true,
    section: 'primary',
  },
  {
    id: 'groups',
    icon: React.createElement(Groups),
    labelKey: 'nav.groups',
    path: '/?tab=2',
    // Descoberta de jogadores é uma experiência social, agrupada com Grupos.
    matchPaths: ['/groups', '/group', '/players/nearby'],
    showInBottomNav: true,
    section: 'primary',
  },
  {
    id: 'league',
    icon: React.createElement(EmojiEvents),
    labelKey: 'nav.league',
    path: '/?tab=3',
    // #2226/#2233: ranking semanal pertence à Liga, não a Perfil.
    matchPaths: ['/ranking', '/league', '/weekly-ranking'],
    showInBottomNav: true,
    section: 'primary',
  },
  {
    id: 'profile',
    icon: React.createElement(Person),
    labelKey: 'nav.profile',
    path: '/?tab=4',
    // #2184/#3726: Perfil deixou de ser catch-all para rotas que agora têm
    // items próprios na seção "Mais" (settings, statistics, badges, locations).
    // Mantém apenas rotas que conceitualmente pertencem ao perfil.
    matchPaths: [
      '/profile',
      '/level-journey',
      '/about',
      '/whats-new',
      '/evolution',
      '/weekly-recap',
      '/head-to-head',
      '/dream-team',
      '/invite-friend',
    ],
    showInBottomNav: true,
    section: 'primary',
  },
  // ── More (secondary) ────────────────────────────────────────────
  // #3726/#3727/#3728: rotas que antes eram hardcoded no drawer lg agora são
  // first-class em NAV_ITEMS. Ambos os drawers (md rail via Popover, lg drawer
  // via seção "Mais") derivam desta fonte única. Notifications/Messages também
  // ganharam visibilidade no desktop lg (antes só no rail md).
  {
    id: 'statistics',
    icon: React.createElement(BarChart),
    labelKey: 'nav.statistics',
    path: '/statistics',
    matchPaths: ['/statistics'],
    showInBottomNav: false,
    section: 'more',
    parentItemId: 'profile',
  },
  {
    id: 'badges',
    icon: React.createElement(MilitaryTech),
    labelKey: 'nav.badges',
    path: '/badges',
    matchPaths: ['/badges'],
    showInBottomNav: false,
    section: 'more',
    parentItemId: 'profile',
  },
  {
    id: 'locations',
    icon: React.createElement(LocationOn),
    labelKey: 'nav.locations',
    // #3737: jogador abre a busca pública; gestão continua exclusiva de
    // FIELD_OWNER/ADMIN. O fallback público também cobre role ainda indefinida.
    path: '/map/locations',
    pathByRole: {
      FIELD_OWNER: '/locations',
      ADMIN: '/locations',
    },
    // #3735: unifica /locations, /location/*, /map/locations sob um matcher.
    matchPaths: ['/locations', '/location', '/map/locations', '/owner'],
    showInBottomNav: false,
    section: 'more',
    parentItemId: 'profile',
  },
  {
    id: 'settings',
    icon: React.createElement(SettingsIcon),
    labelKey: 'nav.settings',
    path: '/settings',
    matchPaths: ['/settings'],
    showInBottomNav: false,
    section: 'more',
    parentItemId: 'profile',
  },
  {
    id: 'notifications',
    icon: React.createElement(NotificationsIcon),
    labelKey: 'nav.notifications',
    path: '/notifications',
    matchPaths: ['/notifications'],
    showInBottomNav: false,
    section: 'more',
    parentItemId: 'profile',
  },
  {
    id: 'messages',
    icon: React.createElement(MessagesIcon),
    labelKey: 'nav.messages',
    path: '/messages',
    matchPaths: ['/messages'],
    showInBottomNav: false,
    section: 'more',
    parentItemId: 'profile',
  },
];

/** Resolve um destino seguro para o papel atual sem duplicar regras na UI. */
export function resolveNavItemPath(item: NavItem, role?: UserRole): string {
  return (role && item.pathByRole?.[role]) || item.path;
}

/** Destino canônico de Quadras usado também pelo menu mobile do perfil. */
export function getLocationsPath(role?: UserRole): string {
  const locationsItem = NAV_ITEMS.find(
    (item) => item.labelKey === 'nav.locations',
  );
  return locationsItem
    ? resolveNavItemPath(locationsItem, role)
    : '/map/locations';
}

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter(
  (i) => i.section === 'primary',
);
export const MORE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.section === 'more');

/**
 * Resolve o item ativo canônico para um path/search.
 *
 * Fonte única de verdade do active-state — consumida por MobileBottomNav e
 * AppSidebar (antes a lógica era duplicada e divergia).
 *
 * Regras:
 * - Home (`/` sem tab, ou `?tab=0`) → 0.
 * - `/?tab=N` → índice correspondente.
 * - Demais rotas: longest-match em matchPaths (evita `/map` casar antes de
 *   `/map/games`).
 * - Rotas sem seção natural (ex.: /admin, /dev, /search) → -1 (nenhum item
 *   destacado), em vez de cair em Home/Perfil (#2184).
 *
 * @returns item canônico, ou undefined se nenhuma seção casar.
 */
export function getActiveNavItem(
  pathname: string,
  search: string,
): NavItem | undefined {
  const params = new URLSearchParams(search);
  if ((pathname === '/' || pathname === '') && !params.has('tab')) {
    return NAV_ITEMS.find((item) => item.id === 'home');
  }

  if ((pathname === '/' || pathname === '') && params.has('tab')) {
    const tab = params.get('tab');
    return NAV_ITEMS.find((item) => item.path === `/?tab=${tab}`);
  }

  // Longest-match: a rota mais específica vence (ex.: /map/games antes de /map).
  let bestItem: NavItem | undefined;
  let bestLen = 0;
  for (const item of NAV_ITEMS) {
    for (const mp of item.matchPaths) {
      if (pathname === mp || pathname.startsWith(`${mp}/`)) {
        if (mp.length > bestLen) {
          bestLen = mp.length;
          bestItem = item;
        }
      }
    }
  }
  return bestItem;
}

/** Compatibilidade para consumidores desktop que ainda usam o índice global. */
export function getActiveNavIndex(pathname: string, search: string): number {
  const activeItem = getActiveNavItem(pathname, search);
  return activeItem ? NAV_ITEMS.indexOf(activeItem) : -1;
}

/**
 * Resolve o índice ativo considerando o item pai por identidade.
 *
 * Em superfícies com slots limitados (ex.: bottom nav mobile com 5 items),
 * items "more" que não estão visíveis devem destacar o parentItemId (umbrella).
 * Em superfícies completas (sidebar desktop), o item próprio é destacado.
 *
 * `surfaceSize` limita a mesma coleção filtrada que a bottom nav renderiza.
 */
export function getActiveNavIndexForSurface(
  pathname: string,
  search: string,
  surfaceSize: number,
): number | false {
  const surfaceItems = NAV_ITEMS.filter((item) => item.showInBottomNav).slice(
    0,
    surfaceSize,
  );
  return getActiveNavIndexForItems(pathname, search, surfaceItems);
}

/** Resolve a posição ativa pela identidade dos itens realmente renderizados. */
export function getActiveNavIndexForItems(
  pathname: string,
  search: string,
  surfaceItems: readonly NavItem[],
): number | false {
  const activeItem = getActiveNavItem(pathname, search);
  if (!activeItem) return false;

  const visibleIndex = surfaceItems.findIndex(
    (item) => item.id === activeItem.id,
  );
  if (visibleIndex >= 0) return visibleIndex;

  const parentItemId = activeItem.parentItemId;
  if (!parentItemId) return false;
  const parentIndex = surfaceItems.findIndex(
    (item) => item.id === parentItemId,
  );
  return parentIndex >= 0 ? parentIndex : false;
}

/**
 * #2233/#2224: destino de fallback para o botão "Voltar" quando não há history
 * (deep link, refresh, abertura direta). Mapeia o path atual para a seção raiz
 * coerente, de modo que `NAV_ITEMS.matchPaths` e o fallback contem a mesma
 * história.
 *
 * @returns path de fallback (ex.: '/?tab=1'), default '/' (Home).
 */
export function getSectionFallback(pathname: string): string {
  const activeItem = getActiveNavItem(pathname, '');
  if (activeItem?.section === 'primary') return activeItem.path;

  if (activeItem?.parentItemId) {
    const parentItem = NAV_ITEMS.find(
      (item) => item.id === activeItem.parentItemId,
    );
    if (parentItem) return parentItem.path;
  }

  // Rotas órfãs sem seção natural → agrupadas em Perfil (acesso via tab=4).
  const profileOrphans = ['/admin', '/dev', '/search'];
  if (profileOrphans.some((p) => pathname.startsWith(p))) return '/?tab=4';

  return '/';
}

// Base widths da sidebar. Mantidos como números canônicos para cálculo de
// offset de conteúdo (ex.: barras fixas que precisam compensar a sidebar).
export const RAIL_WIDTH = 88;
export const DRAWER_WIDTH = 240;

/**
 * Larguras responsivas da sidebar. O rail só existe no breakpoint md; em lg+
 * o drawer completo assume a navegação.
 */
export const RAIL_WIDTH_RESPONSIVE = { md: RAIL_WIDTH } as const;
export const DRAWER_WIDTH_RESPONSIVE = { lg: DRAWER_WIDTH, xl: 288 } as const;
