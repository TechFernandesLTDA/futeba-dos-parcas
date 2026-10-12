import { describe, expect, it } from 'vitest';
import {
  EMPTY_MANAGE_FILTERS,
  ManageLocationQueryState,
  clearManageFilters,
  countActiveManageFilters,
  parseManageFilters,
  serializeManageFilters,
} from './manageLocationUrlState';

const parse = (qs: string) => parseManageFilters(new URLSearchParams(qs));
const state = (patch: Partial<ManageLocationQueryState>): ManageLocationQueryState => ({
  ...EMPTY_MANAGE_FILTERS,
  ...patch,
});

describe('parseManageFilters', () => {
  it('URL vazia = filtros padrão', () => {
    expect(parse('')).toEqual(EMPTY_MANAGE_FILTERS);
  });

  it('lê busca, geografia multi-valor e atalhos', () => {
    const parsed = parse('q=jd%20europa&uf=PR&uf=sc&cidade=Curitiba&cidade=Joinville&bairro=Centro&rapido=UNVERIFIED&rapido=NO_PHONE');
    expect(parsed.searchQuery).toBe('jd europa');
    expect(parsed.stateFilters).toEqual(['PR', 'SC']);
    expect(parsed.cityFilters).toEqual(['Curitiba', 'Joinville']);
    expect(parsed.neighborhoodFilters).toEqual(['Centro']);
    expect(parsed.quickFilters).toEqual(['UNVERIFIED', 'NO_PHONE']);
  });

  it('lê os filtros que já existiam', () => {
    const parsed = parse('pub=DRAFT&mens=OVERDUE&tipo=FUTSAL&venc=8_14&ver=NO&ativa=YES&campos=NO&taxa=300_PLUS&dono=abc&comod=parking&comod=shower');
    expect(parsed).toMatchObject({
      publicationFilter: 'DRAFT',
      subscriptionFilter: 'OVERDUE',
      typeFilter: 'FUTSAL',
      dueFilter: '8_14',
      verifiedFilter: 'NO',
      activeFilter: 'YES',
      activeFieldsFilter: 'NO',
      monthlyFeeFilter: '300_PLUS',
      ownerFilter: 'abc',
      amenityFilters: ['parking', 'shower'],
    });
  });

  it('ignora valores inválidos e normaliza UF por nome', () => {
    const parsed = parse('pub=XYZ&tipo=TENIS&rapido=NADA&ord=ALEATORIO&vista=grid&uf=Santa%20Catarina&uf=');
    expect(parsed.publicationFilter).toBe('ALL');
    expect(parsed.typeFilter).toBe('ALL');
    expect(parsed.quickFilters).toEqual([]);
    expect(parsed.sortBy).toBe('NAME');
    expect(parsed.view).toBeUndefined();
    expect(parsed.stateFilters).toEqual(['SC']);
  });

  it('lê ordenação e vista', () => {
    expect(parse('ord=NEWEST&vista=cards')).toMatchObject({ sortBy: 'NEWEST', view: 'cards' });
  });

  it('remove repetidos e espaços', () => {
    expect(parse('cidade=Curitiba&cidade=%20Curitiba%20&cidade=').cityFilters).toEqual(['Curitiba']);
  });
});

describe('serializeManageFilters', () => {
  it('estado padrão gera URL vazia', () => {
    expect(serializeManageFilters(EMPTY_MANAGE_FILTERS).toString()).toBe('');
  });

  it('ida e volta: estado → URL → estado é idêntico', () => {
    const original = state({
      searchQuery: 'soc, centro',
      stateFilters: ['PR', 'SC'],
      cityFilters: ['Curitiba', 'São José dos Pinhais, PR'],
      neighborhoodFilters: ['Água Verde'],
      quickFilters: ['DRAFT_IMPORTED', 'NO_COORDINATES'],
      publicationFilter: 'DRAFT',
      subscriptionFilter: 'TRIAL',
      typeFilter: 'SOCIETY',
      dueFilter: 'NO_DUE',
      verifiedFilter: 'NO',
      activeFilter: 'YES',
      activeFieldsFilter: 'YES',
      monthlyFeeFilter: 'UP_TO_100',
      ownerFilter: 'uid-1',
      amenityFilters: ['parking', 'bbq'],
      sortBy: 'UPDATED',
      view: 'table',
    });
    const url = serializeManageFilters(original).toString();
    expect(parseManageFilters(new URLSearchParams(url))).toEqual(original);
  });

  it('nomes de cidade com vírgula não quebram (parâmetros repetidos)', () => {
    const url = serializeManageFilters(state({ cityFilters: ['Cidade, Com Vírgula', 'Outra'] }));
    expect(url.getAll('cidade')).toEqual(['Cidade, Com Vírgula', 'Outra']);
  });

  it('não grava valores padrão', () => {
    const url = serializeManageFilters(state({ publicationFilter: 'ALL', sortBy: 'NAME', searchQuery: '   ' }));
    expect(url.toString()).toBe('');
  });

  it('preserva parâmetros que não são dos filtros e troca os antigos', () => {
    const base = new URLSearchParams('tab=4&q=velho&uf=RS');
    const url = serializeManageFilters(state({ searchQuery: 'novo', stateFilters: ['PR'] }), base);
    expect(url.get('tab')).toBe('4');
    expect(url.getAll('q')).toEqual(['novo']);
    expect(url.getAll('uf')).toEqual(['PR']);
  });
});

describe('countActiveManageFilters / clearManageFilters', () => {
  it('conta cada seleção e cada filtro simples', () => {
    expect(countActiveManageFilters(EMPTY_MANAGE_FILTERS)).toBe(0);
    expect(countActiveManageFilters(state({
      searchQuery: 'x',
      stateFilters: ['PR', 'SC'],
      cityFilters: ['A'],
      quickFilters: ['UNVERIFIED'],
      publicationFilter: 'DRAFT',
      amenityFilters: ['bbq', 'parking'],
    }))).toBe(1 + 2 + 1 + 1 + 1 + 2);
  });

  it('ordenação e vista não contam como filtro', () => {
    expect(countActiveManageFilters(state({ sortBy: 'CITY', view: 'cards' }))).toBe(0);
  });

  it('limpar tudo mantém ordenação e vista', () => {
    const cleared = clearManageFilters(state({ searchQuery: 'x', stateFilters: ['PR'], sortBy: 'NEWEST', view: 'cards' }));
    expect(cleared).toEqual({ ...EMPTY_MANAGE_FILTERS, sortBy: 'NEWEST', view: 'cards' });
  });
});
