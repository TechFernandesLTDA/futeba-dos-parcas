import { describe, it, expect } from 'vitest';
import {
  getActiveNavIndex,
  getLocationsPath,
  getSectionFallback,
  NAV_ITEMS,
  getActiveNavIndexForItems,
  getActiveNavItem,
  RAIL_WIDTH,
  RAIL_WIDTH_RESPONSIVE,
  resolveNavItemPath,
} from './navItems';

// Índices em NAV_ITEMS:
// 0=Home, 1=Jogos, 2=Grupos, 3=Liga, 4=Perfil (primary)
// 5=Statistics, 6=Badges, 7=Locations, 8=Settings, 9=Notifications, 10=Messages (more)

describe('getActiveNavIndex (#2226/#3726)', () => {
  it('destaca Home na raiz sem tab', () => {
    expect(getActiveNavIndex('/', '')).toBe(0);
  });

  it('destaca a tab da query string', () => {
    expect(getActiveNavIndex('/', '?tab=1')).toBe(1);
    expect(getActiveNavIndex('/', '?tab=2')).toBe(2);
    expect(getActiveNavIndex('/', '?tab=4')).toBe(4);
    expect(getActiveNavIndex('/', '?source=shortcut&tab=2')).toBe(2);
    expect(getActiveNavIndex('/', '?tab=3&source=notification')).toBe(3);
    expect(getActiveNavIndex('', '?tab=4')).toBe(4);
  });

  it('não confunde outros parâmetros com tab', () => {
    expect(getActiveNavIndex('/', '?notab=2')).toBe(0);
    expect(getActiveNavIndex('/', '?tab=')).toBe(-1);
  });

  it('destaca Jogos para /game/:id, /games, /map/games e /public-games', () => {
    expect(getActiveNavIndex('/game/abc123def456', '')).toBe(1);
    expect(getActiveNavIndex('/games', '')).toBe(1);
    expect(getActiveNavIndex('/map/games', '')).toBe(1);
    expect(getActiveNavIndex('/public-games', '')).toBe(1);
  });

  it('destaca Grupos para /group/:id', () => {
    expect(getActiveNavIndex('/group/xyz', '')).toBe(2);
    expect(getActiveNavIndex('/groups/discover', '')).toBe(2);
    expect(getActiveNavIndex('/players/nearby', '')).toBe(2);
  });

  it('destaca Home para o feed social', () => {
    expect(getActiveNavIndex('/feed', '')).toBe(0);
  });

  it('destaca Liga para /league, /ranking e /weekly-ranking', () => {
    expect(getActiveNavIndex('/league', '')).toBe(3);
    expect(getActiveNavIndex('/ranking', '')).toBe(3);
    expect(getActiveNavIndex('/weekly-ranking', '')).toBe(3);
  });

  // #3726: settings/statistics/badges/locations agora têm items próprios (não Perfil)
  it('destaca Statistics para /statistics', () => {
    expect(getActiveNavIndex('/statistics', '')).toBe(5);
  });

  it('destaca Badges para /badges', () => {
    expect(getActiveNavIndex('/badges', '')).toBe(6);
  });

  it('destaca Locations para /locations, /location/:id, /map/locations', () => {
    expect(getActiveNavIndex('/locations', '')).toBe(7);
    expect(getActiveNavIndex('/location/abc123def456', '')).toBe(7);
    expect(getActiveNavIndex('/map/locations', '')).toBe(7);
    expect(getActiveNavIndex('/owner/dashboard', '')).toBe(7);
    expect(getActiveNavIndex('/owner/onboarding', '')).toBe(7);
  });

  it('destaca Settings para /settings/*', () => {
    expect(getActiveNavIndex('/settings', '')).toBe(8);
    expect(getActiveNavIndex('/settings/theme', '')).toBe(8);
  });

  it('destaca Notifications e Messages', () => {
    expect(getActiveNavIndex('/notifications', '')).toBe(9);
    expect(getActiveNavIndex('/messages', '')).toBe(10);
    expect(getActiveNavIndex('/messages/abc123def456', '')).toBe(10);
  });

  it('destaca Perfil para rotas conceitualmente de perfil', () => {
    expect(getActiveNavIndex('/profile/abc123def456', '')).toBe(4);
    expect(getActiveNavIndex('/level-journey', '')).toBe(4);
    expect(getActiveNavIndex('/about', '')).toBe(4);
    expect(getActiveNavIndex('/evolution', '')).toBe(4);
    expect(getActiveNavIndex('/dream-team', '')).toBe(4);
  });

  it('longest-match: /map/games → Jogos, /map/locations → Locations', () => {
    expect(getActiveNavIndex('/map/games', '')).toBe(1);
    expect(getActiveNavIndex('/map/locations', '')).toBe(7);
  });

  it('retorna -1 para rotas órfãs sem seção natural (#2184)', () => {
    expect(getActiveNavIndex('/admin/users', '')).toBe(-1);
    expect(getActiveNavIndex('/dev', '')).toBe(-1);
    expect(getActiveNavIndex('/search', '')).toBe(-1);
  });

  it('retorna -1 para tab inexistente', () => {
    expect(getActiveNavIndex('/', '?tab=99')).toBe(-1);
  });
});

