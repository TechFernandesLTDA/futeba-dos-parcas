export type FieldType = 'SOCIETY' | 'FUTSAL' | 'CAMPO' | 'AREIA' | 'OUTROS';
export type LocationPublicationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'SUSPENDED' | 'REJECTED';
export type LocationCommercialStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
export type LocationSubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELLED';
export type LocationBillingPlanCode = 'TRIAL' | 'BASIC' | 'PRO' | 'ENTERPRISE' | 'CUSTOM';
export type LocationBillingCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CUSTOM';
export type VenueAccountBillingScope = 'OWNER' | 'LOCATION' | 'FIELD_COUNT' | 'MANUAL_OVERRIDE';
export type LocationCommercialRequestType = 'PUBLICATION' | 'COMMERCIAL_UPDATE';
export type LocationCommercialRequestStatus = 'PENDING_REVIEW' | 'NEEDS_CHANGES' | 'APPROVED' | 'REJECTED';

export const DEFAULT_LOCATION_TIME_ZONE = 'America/Sao_Paulo';

export const LOCATION_TIME_ZONE_OPTIONS = [
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-02)' },
  { value: DEFAULT_LOCATION_TIME_ZONE, label: 'Brasília / São Paulo (UTC-03)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC-04)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-04)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-05)' },
] as const;

export interface LocationHourlyPriceAggregate {
  minHourlyPriceCents: number;
  averageHourlyPriceCents: number;
  activeFieldCount: number;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  
  // Structured Address
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  
  // Detailed Location
  neighborhood: string;
  region: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  
  // Owner
  ownerId: string;
  managers: string[];
  isVerified: boolean;
  isActive: boolean;

  // Commercial publishing and billing
  publicationStatus?: LocationPublicationStatus;
  commercialStatus?: LocationCommercialStatus;
  subscriptionStatus?: LocationSubscriptionStatus;
  billingPlanCode?: LocationBillingPlanCode;
  billingPlanLabel?: string;
  billingCycle?: LocationBillingCycle;
  billingBaseFeeCents?: number;
  monthlyFeeCents?: number;
  billingDueDay?: number;
  billingStartsAt?: Date;
  billingExpiresAt?: Date;
  trialStartedAt?: Date;
  billingExceptionNote?: string;
  venueAccountId?: string;
  venueAccountStatus?: LocationSubscriptionStatus;
  venueAccountChargeScope?: VenueAccountBillingScope;
  venueAccountPlanCode?: LocationBillingPlanCode;
  venueAccountPlanLabel?: string;
  venueAccountMonthlyTotalCents?: number;
  venueAccountLinkedLocationsCount?: number;
  venueAccountActiveFieldsCount?: number;
  publishedAt?: Date;
  publishedBy?: string;
  unpublishedReason?: string;
  ownerNotes?: string;
  adminNotes?: string;
  latestCommercialRequestId?: string;
  latestCommercialRequestType?: LocationCommercialRequestType;
  latestCommercialRequestStatus?: LocationCommercialRequestStatus;
  latestCommercialRequestRequestedSections?: string[];
  latestCommercialRequestOwnerNotes?: string;
  latestCommercialRequestAdminNotes?: string;
  latestCommercialRequestPendingItemIds?: string[];
  latestCommercialRequestCommercialIssueCodes?: string[];
  latestCommercialRequestChecklistCompleted?: number;
  latestCommercialRequestChecklistTotal?: number;
  latestCommercialRequestActiveFieldCount?: number;
  latestCommercialRequestPhotoCount?: number;
  latestCommercialRequestRequestedAt?: Date;
  latestCommercialRequestUpdatedAt?: Date;
  latestCommercialRequestReviewedAt?: Date;
  
  // Rating
  rating: number;
  ratingCount: number;
  averageRating?: number;
  reviewCount?: number;
  
  // Description
  description: string;
  photoUrl?: string;
  photos?: string[];
  
  // Amenities
  amenities: string[];
  hasLighting?: boolean;
  hasParking?: boolean;
  hasShowers?: boolean;
  
