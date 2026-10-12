import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_NEAREST_VENUE_KM,
  SAVED_CITY_STORAGE_KEY,
  buildCityOptions,
  cityKey,
  distanceKm,
  findNearestVenueCity,
  formatCityLabel,
  isSameCity,
  latitudeBand,
  readSavedCity,
  resolveVenueCity,
  saveCity,
  toCityRef,
} from './venueCity';
import { getStateName, normalizeUf } from './brazilStates';

const venue = (id: string, city: string, state: string, latitude?: number, longitude?: number) =>
  ({ id, city, state, latitude, longitude });

const CURITIBA = { latitude: -25.4284, longitude: -49.2733 };
const SAO_PAULO = { latitude: -23.5505, longitude: -46.6333 };

describe('brazilStates', () => {
  it('normaliza sigla, nome e acento', () => {
    expect(normalizeUf('pr')).toBe('PR');
    expect(normalizeUf(' Paraná ')).toBe('PR');
    expect(normalizeUf('parana')).toBe('PR');
    expect(normalizeUf('São Paulo')).toBe('SP');
    expect(normalizeUf('')).toBe('');
    expect(normalizeUf(undefined)).toBe('');
    expect(normalizeUf('xx')).toBe('XX');
  });

  it('resolve o nome do estado', () => {
    expect(getStateName('SC')).toBe('Santa Catarina');
    expect(getStateName('zz')).toBe('ZZ');
  });
});

describe('distanceKm', () => {
  it('Curitiba → São Paulo ≈ 340 km', () => {
    const km = distanceKm(CURITIBA, SAO_PAULO);
    expect(km).toBeGreaterThan(320);
    expect(km).toBeLessThan(360);
  });

  it('mesmo ponto = 0', () => {
    expect(distanceKm(CURITIBA, CURITIBA)).toBeCloseTo(0, 5);
  });
});

describe('findNearestVenueCity', () => {
  const venues = [
    venue('a', 'Curitiba', 'PR', -25.43, -49.27),
    venue('b', 'São Paulo', 'SP', -23.55, -46.63),
    venue('c', 'Londrina', 'PR', -23.31, -51.16),
    venue('sem-coord', 'Joinville', 'SC'),
    venue('zero', 'Nulo', 'XX', 0, 0),
  ];

  it('devolve cidade/UF da quadra mais próxima', () => {
    const nearest = findNearestVenueCity({ latitude: -25.45, longitude: -49.3 }, venues);
    expect(nearest).toMatchObject({ city: 'Curitiba', state: 'PR', venueId: 'a' });
    expect(nearest!.distanceKm).toBeLessThan(10);
  });

  it('escolhe a outra cidade quando ela é a mais próxima', () => {
    const nearest = findNearestVenueCity({ latitude: -23.5, longitude: -46.7 }, venues);
    expect(nearest).toMatchObject({ city: 'São Paulo', state: 'SP' });
  });

  it('ignora quadras sem coordenadas ou em (0, 0)', () => {
    const nearest = findNearestVenueCity({ latitude: 0.1, longitude: 0.1 }, venues, 100000);
    expect(nearest?.venueId).not.toBe('zero');
    expect(nearest?.venueId).not.toBe('sem-coord');
  });

  it('devolve null quando nada está no raio', () => {
    expect(findNearestVenueCity({ latitude: 40.7, longitude: -74 }, venues)).toBeNull();
    expect(MAX_NEAREST_VENUE_KM).toBe(200);
  });

  it('devolve null sem quadras', () => {
    expect(findNearestVenueCity(CURITIBA, [])).toBeNull();
  });

  it('normaliza o nome do estado da quadra para UF', () => {
    const nearest = findNearestVenueCity(CURITIBA, [venue('x', 'Curitiba', 'Paraná', -25.4, -49.2)]);
    expect(nearest?.state).toBe('PR');
  });
});

describe('latitudeBand', () => {
  it('cria faixa simétrica em graus', () => {
    const band = latitudeBand(-25, 111);
    expect(band.min).toBeCloseTo(-26, 5);
    expect(band.max).toBeCloseTo(-24, 5);
  });
});