describe('getActiveNavIndexForItems na bottom nav (#3726)', () => {
  const bottomItems = NAV_ITEMS.filter((item) => item.showInBottomNav);

  it('retorna o índice real para items primary na surface', () => {
    expect(getActiveNavIndexForItems('/', '?tab=0', bottomItems)).toBe(0);
    expect(getActiveNavIndexForItems('/game/abc', '', bottomItems)).toBe(1);
  });

  it('items "more" com parentItemId resolvem para o tab pai na surface limitada', () => {
    // Bottom nav tem 5 slots (primary 0-4). Settings (idx 8) → Perfil (idx 4).
    expect(getActiveNavIndexForItems('/settings', '', bottomItems)).toBe(4);
    expect(getActiveNavIndexForItems('/statistics', '', bottomItems)).toBe(4);
    expect(getActiveNavIndexForItems('/badges', '', bottomItems)).toBe(4);
    expect(getActiveNavIndexForItems('/locations', '', bottomItems)).toBe(4);
  });

  it('notifications/messages usam Perfil como umbrella na surface limitada', () => {
    expect(getActiveNavIndexForItems('/notifications', '', bottomItems)).toBe(4);
    expect(getActiveNavIndexForItems('/messages', '', bottomItems)).toBe(4);
  });

  it('rotas órfãs → false', () => {
    expect(getActiveNavIndexForItems('/admin/users', '', bottomItems)).toBe(false);
  });
});

describe('resolução por identidade (#3760)', () => {
  it('retorna a posição do item na surface, independentemente da ordem de NAV_ITEMS', () => {
    const shuffledSurface = [
      NAV_ITEMS[4],
      NAV_ITEMS[2],
      NAV_ITEMS[0],
      NAV_ITEMS[3],
      NAV_ITEMS[1],
    ];

    expect(getActiveNavIndexForItems('/game/abc', '', shuffledSurface)).toBe(4);
    expect(
      getActiveNavIndexForItems('/players/nearby', '', shuffledSurface),
    ).toBe(1);
    expect(getActiveNavIndexForItems('/feed', '', shuffledSurface)).toBe(2);
  });

  it('resolve o parent pela identidade na ordem concreta da surface', () => {
    const shuffledSurface = [
      NAV_ITEMS[4],
      NAV_ITEMS[1],
      NAV_ITEMS[0],
      NAV_ITEMS[2],
      NAV_ITEMS[3],
    ];

    expect(
      getActiveNavIndexForItems('/notifications', '', shuffledSurface),
    ).toBe(0);
    expect(
      getActiveNavIndexForItems('/owner/dashboard', '', shuffledSurface),
    ).toBe(0);
  });

  it('expõe a identidade canônica da rota sem depender do índice global', () => {
    expect(getActiveNavItem('/feed', '')?.id).toBe('home');
    expect(getActiveNavItem('/players/nearby', '')?.id).toBe('groups');
    expect(getActiveNavItem('/owner/dashboard', '')?.id).toBe('locations');
  });
});

