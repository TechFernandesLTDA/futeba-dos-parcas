import { describe, it, expect } from 'vitest';
import {
  getActiveNavIndex,
  getLocationsPath,
  getSectionFallback,
  NAV_ITEMS,
  getActiveNavIndexForSurface,
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
    expect(getActiveNavIndex('/owner/dashboard', '')).toBe(-1);
  });

  it('retorna -1 para tab inexistente', () => {
    expect(getActiveNavIndex('/', '?tab=99')).toBe(-1);
  });
});

describe('getActiveNavIndexForSurface (#3726)', () => {
  it('retorna o índice real para items primary na surface', () => {
    expect(getActiveNavIndexForSurface('/', '?tab=0', 5)).toBe(0);
    expect(getActiveNavIndexForSurface('/game/abc', '', 5)).toBe(1);
  });

  it('items "more" com parentTab resolvem para o tab pai na surface limitada', () => {
    // Bottom nav tem 5 slots (primary 0-4). Settings (idx 8) → Perfil (idx 4).
    expect(getActiveNavIndexForSurface('/settings', '', 5)).toBe(4);
    expect(getActiveNavIndexForSurface('/statistics', '', 5)).toBe(4);
    expect(getActiveNavIndexForSurface('/badges', '', 5)).toBe(4);
    expect(getActiveNavIndexForSurface('/locations', '', 5)).toBe(4);
  });

  it('items "more" sem parentTab (notifications/messages) → false', () => {
    expect(getActiveNavIndexForSurface('/notifications', '', 5)).toBe(false);
    expect(getActiveNavIndexForSurface('/messages', '', 5)).toBe(false);
  });

  it('rotas órfãs → false', () => {
    expect(getActiveNavIndexForSurface('/admin/users', '', 5)).toBe(false);
  });
});

describe('destino de Quadras por permissão (#3737)', () => {
  const locationsItem = NAV_ITEMS.find((item) => item.labelKey === 'nav.locations')!;

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

describe('getSectionFallback (#2233/#2224)', () => {
  it('mapeia telas de jogos para a seção Jogos', () => {
    expect(getSectionFallback('/map/games')).toBe('/?tab=1');
    expect(getSectionFallback('/public-games')).toBe('/?tab=1');
  });

  it('mapeia telas de grupos para Grupos', () => {
    expect(getSectionFallback('/group/abc')).toBe('/?tab=2');
  });

  it('mapeia weekly-ranking/league para Liga', () => {
    expect(getSectionFallback('/weekly-ranking')).toBe('/?tab=3');
    expect(getSectionFallback('/league')).toBe('/?tab=3');
  });

  it('mapeia badges/estatísticas/settings/locations para Perfil via parentTab', () => {
    expect(getSectionFallback('/badges')).toBe('/?tab=4');
    expect(getSectionFallback('/statistics')).toBe('/?tab=4');
    expect(getSectionFallback('/settings')).toBe('/?tab=4');
    expect(getSectionFallback('/map/locations')).toBe('/?tab=4');
    expect(getSectionFallback('/location/abc123def456')).toBe('/?tab=4');
  });

  it('mapeia rotas órfãs (admin/dev/owner/search) para Perfil como destino seguro', () => {
    expect(getSectionFallback('/admin/users')).toBe('/?tab=4');
    expect(getSectionFallback('/dev')).toBe('/?tab=4');
    expect(getSectionFallback('/owner/dashboard')).toBe('/?tab=4');
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
