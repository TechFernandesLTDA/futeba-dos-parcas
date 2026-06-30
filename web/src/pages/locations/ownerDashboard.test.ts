import { describe, expect, it } from 'vitest';
import { Field } from '../../types/location';
import {
  calculateOwnerDashboardStats,
  OwnerDashboardGame,
  OwnerDashboardLocationLike,
  summarizeOwnerLocationStatus,
} from './ownerDashboard';

const baseLocation = (overrides: Partial<OwnerDashboardLocationLike> = {}): OwnerDashboardLocationLike => ({
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
  latitude: -23.55052,
  longitude: -46.633308,
  ownerId: 'owner-123',
  managers: [],
  isVerified: true,
  isActive: true,
  publicationStatus: 'PUBLISHED',
  subscriptionStatus: 'ACTIVE',
  monthlyFeeCents: 19990,
  billingDueDay: 10,
  venueAccountStatus: 'ACTIVE',
  rating: 4.8,
  ratingCount: 12,
  description: 'Quadra pronta para jogos.',
  photoUrl: 'https://example.com/location.jpg',
  photos: ['https://example.com/location.jpg'],
  amenities: ['parking', 'bathroom'],
  phone: '11999999999',
  openingTime: '08:00',
  closingTime: '23:00',
  operatingDays: [1, 2, 3, 4, 5, 6],
  minGameDurationMinutes: 60,
  fieldCount: 2,
  fieldType: 'SOCIETY',
  primaryFieldType: 'SOCIETY',
  playersPerTeam: 7,
  hasActiveFields: true,
  ...overrides,
});

const baseField = (overrides: Partial<Field> = {}): Field => ({
  id: `field-${Math.random()}`,
  locationId: 'loc-1',
  name: 'Campo 1',
  type: 'SOCIETY',
  isActive: true,
  hourlyPrice: 18000,
  photos: [],
  managers: [],
  isCovered: false,
  playersPerTeam: 7,
  minBookingMinutes: 60,
  surface: 'Grama sintética',
  dimensions: '40m x 20m',
  rules: 'Usar chuteira society.',
  amenities: ['lighting'],
  ...overrides,
});

const baseGame = (overrides: Partial<OwnerDashboardGame> = {}): OwnerDashboardGame => ({
  id: 'game-1',
  locationId: 'loc-1',
  status: 'SCHEDULED',
  dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  deletedAt: null,
  ...overrides,
});

describe('ownerDashboard', () => {
  it('resume status comercial, checklist e preco da quadra', () => {
    const summary = summarizeOwnerLocationStatus(
      baseLocation(),
      [
        baseField({ id: 'field-1', hourlyPrice: 18000 }),
        baseField({ id: 'field-2', hourlyPrice: 22000 }),
      ],
      [baseGame()],
    );

    expect(summary.commerciallyAvailable).toBe(true);
    expect(summary.checklistCompleted).toBe(summary.checklistTotal);
    expect(summary.pendingCount).toBe(0);
    expect(summary.averageHourlyPriceCents).toBe(20000);
    expect(summary.minHourlyPriceCents).toBe(18000);
    expect(summary.upcomingGames).toBe(1);
  });

  it('expoe pendencias quando cadastro e mensalidade nao estao prontos', () => {
    const summary = summarizeOwnerLocationStatus(
      baseLocation({
        isVerified: false,
        publicationStatus: 'DRAFT',
        subscriptionStatus: 'OVERDUE',
        venueAccountStatus: undefined,
        monthlyFeeCents: 0,
        billingDueDay: null,
        description: '',
        photoUrl: undefined,
        photos: [],
        amenities: [],
        phone: undefined,
        whatsapp: undefined,
        website: undefined,
        instagram: undefined,
      }),
      [baseField({ hourlyPrice: 0, isActive: false })],
      [],
    );

    expect(summary.commerciallyAvailable).toBe(false);
    expect(summary.pendingCount).toBeGreaterThan(0);
    expect(summary.pendingItems).toEqual(
      expect.arrayContaining([
        'Identidade e descrição',
        'Fotos reais',
        'Publicação e mensalidade',
      ]),
    );
  });

  it('sinaliza status agregado irregular sem derrubar disponibilidade individual', () => {
    const summary = summarizeOwnerLocationStatus(
      baseLocation({
        subscriptionStatus: 'ACTIVE',
        venueAccountId: 'owner-123',
        venueAccountStatus: 'SUSPENDED',
      }),
      [baseField()],
      [],
    );

    expect(summary.subscriptionStatus).toBe('SUSPENDED');
    expect(summary.commerciallyAvailable).toBe(true);
    expect(summary.commercialIssues).toContain('conta comercial irregular');
    expect(summary.commercialIssues).not.toContain('mensalidade irregular');
  });

  it('calcula os agregados do dashboard do owner', () => {
    const locations = [
      baseLocation({ id: 'loc-1', rating: 5, ratingCount: 10 }),
      baseLocation({
        id: 'loc-2',
        name: 'Arena Sul',
        city: 'Santo André',
        rating: 4,
        ratingCount: 5,
        publicationStatus: 'DRAFT',
        subscriptionStatus: 'TRIAL',
        monthlyFeeCents: 0,
        billingDueDay: null,
        description: '',
        photos: [],
        photoUrl: undefined,
        phone: undefined,
        hasActiveFields: false,
      }),
    ];

    const stats = calculateOwnerDashboardStats(
      locations,
      {
        'loc-1': [baseField({ id: 'loc-1-field', locationId: 'loc-1', hourlyPrice: 20000 })],
        'loc-2': [baseField({ id: 'loc-2-field', locationId: 'loc-2', hourlyPrice: 10000, isActive: true })],
      },
      [
        baseGame({ id: 'game-1', locationId: 'loc-1' }),
        baseGame({ id: 'game-2', locationId: 'loc-2', dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }),
      ],
    );

    expect(stats.upcomingGames).toBe(2);
    expect(stats.averageHourlyPriceCents).toBe(15000);
    expect(stats.averageRating).toBeCloseTo(4.67, 2);
    expect(stats.publishedLocations).toBe(1);
    expect(stats.pendingLocations).toBe(1);
  });
});
