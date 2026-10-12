import { describe, expect, it } from 'vitest';
import type { Location } from '../../types/location';
import { buildGeoFacets, pruneGeoSelection } from './manageLocationFacets';
import { EMPTY_MANAGE_FILTERS, ManageLocationQueryState } from './manageLocationUrlState';

const venue = (id: string, city: string, state: string, neighborhood: string, extra: Partial<Location> = {}) =>
  ({
    id,
    name: `Quadra ${id}`,
    city,
    state,
    neighborhood,
    district: neighborhood,
    isVerified: true,
    isActive: true,
    publicationStatus: 'PUBLISHED',
    ...extra,
  }) as Location;

const LOCATIONS = [
  venue('1', 'Curitiba', 'PR', 'Centro'),
  venue('2', 'Curitiba', 'PR', 'Água Verde'),
  venue('3', 'curitiba', 'PR', 'agua verde'),
  venue('4', 'Londrina', 'PR', 'Centro', { isVerified: false, publicationStatus: 'DRAFT' }),
  venue('5', 'Joinville', 'SC', 'Centro'),
  venue('6', 'Joinville', 'sc', 'Anita Garibaldi'),
  venue('7', 'Belém', 'PA', ''),
];

const filters = (patch: Partial<ManageLocationQueryState> = {}): ManageLocationQueryState => ({
  ...EMPTY_MANAGE_FILTERS,
  ...patch,
});

const summary = (options: { value: string; count: number }[]) => options.map((o) => [o.value, o.count]);

describe('buildGeoFacets', () => {
  it('sem seleção: todas as UFs com contagem, cidades e bairros de tudo', () => {
    const facets = buildGeoFacets(LOCATIONS, filters());
    expect(summary(facets.states)).toEqual([['PA', 1], ['PR', 4], ['SC', 2]]);
    expect(facets.states[0].label).toBe('PA — Pará');
    // cidades agrupadas sem acento/caixa; "Curitiba" e "curitiba" viram uma opção
    expect(facets.cities.map((c) => [c.label, c.count])).toEqual([
      ['Belém', 1], ['Curitiba', 3], ['Joinville', 2], ['Londrina', 1],
    ]);
  });

  it('cascata: com UF selecionada só aparecem as cidades dela', () => {
    const facets = buildGeoFacets(LOCATIONS, filters({ stateFilters: ['SC'] }));
    expect(facets.cities.map((c) => c.label)).toEqual(['Joinville']);
    expect(facets.neighborhoods.map((n) => n.label)).toEqual(['Anita Garibaldi', 'Centro']);
    // selecionar uma UF não esconde as demais UFs (multi-seleção)
    expect(facets.states.map((s) => s.value)).toEqual(['PA', 'PR', 'SC']);
  });

  it('cascata: bairros só das cidades selecionadas, juntando grafias iguais', () => {
    const facets = buildGeoFacets(LOCATIONS, filters({ stateFilters: ['PR'], cityFilters: ['Curitiba'] }));
    expect(facets.neighborhoods.map((n) => [n.label, n.count])).toEqual([['Água Verde', 2], ['Centro', 1]]);
    // as outras cidades da UF continuam disponíveis para multi-seleção
    expect(facets.cities.map((c) => c.label)).toEqual(['Curitiba', 'Londrina']);
  });

  it('contagens respeitam os demais filtros (ex.: só não verificadas)', () => {
    const facets = buildGeoFacets(LOCATIONS, filters({ quickFilters: ['UNVERIFIED'] }));
    expect(summary(facets.states)).toEqual([['PR', 1]]);
    expect(facets.cities.map((c) => [c.label, c.count])).toEqual([['Londrina', 1]]);
  });

  it('contagens respeitam a busca inteligente', () => {
    const facets = buildGeoFacets(LOCATIONS, filters({ searchQuery: 'joinvile' }));
    expect(summary(facets.states)).toEqual([['SC', 2]]);
  });

  it('seleção sem nenhuma quadra continua visível com contagem 0', () => {
    const facets = buildGeoFacets(LOCATIONS, filters({ stateFilters: ['SP'] }));
    expect(facets.states.find((s) => s.value === 'SP')?.count).toBe(0);
  });

  it('UF digitada como nome ou minúscula é normalizada', () => {
    const facets = buildGeoFacets(LOCATIONS, filters());
    expect(facets.states.filter((s) => s.value === 'SC')).toHaveLength(1); // "SC" e "sc"
  });

  it('quadra sem bairro/cidade não vira opção vazia', () => {
    const facets = buildGeoFacets(LOCATIONS, filters({ stateFilters: ['PA'] }));
    expect(facets.neighborhoods).toEqual([]);
  });
});

describe('pruneGeoSelection', () => {
  it('tirar a UF derruba as cidades e os bairros que ficaram sem pai', () => {
    const pruned = pruneGeoSelection(LOCATIONS, {
      stateFilters: ['SC'],
      cityFilters: ['Curitiba', 'Joinville'],
      neighborhoodFilters: ['Água Verde', 'Centro'],
    });
    expect(pruned.cityFilters).toEqual(['Joinville']);
    expect(pruned.neighborhoodFilters).toEqual(['Centro']);
  });

  it('sem UF selecionada, mantém tudo o que existe', () => {
    const selection = { stateFilters: [], cityFilters: ['Londrina'], neighborhoodFilters: ['Centro'] };
    expect(pruneGeoSelection(LOCATIONS, selection)).toBe(selection);
  });

  it('bairro que não existe nas cidades escolhidas cai', () => {
    const pruned = pruneGeoSelection(LOCATIONS, {
      stateFilters: [],
      cityFilters: ['Belém'],
      neighborhoodFilters: ['Centro'],
    });
    expect(pruned.neighborhoodFilters).toEqual([]);
  });
});
