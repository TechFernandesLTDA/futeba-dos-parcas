import { describe, expect, it } from 'vitest';
import { getLocationMapCenter } from './locationMapCenter';
import type { Location } from '../../types/location';

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc-1',
    name: 'Arena',
    address: 'Rua A',
    cep: '00000-000',
    street: 'Rua A',
    number: '1',
    complement: '',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    neighborhood: 'Centro',
    region: 'Centro',
    ownerId: 'owner-1',
    managers: [],
    isVerified: true,
    isActive: true,
    rating: 0,
    ratingCount: 0,
    description: '',
    amenities: [],
    openingTime: '08:00',
    closingTime: '22:00',
    operatingDays: [1, 2, 3, 4, 5],
    minGameDurationMinutes: 60,
    fieldCount: 1,
    hasActiveFields: true,
    ...overrides,
  };
}

describe('locationMapCenter', () => {
  it('prefers the user position when available', () => {
    expect(
      getLocationMapCenter([makeLocation({ latitude: -23.55, longitude: -46.63 })], {
        latitude: -22.9,
        longitude: -43.2,
      }),
    ).toEqual({
      lat: -22.9,
      lng: -43.2,
    });
  });

  it('falls back to the marker bounds midpoint', () => {
    expect(
      getLocationMapCenter([
        makeLocation({ id: 'a', latitude: -23.6, longitude: -46.7 }),
        makeLocation({ id: 'b', latitude: -23.4, longitude: -46.5 }),
      ]),
    ).toEqual({
      lat: -23.5,
      lng: -46.6,
    });
  });
});
