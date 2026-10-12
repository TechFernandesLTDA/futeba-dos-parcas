/**
 * Chips dos filtros ativos do admin de quadras (#4372): cada chip sabe qual
 * pedaço do estado remover ao clicar no "x".
 */
import {
  AMENITY_LABELS,
  FIELD_TYPE_CONFIG,
  LOCATION_PUBLICATION_STATUS_LABELS,
  LOCATION_SUBSCRIPTION_STATUS_LABELS,
  FieldType,
} from '../../types/location';
import { ManageLocationQueryState } from './manageLocationUrlState';

export interface ActiveFilterChip {
  /** Chave estável (React key). */
  key: string;
  label: string;
  /** Alteração do estado que remove este filtro. */
  clear: Partial<ManageLocationQueryState>;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const BOOLEAN_KEYS = { YES: 'yes', NO: 'no' } as const;

export function buildActiveFilterChips(
  state: ManageLocationQueryState,
  t: Translate,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const add = (key: string, label: string, clear: Partial<ManageLocationQueryState>) =>
    chips.push({ key, label, clear });

  if (state.searchQuery.trim()) {
    add('q', t('locations.manageFilters.chip.search', { value: state.searchQuery.trim() }), { searchQuery: '' });
  }
  state.stateFilters.forEach((uf) =>
    add(`uf:${uf}`, uf, { stateFilters: state.stateFilters.filter((item) => item !== uf) }));
  state.cityFilters.forEach((city) =>
    add(`cidade:${city}`, city, { cityFilters: state.cityFilters.filter((item) => item !== city) }));
  state.neighborhoodFilters.forEach((bairro) =>
    add(`bairro:${bairro}`, bairro, {
      neighborhoodFilters: state.neighborhoodFilters.filter((item) => item !== bairro),
    }));
  state.quickFilters.forEach((quick) =>
    add(`rapido:${quick}`, t(`locations.manageFilters.quick.${quick}`), {
      quickFilters: state.quickFilters.filter((item) => item !== quick),
    }));

  if (state.publicationFilter !== 'ALL') {
    add('pub', LOCATION_PUBLICATION_STATUS_LABELS[state.publicationFilter], { publicationFilter: 'ALL' });
  }
  if (state.subscriptionFilter !== 'ALL') {
    add('mens', t('locations.manageFilters.chip.subscription', {
      value: LOCATION_SUBSCRIPTION_STATUS_LABELS[state.subscriptionFilter],
    }), { subscriptionFilter: 'ALL' });
  }
  if (state.typeFilter !== 'ALL') {
    add('tipo', FIELD_TYPE_CONFIG[state.typeFilter as FieldType]?.label ?? state.typeFilter, { typeFilter: 'ALL' });
  }
  if (state.verifiedFilter !== 'ALL') {
    add('ver', t('locations.manageFilters.chip.verified', {
      value: t(`locations.manageFilters.${BOOLEAN_KEYS[state.verifiedFilter]}`),
    }), { verifiedFilter: 'ALL' });
  }
  if (state.activeFilter !== 'ALL') {
    add('ativa', t('locations.manageFilters.chip.active', {
      value: t(`locations.manageFilters.${BOOLEAN_KEYS[state.activeFilter]}`),
    }), { activeFilter: 'ALL' });
  }
  if (state.activeFieldsFilter !== 'ALL') {
    add('campos', t('locations.manageFilters.chip.activeFields', {
      value: t(`locations.manageFilters.${BOOLEAN_KEYS[state.activeFieldsFilter]}`),
    }), { activeFieldsFilter: 'ALL' });
  }
  if (state.dueFilter !== 'ALL') {
    add('venc', t(`locations.manageFilters.due.${state.dueFilter}`), { dueFilter: 'ALL' });
  }
  if (state.monthlyFeeFilter !== 'ALL') {
    add('taxa', t(`locations.manageFilters.fee.${state.monthlyFeeFilter}`), { monthlyFeeFilter: 'ALL' });
  }
  if (state.ownerFilter.trim()) {
    add('dono', t('locations.manageFilters.chip.owner', { value: state.ownerFilter.trim() }), { ownerFilter: '' });
  }
  state.amenityFilters.forEach((amenity) =>
    add(`comod:${amenity}`, AMENITY_LABELS[amenity] || amenity, {
      amenityFilters: state.amenityFilters.filter((item) => item !== amenity),
    }));

  return chips;
}
