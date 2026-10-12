/** Ordenação do admin de quadras (#4372): nome, cidade, mais recentes, atualização e status. */
import { Location, LocationPublicationStatus } from '../../types/location';
import {
  getLocationCityName,
  getLocationPublicationStatus,
  getLocationUf,
} from './manageLocationFilters';

export type ManageLocationSort = 'NAME' | 'CITY' | 'NEWEST' | 'UPDATED' | 'STATUS';

export const MANAGE_LOCATION_SORTS: readonly ManageLocationSort[] = [
  'NAME',
  'CITY',
  'NEWEST',
  'UPDATED',
  'STATUS',
];

export const DEFAULT_MANAGE_LOCATION_SORT: ManageLocationSort = 'NAME';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Quem precisa de ação primeiro: pendentes e rascunhos antes das publicadas. */
const STATUS_ORDER: LocationPublicationStatus[] = [
  'PENDING_REVIEW',
  'DRAFT',
  'REJECTED',
  'SUSPENDED',
  'PUBLISHED',
];

const toMillis = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
};

const byName = (a: Location, b: Location) => collator.compare(a.name ?? '', b.name ?? '');

export function sortManageLocations(
  locations: readonly Location[],
  sortBy: ManageLocationSort = DEFAULT_MANAGE_LOCATION_SORT,
): Location[] {
  const list = [...locations];
  switch (sortBy) {
    case 'CITY':
      return list.sort((a, b) =>
        collator.compare(getLocationUf(a), getLocationUf(b)) ||
        collator.compare(getLocationCityName(a), getLocationCityName(b)) ||
        byName(a, b));
    case 'NEWEST':
      return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt) || byName(a, b));
    case 'UPDATED':
      return list.sort((a, b) =>
        toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt) || byName(a, b));
    case 'STATUS':
      return list.sort((a, b) =>
        STATUS_ORDER.indexOf(getLocationPublicationStatus(a)) -
          STATUS_ORDER.indexOf(getLocationPublicationStatus(b)) ||
        byName(a, b));
    case 'NAME':
    default:
      return list.sort(byName);
  }
}
