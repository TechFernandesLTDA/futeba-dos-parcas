import {
  Field,
  Location,
  LocationBillingCycle,
  LocationBillingPlanCode,
  LocationPublicationStatus,
  LocationSubscriptionStatus,
  VenueAccountBillingScope,
  isLocationCommerciallyAvailable,
} from '../../types/location';
import {
  getLocationCommercialIssues,
  getLocationPublicationStatus,
  getLocationQualityChecklist,
  getLocationSubscriptionStatus,
} from './manageLocationFilters';

export interface OwnerDashboardGame {
  id: string;
  locationId: string;
  status?: string;
  dateTime?: Date | null;
  deletedAt?: Date | null;
}

export interface OwnerDashboardLocationLike {
  id: string;
  name: string;
  address: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  region: string;
  ownerId: string;
  managers: string[];
  isVerified: boolean;
  isActive: boolean;
  publicationStatus?: LocationPublicationStatus;
  subscriptionStatus?: LocationSubscriptionStatus;
  billingPlanCode?: LocationBillingPlanCode;
  billingPlanLabel?: string;
  billingCycle?: LocationBillingCycle;
  billingBaseFeeCents?: number;
  monthlyFeeCents?: number;
  billingDueDay?: number | null;
  billingStartsAt?: Date | null;
  billingExpiresAt?: Date | null;
  billingExceptionNote?: string;
  venueAccountId?: string;
  venueAccountStatus?: LocationSubscriptionStatus;
  venueAccountChargeScope?: VenueAccountBillingScope;
  venueAccountPlanCode?: LocationBillingPlanCode;
  venueAccountPlanLabel?: string;
  venueAccountMonthlyTotalCents?: number;
  venueAccountLinkedLocationsCount?: number;
  venueAccountActiveFieldsCount?: number;
  rating: number;
  ratingCount: number;
  description?: string;
  photoUrl?: string;
  photos?: string[];
  amenities?: string[];
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  openingTime?: string;
  closingTime?: string;
  operatingDays?: number[];
  minGameDurationMinutes?: number;
  fieldCount?: number;
  fieldType?: Field['type'];
  primaryFieldType?: Field['type'];
  playersPerTeam?: number;
  hasActiveFields?: boolean;
}

export interface OwnerDashboardLocationStatus {
  publicationStatus: LocationPublicationStatus;
  subscriptionStatus: LocationSubscriptionStatus;
  commerciallyAvailable: boolean;
  checklistCompleted: number;
  checklistTotal: number;
  pendingCount: number;
  pendingItems: string[];
  commercialIssues: string[];
  activeFieldCount: number;
  averageHourlyPriceCents: number | null;
  minHourlyPriceCents: number | null;
  upcomingGames: number;
  gamesLast30Days: number;
}

export interface OwnerDashboardStats {
  gamesLast30Days: number;
  gamesThisWeek: number;
  averageRating: number;
  totalReviews: number;
  upcomingGames: number;
  averageHourlyPriceCents: number | null;
  publishedLocations: number;
  pendingLocations: number;
  totalPendingItems: number;
}

const buildLocationCandidate = (
  location: OwnerDashboardLocationLike,
  fields: Field[],
): Location => {
  const activeFieldCount = fields.filter((field) => field.isActive !== false).length;
  const photos = location.photos?.length
    ? location.photos
    : (location.photoUrl ? [location.photoUrl] : []);

  return {
    id: location.id,
    name: location.name || 'Quadra',
    address: location.address || '',
    cep: location.cep || '',
    street: location.street || '',
    number: location.number || '',
    complement: location.complement || '',
    district: location.district || '',
    city: location.city || '',
    state: location.state || '',
    country: location.country || 'BR',
    neighborhood: location.neighborhood || location.district || '',
    region: location.region || location.state || '',
    ownerId: location.ownerId || '',
    managers: location.managers || [],
    isVerified: location.isVerified === true,
    isActive: location.isActive !== false,
    publicationStatus: location.publicationStatus,
    subscriptionStatus: location.subscriptionStatus,
    billingPlanCode: location.billingPlanCode,
    billingPlanLabel: location.billingPlanLabel,
    billingCycle: location.billingCycle,
    billingBaseFeeCents: location.billingBaseFeeCents,
    monthlyFeeCents: location.monthlyFeeCents,
    billingDueDay: location.billingDueDay ?? undefined,
    billingStartsAt: location.billingStartsAt ?? undefined,
    billingExpiresAt: location.billingExpiresAt ?? undefined,
    billingExceptionNote: location.billingExceptionNote,
    venueAccountId: location.venueAccountId,
    venueAccountStatus: location.venueAccountStatus,
    venueAccountChargeScope: location.venueAccountChargeScope,
    venueAccountPlanCode: location.venueAccountPlanCode,
    venueAccountPlanLabel: location.venueAccountPlanLabel,
    venueAccountMonthlyTotalCents: location.venueAccountMonthlyTotalCents,
    venueAccountLinkedLocationsCount: location.venueAccountLinkedLocationsCount,
    venueAccountActiveFieldsCount: location.venueAccountActiveFieldsCount,
    rating: location.rating || 0,
    ratingCount: location.ratingCount || 0,
    description: location.description || '',
    photoUrl: location.photoUrl,
    photos,
    amenities: location.amenities || [],
    phone: location.phone,
    whatsapp: location.whatsapp,
    website: location.website,
    instagram: location.instagram,
    openingTime: location.openingTime || '06:00',
    closingTime: location.closingTime || '23:00',
    operatingDays: location.operatingDays?.length ? location.operatingDays : [1, 2, 3, 4, 5, 6, 7],
    minGameDurationMinutes: location.minGameDurationMinutes || 60,
    fieldCount: location.fieldCount || fields.length,
    fieldType: location.fieldType,
    primaryFieldType: location.primaryFieldType,
    playersPerTeam: location.playersPerTeam,
    hasActiveFields: location.hasActiveFields ?? activeFieldCount > 0,
  };
};

