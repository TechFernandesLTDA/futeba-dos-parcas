/**
 * Facetas em cascata Estado (UF) → Cidade → Bairro do admin de quadras (#4372).
 *
 * Cada nível mostra só as opções que existem dentro da seleção do nível acima e
 * conta as quadras que ainda passam nos DEMAIS filtros (busca, publicação,
 * verificada...). Selecionar uma cidade, por exemplo, não esconde as outras
 * cidades da mesma UF — assim a multi-seleção continua possível.
 */
import { Location } from '../../types/location';
import { getStateName, normalizeUf } from '../../utils/brazilStates';
import {
  ManageLocationFilterState,
  geoKey,
  getLocationCityName,
  getLocationNeighborhood,
  getLocationUf,
  locationMatchesManageFilters,
  matchesGeoFilters,
} from './manageLocationFilters';

export interface FacetOption {
  /** Valor gravado no filtro (UF, nome da cidade ou do bairro). */
  value: string;
  label: string;
  count: number;
}

export interface GeoFacets {
  states: FacetOption[];
  cities: FacetOption[];
  neighborhoods: FacetOption[];
}

type GeoSelection = Pick<ManageLocationFilterState, 'stateFilters' | 'cityFilters' | 'neighborhoodFilters'>;

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

interface Bucket { label: string; count: number; labelCounts: Map<string, number> }

/** Agrupa por chave normalizada e usa como rótulo a grafia mais frequente. */
function tally(values: string[]): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();
  for (const value of values) {
    const key = geoKey(value);
    if (!key) continue;
    const bucket = buckets.get(key) ?? { label: value, count: 0, labelCounts: new Map() };
    bucket.count += 1;
    const seen = (bucket.labelCounts.get(value) ?? 0) + 1;
    bucket.labelCounts.set(value, seen);
    if (seen > (bucket.labelCounts.get(bucket.label) ?? 0)) bucket.label = value;
    buckets.set(key, bucket);
  }
  return buckets;
}

function toOptions(buckets: Map<string, Bucket>, selected: readonly string[]): FacetOption[] {
  const options = new Map<string, FacetOption>();
  for (const [key, bucket] of buckets) {
    options.set(key, { value: bucket.label, label: bucket.label, count: bucket.count });
  }
  // Seleções sem nenhuma quadra continuam visíveis (com 0) para poderem ser removidas.
  for (const value of selected) {
    const key = geoKey(value);
    if (key && !options.has(key)) options.set(key, { value, label: value, count: 0 });
  }
  return [...options.values()].sort((a, b) => collator.compare(a.label, b.label));
}

export function buildGeoFacets(
  locations: readonly Location[],
  filters: ManageLocationFilterState,
): GeoFacets {
  // Quadras que passam em tudo menos na geografia.
  const base = locations.filter((location) =>
    locationMatchesManageFilters(location, filters, ['state', 'city', 'neighborhood']));

  const states = tally(base.map(getLocationUf).filter(Boolean));
  const stateOptions = toOptions(states, filters.stateFilters.map(normalizeUf))
    .map((option) => ({ ...option, value: normalizeUf(option.value), label: `${normalizeUf(option.value)} — ${getStateName(option.value)}` }));

  const inStates = base.filter((location) =>
    matchesGeoFilters(location, { ...filters, cityFilters: [], neighborhoodFilters: [] }));
  const cityOptions = toOptions(tally(inStates.map(getLocationCityName)), filters.cityFilters);

  const inCities = inStates.filter((location) =>
    matchesGeoFilters(location, { ...filters, neighborhoodFilters: [] }));
  const neighborhoodOptions = toOptions(tally(inCities.map(getLocationNeighborhood)), filters.neighborhoodFilters);

  return { states: stateOptions, cities: cityOptions, neighborhoods: neighborhoodOptions };
}

/**
 * Remove seleções de cidade/bairro que deixaram de existir depois de mudar o
 * nível de cima (ex.: tirar "PR" derruba "Curitiba").
 */
export function pruneGeoSelection<T extends GeoSelection>(
  locations: readonly Location[],
  selection: T,
): T {
  const inStates = locations.filter((location) =>
    matchesGeoFilters(location, { ...selection, cityFilters: [], neighborhoodFilters: [] }));
  const cityKeys = new Set(inStates.map((location) => geoKey(getLocationCityName(location))));
  const cityFilters = selection.cityFilters.filter((city) => cityKeys.has(geoKey(city)));

  const inCities = inStates.filter((location) =>
    matchesGeoFilters(location, { ...selection, cityFilters, neighborhoodFilters: [] }));
  const neighborhoodKeys = new Set(inCities.map((location) => geoKey(getLocationNeighborhood(location))));
  const neighborhoodFilters = selection.neighborhoodFilters.filter((item) => neighborhoodKeys.has(geoKey(item)));

  if (
    cityFilters.length === selection.cityFilters.length &&
    neighborhoodFilters.length === selection.neighborhoodFilters.length
  ) {
    return selection;
  }
  return { ...selection, cityFilters, neighborhoodFilters };
}
