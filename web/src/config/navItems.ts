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

export interface NavItem {
  icon: React.ReactElement;
  labelKey: string;
  path: string;
  matchPaths: string[];
  showInBottomNav: boolean;
  section: NavSection;
  /** Destinos privilegiados; `path` permanece o fallback de menor privilégio. */
  pathByRole?: Partial<Record<UserRole, string>>;
  /**
   * Índice do item "primary" que serve de umbrella quando este item "more"
   * não é visível na superfície de navegação atual (ex.: bottom nav mobile
   * tem 5 slots). Usado por MobileBottomNav e getSectionFallback para manter
   * contexto de seção sem destacar o item próprio (que não existe na surface).
   */
  parentTab?: number;
}

export const NAV_ITEMS: NavItem[] = [
  // ── Primary (tabs) ──────────────────────────────────────────────
  {
    icon: React.createElement(HomeIcon),
    labelKey: 'nav.home',
    path: '/?tab=0',
    matchPaths: [],
    showInBottomNav: true,
    section: 'primary',
  },
  {
    icon: React.createElement(SportsSoccer),
    labelKey: 'nav.games',
    path: '/?tab=1',
    // #2226: /map/games e /public-games são conceitualmente Jogos.
    matchPaths: ['/games', '/game', '/map/games', '/public-games'],
    showInBottomNav: true,
    section: 'primary',
  },
  {
    icon: React.createElement(Groups),
    labelKey: 'nav.groups',
    path: '/?tab=2',
    matchPaths: ['/groups', '/group'],
    showInBottomNav: true,
    section: 'primary',
  },
  {
    icon: React.createElement(EmojiEvents),
    labelKey: 'nav.league',
    path: '/?tab=3',
    // #2226/#2233: ranking semanal pertence à Liga, não a Perfil.
    matchPaths: ['/ranking', '/league', '/weekly-ranking'],
    showInBottomNav: true,
    section: 'primary',
  },
  {
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
    icon: React.createElement(BarChart),
    labelKey: 'nav.statistics',
    path: '/statistics',
    matchPaths: ['/statistics'],
    showInBottomNav: false,
    section: 'more',
    parentTab: 4,
  },
  {
    icon: React.createElement(MilitaryTech),
    labelKey: 'nav.badges',
    path: '/badges',
    matchPaths: ['/badges'],
    showInBottomNav: false,
    section: 'more',
    parentTab: 4,
  },
  {
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
    matchPaths: ['/locations', '/location', '/map/locations'],
    showInBottomNav: false,
    section: 'more',
    parentTab: 4,
  },
  {
    icon: React.createElement(SettingsIcon),
    labelKey: 'nav.settings',
    path: '/settings',
    matchPaths: ['/settings'],
    showInBottomNav: false,
    section: 'more',
    parentTab: 4,
  },
  {
    icon: React.createElement(NotificationsIcon),
    labelKey: 'nav.notifications',
    path: '/notifications',
    matchPaths: ['/notifications'],
    showInBottomNav: false,
    section: 'more',
  },
  {
    icon: React.createElement(MessagesIcon),
    labelKey: 'nav.messages',
    path: '/messages',
    matchPaths: ['/messages'],
    showInBottomNav: false,
    section: 'more',
  },
];

/** Resolve um destino seguro para o papel atual sem duplicar regras na UI. */
export function resolveNavItemPath(item: NavItem, role?: UserRole): string {
  return (role && item.pathByRole?.[role]) || item.path;
}

/** Destino canônico de Quadras usado também pelo menu mobile do perfil. */
export function getLocationsPath(role?: UserRole): string {
  const locationsItem = NAV_ITEMS.find((item) => item.labelKey === 'nav.locations');
  return locationsItem ? resolveNavItemPath(locationsItem, role) : '/map/locations';
}

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((i) => i.section === 'primary');
export const MORE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.section === 'more');

/**
 * #2226: resolve o índice da seção ativa em NAV_ITEMS para um path/search.
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
 * @returns índice em NAV_ITEMS, ou -1 se nenhuma seção casar.
 */
export function getActiveNavIndex(pathname: string, search: string): number {
  if ((pathname === '/' || pathname === '') && !search.includes('tab=')) return 0;

  if (pathname === '/' && search.includes('tab=')) {
    const tab = new URLSearchParams(search).get('tab');
    const idx = NAV_ITEMS.findIndex((item) => item.path === `/?tab=${tab}`);
    return idx >= 0 ? idx : -1;
  }

  // Longest-match: a rota mais específica vence (ex.: /map/games antes de /map).
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < NAV_ITEMS.length; i++) {
    for (const mp of NAV_ITEMS[i].matchPaths) {
      if (pathname === mp || pathname.startsWith(`${mp}/`)) {
        if (mp.length > bestLen) {
          bestLen = mp.length;
          bestIdx = i;
        }
      }
    }
  }
  return bestIdx;
}

/**
 * Resolve o índice ativo considerando fallback de parentTab.
 *
 * Em superfícies com slots limitados (ex.: bottom nav mobile com 5 items),
 * items "more" que não estão visíveis devem destacar o parentTab (umbrella).
 * Em superfícies completas (sidebar desktop), o item próprio é destacado.
 *
 * @param includeParentFallback quando true, items "more" resolvem para seu
 *   parentTab (uso em bottom nav mobile). Quando false, retorna o índice real.
 */
export function getActiveNavIndexForSurface(
  pathname: string,
  search: string,
  surfaceSize: number,
): number | false {
  const idx = getActiveNavIndex(pathname, search);
  if (idx < 0) return false;
  if (idx < surfaceSize) return idx;
  // Item "more" não visível nesta surface → resolve para parentTab se houver
  const parentTab = NAV_ITEMS[idx]?.parentTab;
  if (parentTab !== undefined && parentTab < surfaceSize) return parentTab;
  return false;
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
  const idx = getActiveNavIndex(pathname, '');
  if (idx >= 0 && idx <= 4) return NAV_ITEMS[idx].path;

  // Items "more" com parentTab → voltam para o tab pai
  if (idx >= 5) {
    const parentTab = NAV_ITEMS[idx]?.parentTab;
    if (parentTab !== undefined) return NAV_ITEMS[parentTab].path;
  }

  // Rotas órfãs sem seção natural → agrupadas em Perfil (acesso via tab=4).
  const profileOrphans = ['/admin', '/dev', '/owner', '/search'];
  if (profileOrphans.some((p) => pathname.startsWith(p))) return '/?tab=4';

  return '/';
}

// Base widths da sidebar. Mantidos como números canônicos para cálculo de
// offset de conteúdo (ex.: barras fixas que precisam compensar a sidebar).
export const RAIL_WIDTH = 88;
export const DRAWER_WIDTH = 240;

/**
 * #2219: larguras responsivas da sidebar. md/lg mantêm o valor base (não
 * quebra o offset das barras fixas); xl aumenta para aproveitar telas 2K/4K
 * sem desperdiçar espaço nem encolher ícones/labels.
 */
export const RAIL_WIDTH_RESPONSIVE = { md: RAIL_WIDTH, xl: 104 } as const;
export const DRAWER_WIDTH_RESPONSIVE = { lg: DRAWER_WIDTH, xl: 288 } as const;
