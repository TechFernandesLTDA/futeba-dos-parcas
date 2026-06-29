import { describe, expect, it } from 'vitest';
import { FieldType, Location } from '../../types/location';
import {
  PublicLocationFilterState,
  countActivePublicLocationFilters,
  filterAndSortPublicLocations,
  getDistanceKm,
  getPublicLocationAreaOptions,
  isPublicLocationOpenAt,
  parseHourlyPriceFilter,
} from './publicLocationFilters';

const baseLocation = (overrides: Partial<Location> = {}): Location => ({
  id: 'loc-1',
  name: 'Arena Parças',
  address: 'Rua Bola 10',
  cep: '01000-000',
  street: 'Rua Bola',
  number: '10',
  complement: '',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  country: 'BR',
  neighborhood: 'Centro',
  region: 'Zona Sul',
  ownerId: 'owner-1',
  managers: [],
  isVerified: true,
  isActive: true,
  publicationStatus: 'PUBLISHED',
  subscriptionStatus: 'ACTIVE',
  rating: 4.5,
  ratingCount: 10,
  averageRating: 4.5,
  reviewCount: 10,
  description: 'Quadra pronta para jogo.',
  amenities: ['parking', 'bathroom'],
  openingTime: '08:00',
  closingTime: '23:00',
  operatingDays: [1, 2, 3, 4, 5, 6],
  minGameDurationMinutes: 60,
  fieldCount: 2,
  fieldType: 'SOCIETY',
  primaryFieldType: 'SOCIETY',
  playersPerTeam: 7,
  hasActiveFields: true,
  latitude: -23.55,
  longitude: -46.63,
  ...overrides,
});

const baseFilters = (overrides: Partial<PublicLocationFilterState> = {}): PublicLocationFilterState => ({
  searchQuery: '',
  typeFilter: 'ALL',
  areaFilter: 'ALL',
  maxHourlyPrice: '',
  amenityFilters: [],
  openNowOnly: false,
  sortBy: 'RELEVANCE',
  ...overrides,
});

describe('publicLocationFilters', () => {
  it('filtra por busca, area, tipo vindo dos campos, preco, comodidades e aberta agora', () => {
    const locations = [
      baseLocation({ id: 'loc-1', name: 'Arena Parças', district: 'Centro' }),
      baseLocation({
        id: 'loc-2',
        name: 'Campo Distante',
        district: 'Mooca',
        amenities: ['bbq'],
        fieldType: 'CAMPO',
        primaryFieldType: 'CAMPO',
      }),
    ];

    const result = filterAndSortPublicLocations(
      locations,
      baseFilters({
        searchQuery: 'parcas',
        typeFilter: 'FUTSAL',
        areaFilter: 'Centro, São Paulo',
        maxHourlyPrice: '150',
        amenityFilters: ['parking'],
        openNowOnly: true,
      }),
      {
        minPriceByLocation: { 'loc-1': 12000, 'loc-2': 9000 },
        fieldTypesByLocation: { 'loc-1': ['FUTSAL' as FieldType] },
        now: new Date('2026-06-29T12:00:00-03:00'),
      },
    );

    expect(result.map((location) => location.id)).toEqual(['loc-1']);
  });

  it('ordena por melhor avaliada, mais barata, mais proxima e mais usada', () => {
    const locations = [
      baseLocation({ id: 'cheap', name: 'Barata', rating: 4.1, averageRating: 4.1, ratingCount: 5, reviewCount: 5, latitude: -23.55, longitude: -46.63 }),
      baseLocation({ id: 'rated', name: 'Top', rating: 4.9, averageRating: 4.9, ratingCount: 15, reviewCount: 15, latitude: -23.8, longitude: -46.8 }),
      baseLocation({ id: 'used', name: 'Movimentada', rating: 4.4, averageRating: 4.4, ratingCount: 80, reviewCount: 80, latitude: -23.56, longitude: -46.64 }),
    ];

    const metrics = {
      minPriceByLocation: { cheap: 8000, rated: 18000, used: 12000 },
      fieldTypesByLocation: {},
      userPosition: { latitude: -23.551, longitude: -46.631 },
    };

    expect(filterAndSortPublicLocations(locations, baseFilters({ sortBy: 'BEST_RATED' }), metrics)[0].id)
      .toBe('rated');
    expect(filterAndSortPublicLocations(locations, baseFilters({ sortBy: 'CHEAPEST' }), metrics)[0].id)
      .toBe('cheap');
    expect(filterAndSortPublicLocations(locations, baseFilters({ sortBy: 'NEAREST' }), metrics)[0].id)
      .toBe('cheap');
    expect(filterAndSortPublicLocations(locations, baseFilters({ sortBy: 'MOST_USED' }), metrics)[0].id)
      .toBe('used');
  });

  it('calcula area, preco, distancia e filtros ativos de forma tolerante', () => {
    expect(getPublicLocationAreaOptions([
      baseLocation({ district: 'Centro', city: 'São Paulo' }),
      baseLocation({ district: 'Centro', city: 'São Paulo' }),
      baseLocation({ district: '', neighborhood: 'Savassi', city: 'Belo Horizonte' }),
    ])).toEqual(['Centro, São Paulo', 'Savassi, Belo Horizonte']);

    expect(parseHourlyPriceFilter('120,50')).toBe(12050);
    expect(parseHourlyPriceFilter('abc')).toBeNull();
    expect(getDistanceKm(baseLocation(), { latitude: -23.55, longitude: -46.63 })).toBeLessThan(0.01);
    expect(countActivePublicLocationFilters(baseFilters({
      searchQuery: 'arena',
      maxHourlyPrice: '100',
      amenityFilters: ['bbq'],
      openNowOnly: true,
    }))).toBe(4);
  });

  it('trata horario overnight e cadastros legados sem quebrar', () => {
    expect(isPublicLocationOpenAt(
      baseLocation({ openingTime: '22:00', closingTime: '02:00', operatingDays: [1] }),
      new Date('2026-06-29T23:30:00-03:00'),
    )).toBe(true);

    expect(isPublicLocationOpenAt(
      baseLocation({ openingTime: '', closingTime: '', operatingDays: [] }),
      new Date('2026-06-29T12:00:00-03:00'),
    )).toBe(false);
  });
});
