import { describe, expect, it } from 'vitest';
import { Field, isLocationCommerciallyAvailable, Location } from '../../types/location';
import {
  getLocationCommercialIssues,
  getLocationPublicationStatus,
  getLocationQualityChecklist,
  getLocationSubscriptionStatus,
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
  stateFilters: [],
  cityFilters: [],
  neighborhoodFilters: [],
  quickFilters: [],
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
  playersPerTeam: 7,
  minBookingMinutes: 60,
  surface: 'Grama sintética',
  dimensions: '40m x 20m',
  rules: 'Usar chuteira society.',
  amenities: ['lighting'],
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
      cityFilters: ['São Paulo'],
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

  it('prioriza pendência da conta agregada sem duplicar mensalidade irregular', () => {
    const issues = getLocationCommercialIssues(baseLocation({
      subscriptionStatus: 'ACTIVE',
      venueAccountId: 'owner-123',
      venueAccountStatus: 'OVERDUE',
    }));

    expect(issues).toContain('conta comercial irregular');
    expect(issues).not.toContain('mensalidade irregular');
  });

  // #4110: venueAccountStatus (só admin escreve, na mão) não pode sombrear
  // subscriptionStatus (o cron de cobrança escreve todo dia). Uma quadra que
  // o cron suspendeu por inadimplência precisa continuar aparecendo como
  // SUSPENDED — e com pendência — mesmo com a conta comercial congelada em
  // ACTIVE.
  it('não deixa a conta comercial congelada (ACTIVE) esconder a mensalidade suspensa pelo cron', () => {
    const location = baseLocation({
      subscriptionStatus: 'SUSPENDED',
      venueAccountId: 'owner-123',
      venueAccountStatus: 'ACTIVE',
    });

    expect(getLocationSubscriptionStatus(location)).toBe('SUSPENDED');

    const issues = getLocationCommercialIssues(location);
    expect(issues).toContain('mensalidade irregular');
    expect(issues).not.toContain('conta comercial irregular');

    expect(locationMatchesManageFilters(location, baseFilters({ subscriptionFilter: 'SUSPENDED' })))
      .toBe(true);
    expect(locationMatchesManageFilters(location, baseFilters({ subscriptionFilter: 'ACTIVE' })))
      .toBe(false);
  });

  it('mantém disponibilidade pública baseada no status individual da quadra', () => {
    expect(isLocationCommerciallyAvailable(baseLocation({
      subscriptionStatus: 'ACTIVE',
      venueAccountId: 'owner-123',
      venueAccountStatus: 'OVERDUE',
    }))).toBe(true);

    expect(isLocationCommerciallyAvailable(baseLocation({
      subscriptionStatus: 'OVERDUE',
      venueAccountId: 'owner-123',
      venueAccountStatus: 'ACTIVE',
    }))).toBe(false);
  });

  it('gera checklist de qualidade para publicação da quadra', () => {
    const checklist = getLocationQualityChecklist(
      baseLocation({ phone: '11999999999', photoUrl: 'https://example.com/photo.jpg' }),
      [baseField()],
      ['https://example.com/photo.jpg'],
    );

    expect(checklist).toHaveLength(12);
    expect(checklist.every((item) => item.complete)).toBe(true);

    const incomplete = getLocationQualityChecklist(
      baseLocation({
        description: '',
        phone: undefined,
        whatsapp: undefined,
        website: undefined,
        instagram: undefined,
        latitude: undefined,
        longitude: undefined,
        openingTime: '',
        closingTime: '',
        operatingDays: [],
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
      .toEqual([
        'identity',
        'contact',
        'geolocation',
        'operating-hours',
        'photos',
        'active-fields',
        'pricing',
        'field-details',
        'amenities',
        'commercial',
      ]);
  });

  it('marca pendencia quando campos ativos nao possuem detalhes operacionais completos', () => {
    const checklist = getLocationQualityChecklist(
      baseLocation({ phone: '11999999999', photoUrl: 'https://example.com/photo.jpg' }),
      [baseField({
        playersPerTeam: undefined,
        minBookingMinutes: undefined,
        surface: '',
        dimensions: '',
        rules: '',
        amenities: [],
        isCovered: false,
      })],
      ['https://example.com/photo.jpg'],
    );

    expect(checklist.find((item) => item.id === 'field-details')?.complete).toBe(false);
  });

  it('marca pendencia quando horarios ou geolocalizacao nao foram definidos', () => {
    const checklist = getLocationQualityChecklist(
      baseLocation({
        phone: '11999999999',
        photoUrl: 'https://example.com/photo.jpg',
        latitude: undefined,
        longitude: undefined,
        operatingDays: [],
      }),
      [baseField()],
      ['https://example.com/photo.jpg'],
    );

    expect(checklist.find((item) => item.id === 'geolocation')?.complete).toBe(false);
    expect(checklist.find((item) => item.id === 'operating-hours')?.complete).toBe(false);
  });
});

describe('busca inteligente do admin (#4372)', () => {
  const venue = baseLocation({
    id: 'abc123',
    name: 'Arena Jardim Society',
    district: 'Jardim Botânico',
    neighborhood: 'Jardim Botânico',
    city: 'Curitiba',
    state: 'PR',
    cep: '80210-000',
    phone: '(41) 99999-1234',
    ownerId: 'uid-dono-xyz',
  });
  const matches = (searchQuery: string) =>
    locationMatchesManageFilters(venue, baseFilters({ searchQuery }));

  it('ignora acento, caixa e aceita vários termos', () => {
    expect(matches('ARENA botanico')).toBe(true);
    expect(matches('arena londrina')).toBe(false);
  });

  it('aceita prefixo, abreviações e 1 erro de digitação', () => {
    expect(matches('jd bot')).toBe(true);
    expect(matches('soc curit')).toBe(true);
    expect(matches('curtiba')).toBe(true);
  });

  it('procura por UF, CEP, telefone, id e dono', () => {
    expect(matches('pr')).toBe(true);
    expect(matches('80210')).toBe(true);
    expect(matches('99999-1234')).toBe(true);
    expect(matches('abc123')).toBe(true);
    expect(matches('uid-dono')).toBe(true);
    expect(matches('uid-outro')).toBe(false);
  });
});

describe('filtros geográficos e atalhos do admin (#4372)', () => {
  const curitiba = baseLocation({ id: 'c1', city: 'Curitiba', state: 'PR', neighborhood: 'Água Verde', district: 'Água Verde' });
  const londrina = baseLocation({ id: 'l1', city: 'Londrina', state: 'PR', neighborhood: 'Centro', district: 'Centro' });
  const joinville = baseLocation({ id: 'j1', city: 'Joinville', state: 'SC', neighborhood: 'Centro', district: 'Centro' });
  const ids = (filters: Partial<ManageLocationFilterState>) =>
    [curitiba, londrina, joinville]
      .filter((loc) => locationMatchesManageFilters(loc, baseFilters(filters)))
      .map((loc) => loc.id);

  it('filtra por UF, com multi-seleção e sigla em qualquer caixa', () => {
    expect(ids({ stateFilters: ['PR'] })).toEqual(['c1', 'l1']);
    expect(ids({ stateFilters: ['pr', 'SC'] })).toEqual(['c1', 'l1', 'j1']);
  });

  it('filtra por cidade e bairro sem acento/caixa, com multi-seleção', () => {
    expect(ids({ cityFilters: ['curitiba', 'JOINVILLE'] })).toEqual(['c1', 'j1']);
    expect(ids({ neighborhoodFilters: ['agua verde'] })).toEqual(['c1']);
    expect(ids({ neighborhoodFilters: ['Centro'] })).toEqual(['l1', 'j1']);
  });

  it('combina UF + bairro (E entre níveis, OU dentro do nível)', () => {
    expect(ids({ stateFilters: ['SC'], neighborhoodFilters: ['Centro'] })).toEqual(['j1']);
  });

  it('skipGeo ignora a dimensão pedida', () => {
    const filters = baseFilters({ stateFilters: ['SC'] });
    expect(locationMatchesManageFilters(curitiba, filters, ['state'])).toBe(true);
    expect(locationMatchesManageFilters(curitiba, filters)).toBe(false);
  });

  it('atalho "Rascunhos importados": DRAFT e não verificada', () => {
    const draft = baseLocation({ id: 'd', publicationStatus: 'DRAFT', isVerified: false });
    const published = baseLocation({ id: 'p' });
    const filters = baseFilters({ quickFilters: ['DRAFT_IMPORTED'] });
    expect(locationMatchesManageFilters(draft, filters)).toBe(true);
    expect(locationMatchesManageFilters(published, filters)).toBe(false);
  });

  it('atalho "Não verificadas"', () => {
    const filters = baseFilters({ quickFilters: ['UNVERIFIED'] });
    expect(locationMatchesManageFilters(baseLocation({ isVerified: false }), filters)).toBe(true);
    expect(locationMatchesManageFilters(baseLocation({ isVerified: true }), filters)).toBe(false);
  });

  it('atalho "Sem coordenadas": ausentes ou (0, 0)', () => {
    const filters = baseFilters({ quickFilters: ['NO_COORDINATES'] });
    expect(locationMatchesManageFilters(baseLocation({ latitude: undefined, longitude: undefined }), filters)).toBe(true);
    expect(locationMatchesManageFilters(baseLocation({ latitude: 0, longitude: 0 }), filters)).toBe(true);
    expect(locationMatchesManageFilters(baseLocation(), filters)).toBe(false);
  });

  it('atalho "Sem telefone"', () => {
    const filters = baseFilters({ quickFilters: ['NO_PHONE'] });
    expect(locationMatchesManageFilters(baseLocation({ phone: undefined }), filters)).toBe(true);
    expect(locationMatchesManageFilters(baseLocation({ phone: '  ' }), filters)).toBe(true);
    expect(locationMatchesManageFilters(baseLocation({ phone: '(41) 3333-0000' }), filters)).toBe(false);
  });

  it('atalhos combinam entre si (E)', () => {
    const filters = baseFilters({ quickFilters: ['UNVERIFIED', 'NO_PHONE'] });
    expect(locationMatchesManageFilters(baseLocation({ isVerified: false, phone: undefined }), filters)).toBe(true);
    expect(locationMatchesManageFilters(baseLocation({ isVerified: false, phone: '123' }), filters)).toBe(false);
  });

  it('os filtros antigos continuam valendo junto com a geografia', () => {
    expect(ids({ stateFilters: ['PR'], publicationFilter: 'DRAFT' })).toEqual([]);
    expect(ids({ stateFilters: ['PR'], publicationFilter: 'PUBLISHED' })).toEqual(['c1', 'l1']);
  });
});