  // Contact
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  
  // Operating Hours
  /** IANA timezone. Legacy records without it use DEFAULT_LOCATION_TIME_ZONE. */
  timeZone?: string;
  openingTime: string;
  closingTime: string;
  operatingDays: number[];
  minGameDurationMinutes: number;
  
  // Fields
  fieldCount: number;
  fieldType?: FieldType;
  primaryFieldType?: FieldType;
  activeFieldCount?: number;
  activeFieldTypes?: FieldType[];
  activeFieldAmenities?: string[];
  playersPerTeam?: number;
  hasActiveFields: boolean;

  // Backend-maintained commercial aggregates
  minHourlyPriceCents?: number | null;
  averageHourlyPriceCents?: number | null;
  hourlyPriceByType?: Partial<Record<FieldType, LocationHourlyPriceAggregate>>;
  amenitiesNormalized?: string[];
  gamesCount?: number;
  finishedGamesCount?: number;
  upcomingGamesCount?: number;
  gamesThisWeekCount?: number;
  gamesLast30DaysCount?: number;
  lastGameAt?: Date | null;
  lastActivityAt?: Date | null;
  locationStatsUpdatedAt?: Date | null;
  
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface Field {
  id: string;
  locationId: string;
  name: string;
  type: FieldType;
  description?: string;
  photoUrl?: string;
  isActive: boolean;
  hourlyPrice: number;
  photos: string[];
  managers: string[];
  surface?: string;
  isCovered: boolean;
  dimensions?: string;
  playersPerTeam?: number;
  minBookingMinutes?: number;
  rules?: string;
  amenities?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LocationReview {
  id: string;
  locationId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface LocationWithFields {
  location: Location;
  fields: Field[];
}

export const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; icon: string }> = {
  SOCIETY: { label: 'Society', icon: 'SportsSoccer' },
  FUTSAL: { label: 'Futsal', icon: 'SportsSoccer' },
  CAMPO: { label: 'Campo', icon: 'Yard' },
  AREIA: { label: 'Areia', icon: 'BeachAccess' },
  OUTROS: { label: 'Outros', icon: 'Sports' },
};

export const AMENITY_LABELS: Record<string, string> = {
  parking: 'Estacionamento',
  bathroom: 'Banheiro',
  locker_room: 'Vestiário',
  shower: 'Chuveiro',
  bar: 'Bar',
  restaurant: 'Restaurante',
  bbq: 'Churrasqueira',
  wifi: 'Wi-Fi',
  air_conditioning: 'Ar Condicionado',
  bleachers: 'Arquibancada',
  lighting: 'Iluminação',
  scoreboard: 'Placar Eletrônico',
  covered: 'Cobertura',
  security: 'Segurança',
  accessibility: 'Acessibilidade',
};

export const COMMERCIAL_AMENITIES = [
  'parking',
  'bathroom',
  'locker_room',
  'shower',
  'bbq',
  'bar',
  'restaurant',
  'wifi',
  'bleachers',
  'lighting',
  'covered',
] as const;

export const LOCATION_PUBLICATION_STATUS_LABELS: Record<LocationPublicationStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicado',
  SUSPENDED: 'Suspenso',
  REJECTED: 'Reprovado',
};

export const LOCATION_SUBSCRIPTION_STATUS_LABELS: Record<LocationSubscriptionStatus, string> = {
  TRIAL: 'Teste',
  ACTIVE: 'Em dia',
  OVERDUE: 'Vencido',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
};

export const LOCATION_BILLING_PLAN_LABELS: Record<LocationBillingPlanCode, string> = {
  TRIAL: 'Teste',
  BASIC: 'Básico',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
  CUSTOM: 'Personalizado',
};

export const LOCATION_BILLING_CYCLE_LABELS: Record<LocationBillingCycle, string> = {
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  CUSTOM: 'Personalizado',
};

export function canManageLocation(location: Location, userId: string): boolean {
  return location.ownerId === userId || location.managers.includes(userId);
}

export function isLocationCommerciallyAvailable(location: Location): boolean {
  const publicationStatus = location.publicationStatus ||
    (location.isVerified ? 'PUBLISHED' : 'PENDING_REVIEW');
  const subscriptionStatus = location.subscriptionStatus || 'ACTIVE';
  return location.isActive === true &&
    location.isVerified === true &&
    publicationStatus === 'PUBLISHED' &&
    ['TRIAL', 'ACTIVE'].includes(subscriptionStatus) &&
    location.hasActiveFields !== false;
}

export function getLocationAmenitySet(location: Location): Set<string> {
  const amenities = new Set(location.amenities || []);
  if (location.hasParking) amenities.add('parking');
  if (location.hasShowers) {
    amenities.add('shower');
    amenities.add('locker_room');
  }
  if (location.hasLighting) amenities.add('lighting');
  return amenities;
}

export function locationHasAmenities(location: Location, requiredAmenities: string[]): boolean {
  if (requiredAmenities.length === 0) return true;
  const amenities = getLocationAmenitySet(location);
  return requiredAmenities.every((amenity) => amenities.has(amenity));
}

export function getFullAddress(location: Location): string {
  if (location.city && location.state) {
    return `${location.address} - ${location.city}, ${location.state}`;
  }
  return location.address;
}

const WEEKDAY_TO_OPERATING_DAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const locationTimeFormatters = new Map<string, Intl.DateTimeFormat | null>();

function getLocationTimeFormatter(timeZone: string): Intl.DateTimeFormat | null {
  if (locationTimeFormatters.has(timeZone)) {
    return locationTimeFormatters.get(timeZone) ?? null;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    // Construction may be lazy in some engines, so force timezone resolution.
    formatter.format(new Date(0));
    locationTimeFormatters.set(timeZone, formatter);
    return formatter;
  } catch {
    locationTimeFormatters.set(timeZone, null);
    return null;
  }
}

export function isValidLocationTimeZone(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    getLocationTimeFormatter(value.trim()) !== null;
}

function parseOperatingTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getCivilTime(
  instant: Date,
  timeZone: string,
): { operatingDay: number; minutes: number } | null {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) return null;
  const formatter = getLocationTimeFormatter(timeZone);
  if (!formatter) return null;

