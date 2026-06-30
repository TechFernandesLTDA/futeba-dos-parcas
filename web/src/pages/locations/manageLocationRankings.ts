import {
  FieldType,
  Location,
  isLocationCommerciallyAvailable,
} from '../../types/location';

export interface BestRatedLocationRankingItem {
  location: Location;
  rating: number;
  ratingCount: number;
  gamesCount: number;
}

export interface CheapestLocationRankingItem {
  fieldType: FieldType;
  location: Location;
  priceCents: number;
  activeFieldCount: number;
}

const FIELD_TYPE_ORDER: FieldType[] = ['FUTSAL', 'SOCIETY', 'CAMPO', 'AREIA', 'OUTROS'];

const numberOrZero = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const positiveNumberOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

export function getBestRatedLocations(
  locations: Location[],
  limit = 3,
): BestRatedLocationRankingItem[] {
  return locations
    .filter(isLocationCommerciallyAvailable)
    .map((location) => ({
      location,
      rating: numberOrZero(location.averageRating ?? location.rating),
      ratingCount: numberOrZero(location.ratingCount ?? location.reviewCount),
      gamesCount: numberOrZero(location.gamesCount),
    }))
    .filter((item) => item.rating > 0)
    .sort((a, b) =>
      b.rating - a.rating ||
      b.ratingCount - a.ratingCount ||
      b.gamesCount - a.gamesCount ||
      a.location.name.localeCompare(b.location.name, 'pt-BR'),
    )
    .slice(0, limit);
}

export function getCheapestLocationsByType(
  locations: Location[],
): CheapestLocationRankingItem[] {
  const cheapestByType = new Map<FieldType, CheapestLocationRankingItem>();

  locations
    .filter(isLocationCommerciallyAvailable)
    .forEach((location) => {
      FIELD_TYPE_ORDER.forEach((fieldType) => {
        const typePrice = positiveNumberOrNull(
          location.hourlyPriceByType?.[fieldType]?.minHourlyPriceCents,
        );
        const fallbackPrice = location.primaryFieldType === fieldType ?
          positiveNumberOrNull(location.minHourlyPriceCents) :
          null;
        const priceCents = typePrice ?? fallbackPrice;
        if (!priceCents) return;

        const activeFieldCount =
          location.hourlyPriceByType?.[fieldType]?.activeFieldCount ??
          location.activeFieldCount ??
          0;
        const current = cheapestByType.get(fieldType);
        if (
          !current ||
          priceCents < current.priceCents ||
          (priceCents === current.priceCents &&
            location.name.localeCompare(current.location.name, 'pt-BR') < 0)
        ) {
          cheapestByType.set(fieldType, {
            fieldType,
            location,
            priceCents,
            activeFieldCount,
          });
        }
      });
    });

  return FIELD_TYPE_ORDER
    .map((fieldType) => cheapestByType.get(fieldType))
    .filter((item): item is CheapestLocationRankingItem => Boolean(item));
}
