import {
  FieldType,
  Location,
  getLocationAmenitySet,
  isLocationOpenAt,
  locationHasAmenities,
} from '../../types/location';
import { locationMatchesVenueQuery } from '../../utils/venueSearch';

export type PublicLocationSort = 'RELEVANCE' | 'BEST_RATED' | 'CHEAPEST' | 'NEAREST' | 'MOST_USED';

export interface PublicLocationFilterState {
  searchQuery: string;
  typeFilter: 'ALL' | FieldType;
  areaFilter: string;
  maxHourlyPrice: string;
  amenityFilters: string[];
  openNowOnly: boolean;
  sortBy: PublicLocationSort;
}

export interface PublicLocationMetrics {
  minPriceByLocation: Record<string, number>;
  fieldTypesByLocation: Record<string, FieldType[]>;
  userPosition?: { latitude: number; longitude: number } | null;
  now?: Date;
}

export const PUBLIC_LOCATION_SORT_LABELS: Record<PublicLocationSort, string> = {
  RELEVANCE: 'Mais relevantes',
  BEST_RATED: 'Melhor avaliadas',
  CHEAPEST: 'Mais baratas',
  NEAREST: 'Mais próximas',
  MOST_USED: 'Mais usadas',
};

export const formatHourlyPrice = (value?: number | null) => {
  if (!value || value <= 0) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value / 100);
};

export const parseHourlyPriceFilter = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
};

export const getLocationAreaLabel = (location: Location) => {
  const area = location.district || location.neighborhood || location.region;
  if (area && location.city) return `${area}, ${location.city}`;
  return area || location.city || location.state || 'Região não informada';
};

export const getPublicLocationAreaOptions = (locations: Location[]) =>
  Array.from(new Set(locations.map(getLocationAreaLabel)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const getPublicLocationAmenities = (location: Location) =>
  Array.from(getLocationAmenitySet(location));

export const isPublicLocationOpenAt = isLocationOpenAt;

const getLocationFieldTypes = (
  location: Location,
  fieldTypesByLocation: Record<string, FieldType[]>,
) => new Set([
  location.fieldType,
  location.primaryFieldType,
  ...(fieldTypesByLocation[location.id] || []),
].filter(Boolean) as FieldType[]);

const getUsageScore = (location: Location) =>
  location.reviewCount || location.ratingCount || 0;

const getRatingScore = (location: Location) =>
  location.averageRating || location.rating || 0;

const toRadians = (value: number) => (value * Math.PI) / 180;

export const getDistanceKm = (
  location: Location,
  userPosition?: { latitude: number; longitude: number } | null,
) => {
  if (!userPosition || !location.latitude || !location.longitude) return null;

  const earthRadiusKm = 6371;
  const latDistance = toRadians(location.latitude - userPosition.latitude);
  const lonDistance = toRadians(location.longitude - userPosition.longitude);
  const startLat = toRadians(userPosition.latitude);
  const endLat = toRadians(location.latitude);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(startLat) * Math.cos(endLat) *
    Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const compareByName = (a: Location, b: Location) =>
  a.name.localeCompare(b.name, 'pt-BR');

export const publicLocationMatchesFilters = (
  location: Location,
  filters: PublicLocationFilterState,
  metrics: PublicLocationMetrics,
) => {
  const area = getLocationAreaLabel(location);
  const maxPrice = parseHourlyPriceFilter(filters.maxHourlyPrice);
  const locationPrice = metrics.minPriceByLocation[location.id] || null;
  const fieldTypes = getLocationFieldTypes(location, metrics.fieldTypesByLocation);

  // Busca inteligente compartilhada (#4370): sem acento, vários termos, prefixo,
  // tolerância a 1 erro de digitação e abreviações (soc/fut/jd/vl).
  const matchesSearch = locationMatchesVenueQuery(location, filters.searchQuery, [...fieldTypes]);
  const matchesArea = filters.areaFilter === 'ALL' || area === filters.areaFilter;
  const matchesType = filters.typeFilter === 'ALL' || fieldTypes.has(filters.typeFilter);
  const matchesPrice = maxPrice === null || (locationPrice !== null && locationPrice <= maxPrice);
  const matchesOpenNow = !filters.openNowOnly || isPublicLocationOpenAt(location, metrics.now);

  return matchesSearch &&
    matchesArea &&
    matchesType &&
    matchesPrice &&
    matchesOpenNow &&
    locationHasAmenities(location, filters.amenityFilters);
};

export const sortPublicLocations = (
  locations: Location[],
  sortBy: PublicLocationSort,
  metrics: PublicLocationMetrics,
) => [...locations].sort((a, b) => {
  if (sortBy === 'BEST_RATED') {
    return getRatingScore(b) - getRatingScore(a) ||
      getUsageScore(b) - getUsageScore(a) ||
      compareByName(a, b);
  }

  if (sortBy === 'CHEAPEST') {
    const aPrice = metrics.minPriceByLocation[a.id] ?? Number.MAX_SAFE_INTEGER;
    const bPrice = metrics.minPriceByLocation[b.id] ?? Number.MAX_SAFE_INTEGER;
    return aPrice - bPrice || getRatingScore(b) - getRatingScore(a) || compareByName(a, b);
  }

  if (sortBy === 'NEAREST') {
    const aDistance = getDistanceKm(a, metrics.userPosition) ?? Number.MAX_SAFE_INTEGER;
    const bDistance = getDistanceKm(b, metrics.userPosition) ?? Number.MAX_SAFE_INTEGER;
    return aDistance - bDistance || getRatingScore(b) - getRatingScore(a) || compareByName(a, b);
  }

  if (sortBy === 'MOST_USED') {
    return getUsageScore(b) - getUsageScore(a) ||
      getRatingScore(b) - getRatingScore(a) ||
      compareByName(a, b);
  }

  return getRatingScore(b) - getRatingScore(a) ||
    getUsageScore(b) - getUsageScore(a) ||
    compareByName(a, b);
});

export const filterAndSortPublicLocations = (
  locations: Location[],
  filters: PublicLocationFilterState,
  metrics: PublicLocationMetrics,
) => sortPublicLocations(
  locations.filter((location) => publicLocationMatchesFilters(location, filters, metrics)),
  filters.sortBy,
  metrics,
);

export const countActivePublicLocationFilters = (filters: PublicLocationFilterState) =>
  [
    filters.searchQuery.trim(),
    filters.typeFilter !== 'ALL',
    filters.areaFilter !== 'ALL',
    Boolean(parseHourlyPriceFilter(filters.maxHourlyPrice)),
    filters.amenityFilters.length > 0,
    filters.openNowOnly,
    filters.sortBy !== 'RELEVANCE',
  ].filter(Boolean).length;
