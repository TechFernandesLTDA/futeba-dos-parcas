/**
 * Filtros e busca do admin de quadras ↔ URL (#4372).
 *
 * O link é compartilhável e o botão "voltar" do navegador restaura o estado.
 * Valores padrão não vão para a URL; valores inválidos são ignorados; listas
 * usam parâmetros repetidos (`?uf=PR&uf=SC&cidade=Curitiba`), então vírgulas
 * em nomes de cidade não quebram nada.
 */
import {
  LocationPublicationStatus,
  LocationSubscriptionStatus,
} from '../../types/location';
import { normalizeUf } from '../../utils/brazilStates';
import {
  LocationBooleanFilter,
  LocationDueFilter,
  LocationMonthlyFeeFilter,
  MANAGE_QUICK_FILTERS,
  ManageLocationFilterState,
  ManageQuickFilter,
} from './manageLocationFilters';
import {
  DEFAULT_MANAGE_LOCATION_SORT,
  MANAGE_LOCATION_SORTS,
  ManageLocationSort,
} from './manageLocationSort';

export type ManageLocationView = 'table' | 'cards';

export interface ManageLocationQueryState extends ManageLocationFilterState {
  sortBy: ManageLocationSort;
  /** undefined = automático (tabela no desktop, cards no mobile). */
  view?: ManageLocationView;
}

export const EMPTY_MANAGE_FILTERS: ManageLocationQueryState = {
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
  sortBy: DEFAULT_MANAGE_LOCATION_SORT,
  view: undefined,
};

const PUBLICATION: LocationPublicationStatus[] = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SUSPENDED', 'REJECTED'];
const SUBSCRIPTION: LocationSubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED', 'CANCELLED'];
const DUE: LocationDueFilter[] = ['NO_DUE', '1_7', '8_14', '15_21', '22_28'];
const FEE: LocationMonthlyFeeFilter[] = ['NO_FEE', 'UP_TO_100', '100_300', '300_PLUS'];
const BOOLEAN: LocationBooleanFilter[] = ['YES', 'NO'];
const FIELD_TYPES = ['SOCIETY', 'FUTSAL', 'CAMPO', 'AREIA', 'OUTROS'];

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

export function parseManageFilters(params: URLSearchParams): ManageLocationQueryState {
  const view = params.get('vista');
  return {
    searchQuery: params.get('q') ?? '',
    ownerFilter: params.get('dono') ?? '',
    publicationFilter: pick<'ALL' | LocationPublicationStatus>(params.get('pub'), PUBLICATION, 'ALL'),
    subscriptionFilter: pick<'ALL' | LocationSubscriptionStatus>(params.get('mens'), SUBSCRIPTION, 'ALL'),
    typeFilter: pick<string>(params.get('tipo'), FIELD_TYPES, 'ALL'),
    stateFilters: unique(params.getAll('uf').map(normalizeUf)),
    cityFilters: unique(params.getAll('cidade')),
    neighborhoodFilters: unique(params.getAll('bairro')),
    quickFilters: unique(params.getAll('rapido'))
      .filter((item): item is ManageQuickFilter => (MANAGE_QUICK_FILTERS as readonly string[]).includes(item)),
    dueFilter: pick<LocationDueFilter>(params.get('venc'), DUE, 'ALL'),
    verifiedFilter: pick<LocationBooleanFilter>(params.get('ver'), BOOLEAN, 'ALL'),
    activeFilter: pick<LocationBooleanFilter>(params.get('ativa'), BOOLEAN, 'ALL'),
    activeFieldsFilter: pick<LocationBooleanFilter>(params.get('campos'), BOOLEAN, 'ALL'),
    monthlyFeeFilter: pick<LocationMonthlyFeeFilter>(params.get('taxa'), FEE, 'ALL'),
    amenityFilters: unique(params.getAll('comod')),
    sortBy: pick<ManageLocationSort>(params.get('ord'), MANAGE_LOCATION_SORTS, DEFAULT_MANAGE_LOCATION_SORT),
    view: view === 'table' || view === 'cards' ? view : undefined,
  };
}

/**
 * Serializa o estado mantendo parâmetros que não são nossos (ex.: `tab`).
 * `base` são os parâmetros atuais da URL.
 */
export function serializeManageFilters(
  state: ManageLocationQueryState,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  const managed = [
    'q', 'dono', 'pub', 'mens', 'tipo', 'uf', 'cidade', 'bairro', 'rapido',
    'venc', 'ver', 'ativa', 'campos', 'taxa', 'comod', 'ord', 'vista',
  ];
  managed.forEach((key) => params.delete(key));

  const setIf = (key: string, value: string, fallback: string) => {
    if (value && value !== fallback) params.set(key, value);
  };
  const appendAll = (key: string, values: readonly string[]) => values.forEach((v) => params.append(key, v));

  setIf('q', state.searchQuery.trim(), '');
  setIf('dono', state.ownerFilter.trim(), '');
  setIf('pub', state.publicationFilter, 'ALL');
  setIf('mens', state.subscriptionFilter, 'ALL');
  setIf('tipo', state.typeFilter, 'ALL');
  appendAll('uf', state.stateFilters);
  appendAll('cidade', state.cityFilters);
  appendAll('bairro', state.neighborhoodFilters);
  appendAll('rapido', state.quickFilters);
  setIf('venc', state.dueFilter, 'ALL');
  setIf('ver', state.verifiedFilter, 'ALL');
  setIf('ativa', state.activeFilter, 'ALL');
  setIf('campos', state.activeFieldsFilter, 'ALL');
  setIf('taxa', state.monthlyFeeFilter, 'ALL');
  appendAll('comod', state.amenityFilters);
  setIf('ord', state.sortBy, DEFAULT_MANAGE_LOCATION_SORT);
  if (state.view) params.set('vista', state.view);
  return params;
}

/** Quantos filtros estão ativos (para o "Filtros (n)" do mobile e o "Limpar tudo"). Ordenação e vista não contam. */
export function countActiveManageFilters(state: ManageLocationQueryState): number {
  return [
    state.searchQuery.trim() !== '',
    state.ownerFilter.trim() !== '',
    state.publicationFilter !== 'ALL',
    state.subscriptionFilter !== 'ALL',
    state.typeFilter !== 'ALL',
    state.stateFilters.length,
    state.cityFilters.length,
    state.neighborhoodFilters.length,
    state.quickFilters.length,
    state.dueFilter !== 'ALL',
    state.verifiedFilter !== 'ALL',
    state.activeFilter !== 'ALL',
    state.activeFieldsFilter !== 'ALL',
    state.monthlyFeeFilter !== 'ALL',
    state.amenityFilters.length,
  ].reduce<number>((total, item) => total + (typeof item === 'number' ? item : item ? 1 : 0), 0);
}

export const clearManageFilters = (state: ManageLocationQueryState): ManageLocationQueryState => ({
  ...EMPTY_MANAGE_FILTERS,
  sortBy: state.sortBy,
  view: state.view,
});