describe('resolveVenueCity', () => {
  const geo = { city: 'Curitiba', state: 'PR' };
  const profile = { city: 'Londrina', state: 'PR' };
  const saved = { city: 'Joinville', state: 'SC' };

  it('usa a geolocalização primeiro', () => {
    expect(resolveVenueCity({ geolocation: geo, profile, saved })).toEqual({ ref: geo, source: 'geolocation' });
  });

  it('sem geolocalização, usa a cidade do perfil', () => {
    expect(resolveVenueCity({ geolocation: null, profile, saved })).toEqual({ ref: profile, source: 'profile' });
  });

  it('sem perfil, usa a última cidade escolhida', () => {
    expect(resolveVenueCity({ saved })).toEqual({ ref: saved, source: 'saved' });
  });

  it('escolha manual vence todas', () => {
    const manual = { city: 'Belém', state: 'PA' };
    expect(resolveVenueCity({ manual, geolocation: geo, profile, saved })).toEqual({ ref: manual, source: 'manual' });
  });

  it('ignora cidade em branco', () => {
    expect(resolveVenueCity({ geolocation: { city: '  ', state: 'PR' }, profile })?.source).toBe('profile');
  });

  it('sem nenhuma fonte devolve null', () => {
    expect(resolveVenueCity({})).toBeNull();
  });
});

describe('toCityRef / cityKey / isSameCity', () => {
  it('descarta cidade vazia e normaliza UF', () => {
    expect(toCityRef('', 'PR')).toBeNull();
    expect(toCityRef(null, 'PR')).toBeNull();
    expect(toCityRef(' Curitiba ', 'paraná')).toEqual({ city: 'Curitiba', state: 'PR' });
  });

  it('compara sem acento e sem caixa', () => {
    expect(isSameCity({ city: 'São Paulo', state: 'SP' }, { city: 'sao paulo', state: 'sp' })).toBe(true);
    expect(isSameCity({ city: 'Londrina', state: 'PR' }, { city: 'Londrina', state: 'SC' })).toBe(false);
    expect(isSameCity(null, { city: 'A', state: 'B' })).toBe(false);
    expect(cityKey({ city: 'São Paulo', state: 'SP' })).toBe('SP|sao paulo');
  });

  it('formata o rótulo', () => {
    expect(formatCityLabel({ city: 'Curitiba', state: 'PR' })).toBe('Curitiba - PR');
    expect(formatCityLabel({ city: 'Curitiba', state: '' })).toBe('Curitiba');
  });
});

describe('buildCityOptions', () => {
  const venues = [
    { city: 'Curitiba', state: 'PR' },
    { city: 'curitiba', state: 'PR' },
    { city: 'Londrina', state: 'PR' },
    { city: 'Ágata', state: 'PR' },
    { city: 'Joinville', state: 'SC' },
    { city: '', state: 'SC' },
  ];

  it('agrupa cidades equivalentes e conta quadras', () => {
    const options = buildCityOptions(venues, 'PR');
    expect(options.map((o) => [o.city, o.count])).toEqual([
      ['Ágata', 1],
      ['Curitiba', 2],
      ['Londrina', 1],
    ]);
  });

  it('filtra por UF (aceita nome do estado)', () => {
    expect(buildCityOptions(venues, 'Santa Catarina').map((o) => o.city)).toEqual(['Joinville']);
  });

  it('sem UF devolve todas as cidades', () => {
    expect(buildCityOptions(venues)).toHaveLength(4);
  });
});

describe('cidade salva localmente', () => {
  beforeEach(() => localStorage.clear());

  it('salva e lê a última cidade', () => {
    saveCity({ city: 'Belém', state: 'PA' });
    expect(readSavedCity()).toEqual({ city: 'Belém', state: 'PA' });
    expect(localStorage.getItem(SAVED_CITY_STORAGE_KEY)).toContain('Belém');
  });

  it('JSON inválido ou vazio vira null', () => {
    expect(readSavedCity()).toBeNull();
    localStorage.setItem(SAVED_CITY_STORAGE_KEY, '{quebrado');
    expect(readSavedCity()).toBeNull();
  });

  it('storage que lança erro não quebra', () => {
    const broken = {
      getItem: () => { throw new Error('negado'); },
      setItem: () => { throw new Error('negado'); },
    };
    expect(readSavedCity(broken)).toBeNull();
    expect(() => saveCity({ city: 'A', state: 'B' }, broken)).not.toThrow();
  });
});
