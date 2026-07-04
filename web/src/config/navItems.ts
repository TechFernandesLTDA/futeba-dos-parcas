import React from 'react';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  EmojiEvents,
  Person,
  Notifications as NotificationsIcon,
  ChatBubble as MessagesIcon,
} from '@mui/icons-material';

export interface NavItem {
  icon: React.ReactElement;
  labelKey: string;
  path: string;
  matchPaths: string[];
  showInBottomNav: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    icon: React.createElement(HomeIcon),
    labelKey: 'nav.home',
    path: '/?tab=0',
    matchPaths: [],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(SportsSoccer),
    labelKey: 'nav.games',
    path: '/?tab=1',
    // #2226: /map/games e /public-games são conceitualmente Jogos (antes caíam
    // em Perfil pelo matcher genérico /map, ou no fallback Home).
    matchPaths: ['/games', '/game', '/map/games', '/public-games'],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(Groups),
    labelKey: 'nav.groups',
    path: '/?tab=2',
    matchPaths: ['/groups', '/group'],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(EmojiEvents),
    labelKey: 'nav.league',
    path: '/?tab=3',
    // #2226/#2233: ranking semanal pertence à Liga, não a Perfil.
    matchPaths: ['/ranking', '/league', '/weekly-ranking'],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(Person),
    labelKey: 'nav.profile',
    path: '/?tab=4',
    // #2184: Perfil deixa de ser catch-all genérico. Mantém apenas as rotas
    // que conceitualmente pertencem ao usuário/perfil. Rotas órfãs (admin, dev,
    // /search) NÃO destacam Perfil — vide getActiveNavIndex (retorna -1 para
    // rotas sem seção natural) e getSectionFallback.
    matchPaths: [
      '/profile',
      '/level-journey',
      '/settings',
      '/about',
      '/whats-new',
      '/badges',
      '/statistics',
      '/evolution',
      '/weekly-recap',
      '/head-to-head',
      '/dream-team',
      '/invite-friend',
      '/map/locations',
      '/locations',
      '/location',
    ],
    showInBottomNav: true,
  },
  {
    icon: React.createElement(NotificationsIcon),
    labelKey: 'nav.notifications',
    path: '/notifications',
    matchPaths: ['/notifications'],
    showInBottomNav: false,
  },
  {
    icon: React.createElement(MessagesIcon),
    labelKey: 'nav.messages',
    path: '/messages',
    matchPaths: ['/messages'],
    showInBottomNav: false,
  },
];

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
 * #2233/#2224: destino de fallback para o botão "Voltar" quando não há history
 * (deep link, refresh, abertura direta). Mapeia o path atual para a seção raiz
 * coerente, de modo que `NAV_ITEMS.matchPaths` e o fallback contem a mesma
 * história.
 *
 * Diferença para getActiveNavIndex: aqui rotas órfãs (admin, dev, search,
 * owner) recebem um destino seguro (Perfil), enquanto no highlight elas ficam
 * sem seção. O objetivo é nunca jogar o usuário numa rota protegida ou em Home
 * quando há uma seção pai mais natural.
 *
 * @returns path de fallback (ex.: '/?tab=1'), default '/' (Home).
 */
export function getSectionFallback(pathname: string): string {
  const idx = getActiveNavIndex(pathname, '');
  if (idx >= 0 && idx <= 4) return NAV_ITEMS[idx].path;

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
