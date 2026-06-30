import { describe, expect, it } from 'vitest';
import { Location } from '../../types/location';
import {
  getBestRatedLocations,
  getCheapestLocationsByType,
} from './manageLocationRankings';

const availableLocation = (override: Partial<Location>): Location => ({
  id: 'loc-base',
  name: 'Arena Base',
  address: 'Rua 1',
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: 'Sao Paulo',
  state: 'SP',
  country: 'BR',
  neighborhood: '',
  region: '',
  ownerId: 'owner-1',
  managers: [],
  isVerified: true,
  isActive: true,
  publicationStatus: 'PUBLISHED',
  subscriptionStatus: 'ACTIVE',
  rating: 0,
  ratingCount: 0,
  description: '',
  amenities: [],
  openingTime: '08:00',
  closingTime: '22:00',
  operatingDays: [1, 2, 3, 4, 5],
  minGameDurationMinutes: 60,
  fieldCount: 1,
  activeFieldCount: 1,
  hasActiveFields: true,
  ...override,
});

describe('manageLocationRankings', () => {
  it('ordena melhores quadras por nota, avaliacoes e jogos reais', () => {
    const result = getBestRatedLocations([
      availableLocation({
        id: 'b',
        name: 'Arena Beta',
        averageRating: 4.7,
        ratingCount: 20,
        gamesCount: 5,
      }),
      availableLocation({
        id: 'a',
        name: 'Arena Alfa',
        averageRating: 4.8,
        ratingCount: 2,
        gamesCount: 10,
      }),
      availableLocation({
        id: 'c',
        name: 'Arena Copa',
        averageRating: 4.7,
        ratingCount: 20,
        gamesCount: 8,
      }),
      availableLocation({
        id: 'draft',
        name: 'Rascunho',
        averageRating: 5,
        ratingCount: 99,
        publicationStatus: 'PENDING_REVIEW',
      }),
    ]);

    expect(result.map((item) => item.location.id)).toEqual(['a', 'c', 'b']);
  });

  it('seleciona a quadra mais barata por tipo usando agregados do backend', () => {
    const result = getCheapestLocationsByType([
      availableLocation({
        id: 'society-expensive',
        name: 'Society Premium',
        activeFieldTypes: ['SOCIETY'],
        hourlyPriceByType: {
          SOCIETY: {
            minHourlyPriceCents: 18000,
            averageHourlyPriceCents: 22000,
            activeFieldCount: 2,
          },
        },
      }),
      availableLocation({
        id: 'combo',
        name: 'Arena Combo',
        activeFieldTypes: ['FUTSAL', 'SOCIETY'],
        hourlyPriceByType: {
          FUTSAL: {
            minHourlyPriceCents: 9000,
            averageHourlyPriceCents: 9000,
            activeFieldCount: 1,
          },
          SOCIETY: {
            minHourlyPriceCents: 12000,
            averageHourlyPriceCents: 15000,
            activeFieldCount: 2,
          },
        },
      }),
      availableLocation({
        id: 'campo-fallback',
        name: 'Campo Raiz',
        primaryFieldType: 'CAMPO',
        minHourlyPriceCents: 15000,
      }),
    ]);

    expect(result.map((item) => [item.fieldType, item.location.id, item.priceCents]))
      .toEqual([
        ['FUTSAL', 'combo', 9000],
        ['SOCIETY', 'combo', 12000],
        ['CAMPO', 'campo-fallback', 15000],
      ]);
  });
});
