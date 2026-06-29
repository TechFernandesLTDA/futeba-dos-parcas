import { describe, expect, it } from 'vitest';
import { Field, Location } from '../../types/location';
import {
  getLocationCommercialIssues,
  getLocationPublicationStatus,
  getLocationQualityChecklist,
  locationMatchesManageFilters,
  ManageLocationFilterState,
} from './manageLocationFilters';

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
  ownerId: 'owner-123',
  managers: [],
  isVerified: true,
  isActive: true,
  publicationStatus: 'PUBLISHED',
  subscriptionStatus: 'ACTIVE',
  monthlyFeeCents: 19990,
  billingDueDay: 10,
  rating: 4.8,
  ratingCount: 12,
  description: 'Quadra pronta para jogos.',
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
  ...overrides,
});

const baseFilters = (overrides: Partial<ManageLocationFilterState> = {}): ManageLocationFilterState => ({
  searchQuery: '',
  ownerFilter: '',
  publicationFilter: 'ALL',
  subscriptionFilter: 'ALL',
  typeFilter: 'ALL',
  cityFilter: 'ALL',
  dueFilter: 'ALL',
  verifiedFilter: 'ALL',
  activeFilter: 'ALL',
  activeFieldsFilter: 'ALL',
  monthlyFeeFilter: 'ALL',
  amenityFilters: [],
  ...overrides,
});

const baseField = (overrides: Partial<Field> = {}): Field => ({
  id: 'field-1',
  locationId: 'loc-1',
  name: 'Campo 1',
  type: 'SOCIETY',
  isActive: true,
  hourlyPrice: 18000,
  photos: [],
  managers: [],
  isCovered: false,
  ...overrides,
});

describe('manageLocationFilters', () => {
  it('usa verificação como fallback para status de publicação legado', () => {
    expect(getLocationPublicationStatus(baseLocation({ publicationStatus: undefined, isVerified: true })))
      .toBe('PUBLISHED');
    expect(getLocationPublicationStatus(baseLocation({ publicationStatus: undefined, isVerified: false })))
      .toBe('PENDING_REVIEW');
  });

  it('filtra por status comercial, mensalidade, dono, cidade e amenidades', () => {
    const location = baseLocation();

    expect(locationMatchesManageFilters(location, baseFilters({
      verifiedFilter: 'YES',
      activeFilter: 'YES',
      activeFieldsFilter: 'YES',
      monthlyFeeFilter: '100_300',
      ownerFilter: 'owner',
      cityFilter: 'São Paulo',
      amenityFilters: ['parking', 'bathroom'],
    }))).toBe(true);

    expect(locationMatchesManageFilters(location, baseFilters({ monthlyFeeFilter: 'NO_FEE' })))
      .toBe(false);
    expect(locationMatchesManageFilters(location, baseFilters({ activeFieldsFilter: 'NO' })))
      .toBe(false);
  });

  it('explica pendências comerciais que impedem disponibilidade pública', () => {
    const issues = getLocationCommercialIssues(baseLocation({
      isActive: false,
      isVerified: false,
      publicationStatus: 'DRAFT',
      subscriptionStatus: 'OVERDUE',
      fieldCount: 0,
      hasActiveFields: false,
      monthlyFeeCents: 0,
      billingDueDay: undefined,
      city: '',
      state: '',
    }));

    expect(issues).toEqual([
      'inativa',
      'não verificada',
      'não publicada',
      'mensalidade irregular',
      'sem quadras cadastradas',
      'sem quadras ativas',
      'sem mensalidade',
      'sem vencimento',
      'endereço incompleto',
    ]);
  });

  it('gera checklist de qualidade para publicação da quadra', () => {
    const checklist = getLocationQualityChecklist(
      baseLocation({ phone: '11999999999', photoUrl: 'https://example.com/photo.jpg' }),
      [baseField()],
      ['https://example.com/photo.jpg'],
    );

    expect(checklist).toHaveLength(9);
    expect(checklist.every((item) => item.complete)).toBe(true);

    const incomplete = getLocationQualityChecklist(
      baseLocation({
        description: '',
        phone: undefined,
        whatsapp: undefined,
        website: undefined,
        instagram: undefined,
        amenities: [],
        hasParking: false,
        hasLighting: false,
        hasShowers: false,
        monthlyFeeCents: 0,
        billingDueDay: undefined,
        hasActiveFields: false,
      }),
      [baseField({ hourlyPrice: 0, isActive: false })],
      [],
    );

    expect(incomplete.filter((item) => !item.complete).map((item) => item.id))
      .toEqual(['identity', 'contact', 'photos', 'active-fields', 'pricing', 'amenities', 'commercial']);
  });
});