const getLocationPriceValues = (fields: Field[]) => {
  const activeFields = fields.filter((field) => field.isActive !== false);
  const candidateFields = activeFields.length > 0 ? activeFields : fields;
  const prices = candidateFields
    .map((field) => field.hourlyPrice)
    .filter((value): value is number => Number.isFinite(value) && value > 0);

  if (prices.length === 0) {
    return {
      averageHourlyPriceCents: null,
      minHourlyPriceCents: null,
    };
  }

  const total = prices.reduce((sum, value) => sum + value, 0);
  return {
    averageHourlyPriceCents: Math.round(total / prices.length),
    minHourlyPriceCents: Math.min(...prices),
  };
};

const getLocationGamesStats = (games: OwnerDashboardGame[]) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const activeGames = games.filter((game) => !game.deletedAt && game.status !== 'CANCELLED');

  return {
    gamesLast30Days: activeGames.filter((game) =>
      game.dateTime && game.dateTime >= thirtyDaysAgo && game.dateTime <= now,
    ).length,
    upcomingGames: activeGames.filter((game) =>
      game.dateTime && game.dateTime > now && ['SCHEDULED', 'CONFIRMED'].includes(game.status || ''),
    ).length,
    gamesThisWeek: activeGames.filter((game) =>
      game.dateTime && game.dateTime >= now && game.dateTime <= weekEnd && ['SCHEDULED', 'CONFIRMED'].includes(game.status || ''),
    ).length,
  };
};

export const summarizeOwnerLocationStatus = (
  location: OwnerDashboardLocationLike,
  fields: Field[] = [],
  games: OwnerDashboardGame[] = [],
): OwnerDashboardLocationStatus => {
  const locationCandidate = buildLocationCandidate(location, fields);
  const checklist = getLocationQualityChecklist(
    locationCandidate,
    fields,
    locationCandidate.photos || [],
  );
  const pendingItems = checklist.filter((item) => !item.complete).map((item) => item.label);
  const commercialIssues = getLocationCommercialIssues(locationCandidate);
  const priceStats = getLocationPriceValues(fields);
  const gameStats = getLocationGamesStats(games);

  return {
    publicationStatus: getLocationPublicationStatus(locationCandidate),
    subscriptionStatus: getLocationSubscriptionStatus(locationCandidate),
    commerciallyAvailable: isLocationCommerciallyAvailable(locationCandidate),
    checklistCompleted: checklist.filter((item) => item.complete).length,
    checklistTotal: checklist.length,
    pendingCount: pendingItems.length,
    pendingItems,
    commercialIssues,
    activeFieldCount: fields.filter((field) => field.isActive !== false).length,
    averageHourlyPriceCents: priceStats.averageHourlyPriceCents,
    minHourlyPriceCents: priceStats.minHourlyPriceCents,
    upcomingGames: gameStats.upcomingGames,
    gamesLast30Days: gameStats.gamesLast30Days,
  };
};

export const calculateOwnerDashboardStats = (
  locations: OwnerDashboardLocationLike[],
  fieldsByLocation: Record<string, Field[]>,
  games: OwnerDashboardGame[],
): OwnerDashboardStats => {
  const statsByLocation = locations.map((location) =>
    summarizeOwnerLocationStatus(
      location,
      fieldsByLocation[location.id] || [],
      games.filter((game) => game.locationId === location.id),
    ),
  );

  const overallGames = getLocationGamesStats(games);
  const totalReviews = locations.reduce((sum, location) => sum + (location.ratingCount || 0), 0);
  const weightedRating = locations.reduce(
    (sum, location) => sum + ((location.rating || 0) * (location.ratingCount || 0)),
    0,
  );
  const priceValues = Object.values(fieldsByLocation)
    .flatMap((fields) =>
      fields
        .filter((field) => field.isActive !== false)
        .map((field) => field.hourlyPrice)
        .filter((value): value is number => Number.isFinite(value) && value > 0),
    );

  return {
    gamesLast30Days: overallGames.gamesLast30Days,
    gamesThisWeek: overallGames.gamesThisWeek,
    averageRating: totalReviews > 0 ? weightedRating / totalReviews : 0,
    totalReviews,
    upcomingGames: overallGames.upcomingGames,
    averageHourlyPriceCents: priceValues.length > 0
      ? Math.round(priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length)
      : null,
    publishedLocations: statsByLocation.filter((status) => status.commerciallyAvailable).length,
    pendingLocations: statsByLocation.filter((status) => status.pendingCount > 0).length,
    totalPendingItems: statsByLocation.reduce((sum, status) => sum + status.pendingCount, 0),
  };
};