describe('destino de Quadras por permissão (#3737)', () => {
  const locationsItem = NAV_ITEMS.find(
    (item) => item.labelKey === 'nav.locations',
  )!;

  it.each([
    ['PLAYER', '/map/locations'],
    ['FIELD_OWNER', '/locations'],
    ['ADMIN', '/locations'],
  ] as const)('%s recebe o destino correto', (role, expected) => {
    expect(resolveNavItemPath(locationsItem, role)).toBe(expected);
    expect(getLocationsPath(role)).toBe(expected);
  });

  it('usa a superfície pública enquanto o papel não foi resolvido', () => {
    expect(resolveNavItemPath(locationsItem)).toBe('/map/locations');
    expect(getLocationsPath()).toBe('/map/locations');
  });
});

describe('breakpoints do rail (#3751)', () => {
  it('declara largura somente em md, onde o rail realmente existe', () => {
    expect(RAIL_WIDTH_RESPONSIVE).toEqual({ md: RAIL_WIDTH });
  });
});

describe('getSectionFallback (#2233/#2224)', () => {
  it('mapeia telas de jogos para a seção Jogos', () => {
    expect(getSectionFallback('/map/games')).toBe('/?tab=1');
    expect(getSectionFallback('/public-games')).toBe('/?tab=1');
  });

  it('mapeia telas de grupos para Grupos', () => {
    expect(getSectionFallback('/group/abc')).toBe('/?tab=2');
    expect(getSectionFallback('/players/nearby')).toBe('/?tab=2');
  });

  it('mapeia Feed para Home', () => {
    expect(getSectionFallback('/feed')).toBe('/?tab=0');
  });

  it('mapeia weekly-ranking/league para Liga', () => {
    expect(getSectionFallback('/weekly-ranking')).toBe('/?tab=3');
    expect(getSectionFallback('/league')).toBe('/?tab=3');
  });

  it('mapeia items secundários para Perfil via parentItemId', () => {
    expect(getSectionFallback('/badges')).toBe('/?tab=4');
    expect(getSectionFallback('/statistics')).toBe('/?tab=4');
    expect(getSectionFallback('/settings')).toBe('/?tab=4');
    expect(getSectionFallback('/map/locations')).toBe('/?tab=4');
    expect(getSectionFallback('/location/abc123def456')).toBe('/?tab=4');
    expect(getSectionFallback('/owner/dashboard')).toBe('/?tab=4');
    expect(getSectionFallback('/owner/onboarding')).toBe('/?tab=4');
    expect(getSectionFallback('/notifications')).toBe('/?tab=4');
    expect(getSectionFallback('/messages/thread-id')).toBe('/?tab=4');
  });

  it('mapeia rotas órfãs (admin/dev/search) para Perfil como destino seguro', () => {
    expect(getSectionFallback('/admin/users')).toBe('/?tab=4');
    expect(getSectionFallback('/dev')).toBe('/?tab=4');
    expect(getSectionFallback('/search')).toBe('/?tab=4');
  });

  it('default para Home quando não há seção pai', () => {
    expect(getSectionFallback('/totally-unknown')).toBe('/');
  });

  it('NAV_ITEMS expõe os 11 itens esperados na ordem canônica', () => {
    expect(NAV_ITEMS.map((i) => i.path)).toEqual([
      '/?tab=0',
      '/?tab=1',
      '/?tab=2',
      '/?tab=3',
      '/?tab=4',
      '/statistics',
      '/badges',
      '/map/locations',
      '/settings',
      '/notifications',
      '/messages',
    ]);
  });
});
