import { describe, it, expect } from 'vitest';
import { getActiveNavIndex, getSectionFallback, NAV_ITEMS } from './navItems';

// Índices em NAV_ITEMS: 0=Home, 1=Jogos, 2=Grupos, 3=Liga, 4=Perfil, 5=Notif, 6=DMs.

describe('getActiveNavIndex (#2226)', () => {
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

  it('destaca Perfil para badges/estatísticas/settings/locations', () => {
    expect(getActiveNavIndex('/badges', '')).toBe(4);
    expect(getActiveNavIndex('/statistics', '')).toBe(4);
    expect(getActiveNavIndex('/settings/theme', '')).toBe(4);
    expect(getActiveNavIndex('/map/locations', '')).toBe(4);
    expect(getActiveNavIndex('/locations', '')).toBe(4);
    expect(getActiveNavIndex('/location/abc123def456', '')).toBe(4);
  });

  it('longest-match: /map/games vence o genérico (não cai em Perfil)', () => {
    // /map/locations → Perfil; /map/games → Jogos. Nenhum matcher genérico /map.
    expect(getActiveNavIndex('/map/games', '')).toBe(1);
    expect(getActiveNavIndex('/map/locations', '')).toBe(4);
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

  it('mapeia perfil/badges/estatísticas/settings/locations para Perfil', () => {
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

  it('NAV_ITEMS expõe os 7 itens esperados na ordem canônica', () => {
    expect(NAV_ITEMS.map((i) => i.path)).toEqual([
      '/?tab=0',
      '/?tab=1',
      '/?tab=2',
      '/?tab=3',
      '/?tab=4',
      '/notifications',
      '/messages',
    ]);
  });
});
