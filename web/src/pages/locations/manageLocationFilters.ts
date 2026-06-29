import {
  Location,
  LocationPublicationStatus,
  LocationSubscriptionStatus,
  locationHasAmenities,
} from '../../types/location';

export type LocationDueFilter = 'ALL' | 'NO_DUE' | '1_7' | '8_14' | '15_21' | '22_28';
export type LocationBooleanFilter = 'ALL' | 'YES' | 'NO';
export type LocationMonthlyFeeFilter = 'ALL' | 'NO_FEE' | 'UP_TO_100' | '100_300' | '300_PLUS';

export interface ManageLocationFilterState {
  searchQuery: string;
  ownerFilter: string;
  publicationFilter: 'ALL' | LocationPublicationStatus;
  subscriptionFilter: 'ALL' | LocationSubscriptionStatus;
  typeFilter: 'ALL' | string;
  cityFilter: string;
  dueFilter: LocationDueFilter;
  verifiedFilter: LocationBooleanFilter;
  activeFilter: LocationBooleanFilter;
  activeFieldsFilter: LocationBooleanFilter;
  monthlyFeeFilter: LocationMonthlyFeeFilter;
  amenityFilters: string[];
}

export const getLocationPublicationStatus = (location: Location): LocationPublicationStatus =>
  location.publicationStatus || (location.isVerified ? 'PUBLISHED' : 'PENDING_REVIEW');

export const getLocationSubscriptionStatus = (location: Location): LocationSubscriptionStatus =>
  location.subscriptionStatus || 'ACTIVE';

const matchesBooleanFilter = (value: boolean | undefined, filter: LocationBooleanFilter) => {
  if (filter === 'ALL') return true;
  return filter === 'YES' ? value === true : value !== true;
};

const matchesDueFilter = (dueDay: number | null, filter: LocationDueFilter) =>
  filter === 'ALL' ||
  (filter === 'NO_DUE' && dueDay === null) ||
  (filter === '1_7' && dueDay !== null && dueDay >= 1 && dueDay <= 7) ||
  (filter === '8_14' && dueDay !== null && dueDay >= 8 && dueDay <= 14) ||
  (filter === '15_21' && dueDay !== null && dueDay >= 15 && dueDay <= 21) ||
  (filter === '22_28' && dueDay !== null && dueDay >= 22 && dueDay <= 28);

const matchesMonthlyFeeFilter = (monthlyFeeCents: number | undefined, filter: LocationMonthlyFeeFilter) => {
  const fee = monthlyFeeCents || 0;
  if (filter === 'ALL') return true;
  if (filter === 'NO_FEE') return fee <= 0;
  if (filter === 'UP_TO_100') return fee > 0 && fee <= 10000;
  if (filter === '100_300') return fee > 10000 && fee <= 30000;
  return fee > 30000;
};

export const getLocationCommercialIssues = (location: Location): string[] => {
  const issues: string[] = [];
  const publicationStatus = getLocationPublicationStatus(location);
  const subscriptionStatus = getLocationSubscriptionStatus(location);

  if (location.isActive !== true) issues.push('inativa');
  if (location.isVerified !== true) issues.push('não verificada');
  if (publicationStatus !== 'PUBLISHED') issues.push('não publicada');
  if (!['TRIAL', 'ACTIVE'].includes(subscriptionStatus)) issues.push('mensalidade irregular');
  if ((location.fieldCount || 0) <= 0) issues.push('sem quadras cadastradas');
  if (location.hasActiveFields === false) issues.push('sem quadras ativas');
  if (!location.monthlyFeeCents || location.monthlyFeeCents <= 0) issues.push('sem mensalidade');
  if (!location.billingDueDay) issues.push('sem vencimento');
  if (!location.city || !location.state) issues.push('endereço incompleto');

  return issues;
};

export const locationMatchesManageFilters = (
  location: Location,
  filters: ManageLocationFilterState,
) => {
  const q = filters.searchQuery.trim().toLowerCase();
  const ownerQuery = filters.ownerFilter.trim().toLowerCase();
  const dueDay = location.billingDueDay ?? null;

  const matchesSearch = !q ||
    location.name?.toLowerCase().includes(q) ||
    location.address?.toLowerCase().includes(q) ||
    location.city?.toLowerCase().includes(q) ||
    location.district?.toLowerCase().includes(q) ||
    location.ownerId?.toLowerCase().includes(q);

  return matchesSearch &&
    (filters.publicationFilter === 'ALL' || getLocationPublicationStatus(location) === filters.publicationFilter) &&
    (filters.subscriptionFilter === 'ALL' || getLocationSubscriptionStatus(location) === filters.subscriptionFilter) &&
    (filters.typeFilter === 'ALL' || location.fieldType === filters.typeFilter || location.primaryFieldType === filters.typeFilter) &&
    (filters.cityFilter === 'ALL' || location.city === filters.cityFilter) &&
    (!ownerQuery || location.ownerId?.toLowerCase().includes(ownerQuery)) &&
    matchesDueFilter(dueDay, filters.dueFilter) &&
    matchesBooleanFilter(location.isVerified, filters.verifiedFilter) &&
    matchesBooleanFilter(location.isActive, filters.activeFilter) &&
    matchesBooleanFilter(location.hasActiveFields, filters.activeFieldsFilter) &&
    matchesMonthlyFeeFilter(location.monthlyFeeCents, filters.monthlyFeeFilter) &&
    locationHasAmenities(location, filters.amenityFilters);
};