  const parts = formatter.formatToParts(instant);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  const operatingDay = weekday ? WEEKDAY_TO_OPERATING_DAY[weekday] : undefined;

  if (!operatingDay || !Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return { operatingDay, minutes: hour * 60 + minute };
}

/**
 * Evaluates one absolute instant in the venue's civil timezone.
 * Overnight ranges belong to the day on which they open.
 */
export function isLocationOpenAt(location: Location, instant = new Date()): boolean {
  if (!location.isActive) return false;

  const operatingDays = Array.isArray(location.operatingDays) ? location.operatingDays : [];
  if (operatingDays.length === 0 ||
    !operatingDays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)) {
    return false;
  }

  const openingMinutes = parseOperatingTime(location.openingTime);
  const closingMinutes = parseOperatingTime(location.closingTime);
  if (openingMinutes === null || closingMinutes === null || openingMinutes === closingMinutes) {
    return false;
  }

  const rawTimeZone: unknown = location.timeZone;
  if (rawTimeZone !== undefined && rawTimeZone !== null && typeof rawTimeZone !== 'string') {
    return false;
  }
  const timeZone = typeof rawTimeZone !== 'string' || rawTimeZone.trim() === ''
    ? DEFAULT_LOCATION_TIME_ZONE
    : rawTimeZone.trim();
  const civilTime = getCivilTime(instant, timeZone);
  if (!civilTime) return false;

  if (closingMinutes > openingMinutes) {
    return operatingDays.includes(civilTime.operatingDay) &&
      civilTime.minutes >= openingMinutes &&
      civilTime.minutes <= closingMinutes;
  }

  if (civilTime.minutes >= openingMinutes) {
    return operatingDays.includes(civilTime.operatingDay);
  }
  if (civilTime.minutes <= closingMinutes) {
    const openingDay = civilTime.operatingDay === 1 ? 7 : civilTime.operatingDay - 1;
    return operatingDays.includes(openingDay);
  }
  return false;
}

export function isOpenNow(location: Location): boolean {
  return isLocationOpenAt(location);
}
