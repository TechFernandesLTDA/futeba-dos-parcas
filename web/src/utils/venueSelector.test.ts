import { describe, expect, it } from 'vitest';
import {
  buildVenueSelectorResult,
  compareVenueNames,
  isVenueSelectable,
  isVenueUnverified,
  orderVenuesForSelector,
} from './venueSelector';
import type { Location } from '../types/location';

const v = (id: string, name: string, extra: Partial<Location> = {}) =>
  ({ id, name, city: 'Curitiba', state: 'PR', ...extra }) as Location;

describe('compareVenueNames', () => {
  it('ordena em pt-BR ignorando acento e caixa', () => {
    const names = ['zeta', 'Água Verde', 'arena', 'Álamo', 'Beta'];
    const sorted = names
      .map((name) => v(name, name))
      .sort(compareVenueNames)
      .map((x) => x.name);
    expect(sorted).toEqual(['Água Verde', 'Álamo', 'arena', 'Beta', 'zeta']);
  });

  it('ordena números naturalmente', () => {
    expect(compareVenueNames(v('1', 'Quadra 2'), v('2', 'Quadra 10'))).toBeLessThan(0);
  });
});

describe('orderVenuesForSelector', () => {
  const venues = [
    v('1', 'Zeta Arena'),
    v('2', 'Beta Society'),
    v('3', 'Alfa Futsal'),
    v('4', 'Ômega Campo'),
    v('5', 'Delta Quadra'),
  ];

  it('últimas utilizações primeiro (mais recente → mais antiga), depois alfabético', () => {
    const ordered = orderVenuesForSelector(venues, ['4', '1']);
    expect(ordered.map((x) => x.id)).toEqual(['4', '1', '3', '2', '5']);
  });

  it('sem utilizações é só alfabético pt-BR', () => {
    expect(orderVenuesForSelector(venues).map((x) => x.name)).toEqual([
      'Alfa Futsal', 'Beta Society', 'Delta Quadra', 'Ômega Campo', 'Zeta Arena',
    ]);
  });

  it('ignora ids recentes que não estão na lista e não altera a entrada', () => {
    const copy = [...venues];
    const ordered = orderVenuesForSelector(venues, ['inexistente', '5']);
    expect(ordered[0].id).toBe('5');
    expect(venues).toEqual(copy);
  });

  it('id repetido nos recentes vale pela primeira ocorrência', () => {
    const ordered = orderVenuesForSelector(venues, ['2', '3', '2']);
    expect(ordered.slice(0, 2).map((x) => x.id)).toEqual(['2', '3']);
  });
});

describe('isVenueUnverified', () => {
  it('quadra sem verificação recebe o selo', () => {
    expect(isVenueUnverified({ isVerified: false, publicationStatus: 'DRAFT' })).toBe(true);
    expect(isVenueUnverified({ isVerified: undefined as unknown as boolean })).toBe(true);
    expect(isVenueUnverified({ isVerified: true, publicationStatus: 'PUBLISHED' })).toBe(false);
  });
});

describe('isVenueSelectable', () => {
  it('aceita rascunho importado (logado enxerga)', () => {
    expect(isVenueSelectable({ isActive: true, publicationStatus: 'DRAFT' })).toBe(true);
    expect(isVenueSelectable({ isActive: true, publicationStatus: 'PENDING_REVIEW' })).toBe(true);
  });

  it('recusa inativa, suspensa, rejeitada ou sem mensalidade válida', () => {
    expect(isVenueSelectable({ isActive: false })).toBe(false);
    expect(isVenueSelectable({ isActive: true, publicationStatus: 'SUSPENDED' })).toBe(false);
    expect(isVenueSelectable({ isActive: true, publicationStatus: 'REJECTED' })).toBe(false);
    expect(isVenueSelectable({ isActive: true, subscriptionStatus: 'OVERDUE' })).toBe(false);
    expect(isVenueSelectable({ isActive: true, subscriptionStatus: 'TRIAL' })).toBe(true);
  });
});

describe('buildVenueSelectorResult', () => {
  const cityVenues = [
    v('1', 'Arena Society Centro', { neighborhood: 'Centro' }),
    v('2', 'Ginásio Futsal Água Verde', { neighborhood: 'Água Verde' }),
    v('3', 'Campo do Bairro Alto', { neighborhood: 'Bairro Alto' }),
  ];
  const otherVenues = [
    v('10', 'Arena Londrina', { city: 'Londrina' }),
    v('11', 'Quadra Jardim Europa', { city: 'Londrina' }),
    v('1', 'Arena Society Centro', { neighborhood: 'Centro' }), // duplicada da cidade
  ];

  it('busca vazia = lista da cidade (recentes primeiro)', () => {
    const result = buildVenueSelectorResult({ cityVenues, otherVenues, query: '', recentIds: ['3'] });
    expect(result.inCity.map((x) => x.id)).toEqual(['3', '1', '2']);
    expect(result.otherCities).toEqual([]);
    expect(result.needsOtherCities).toBe(false);
  });

  it('filtra a cidade com acento, vários termos, typo e abreviação', () => {
    expect(buildVenueSelectorResult({ cityVenues, query: 'agua verde' }).inCity.map((x) => x.id)).toEqual(['2']);
    expect(buildVenueSelectorResult({ cityVenues, query: 'soc centro' }).inCity.map((x) => x.id)).toEqual(['1']);
    expect(buildVenueSelectorResult({ cityVenues, query: 'futsl agua' }).inCity.map((x) => x.id)).toEqual(['2']);
    expect(buildVenueSelectorResult({ cityVenues, query: 'bairro' }).inCity.map((x) => x.id)).toEqual(['3']);
  });

  it('com resultado na cidade NÃO mistura outras cidades', () => {
    const result = buildVenueSelectorResult({ cityVenues, otherVenues, query: 'arena' });
    expect(result.inCity.map((x) => x.id)).toEqual(['1']);
    expect(result.otherCities).toEqual([]);
    expect(result.needsOtherCities).toBe(false);
  });

  it('sem resultado na cidade, procura nas outras cidades', () => {
    const result = buildVenueSelectorResult({ cityVenues, otherVenues, query: 'jd europa' });
    expect(result.inCity).toEqual([]);
    expect(result.otherCities.map((x) => x.id)).toEqual(['11']);
    expect(result.needsOtherCities).toBe(true);
  });

  it('pede o carregamento das outras cidades enquanto elas não chegam', () => {
    const result = buildVenueSelectorResult({ cityVenues, query: 'londrina' });
    expect(result.needsOtherCities).toBe(true);
    expect(result.otherCities).toEqual([]);
  });

  it('não repete quadras da cidade em "outras cidades"', () => {
    const result = buildVenueSelectorResult({ cityVenues, otherVenues, query: 'zzzz' });
    expect(result.otherCities).toEqual([]);
  });
});
