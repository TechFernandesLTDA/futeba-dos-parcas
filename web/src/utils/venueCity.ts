/**
 * Resolução da "cidade atual" do seletor de quadras (#4370). Tudo puro.
 *
 * Ordem de decisão (sem API paga e sem geocodificação reversa externa):
 *   1. geolocalização do aparelho → cidade/UF da quadra mais próxima;
 *   2. cidade do perfil do usuário;
 *   3. última cidade escolhida (salva localmente).
 * Uma escolha manual ("Trocar cidade") sempre vale mais que as três.
 */
import { Location } from '../types/location';
import { normalizeUf } from './brazilStates';
import { normalizeVenueText } from './venueSearch';

export interface CityRef {
  city: string;
  state: string;
}

export type CitySource = 'manual' | 'geolocation' | 'profile' | 'saved';

export interface ResolvedCity {
  ref: CityRef;
  source: CitySource;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Acima disso a "quadra mais próxima" não diz nada sobre a cidade da pessoa. */
export const MAX_NEAREST_VENUE_KM = 200;

export const SAVED_CITY_STORAGE_KEY = 'venue_selector_city';

export function toCityRef(city?: string | null, state?: string | null): CityRef | null {
  const trimmedCity = (city ?? '').trim();
  if (!trimmedCity) return null;
  return { city: trimmedCity, state: normalizeUf(state) };
}

export const cityKey = (ref: CityRef) =>
  `${normalizeUf(ref.state)}|${normalizeVenueText(ref.city)}`;

export const isSameCity = (a?: CityRef | null, b?: CityRef | null) =>
  Boolean(a && b && cityKey(a) === cityKey(b));

export const formatCityLabel = (ref: CityRef) =>
  ref.state ? `${ref.city} - ${ref.state}` : ref.city;

const toRadians = (value: number) => (value * Math.PI) / 180;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const hasCoordinates = (venue: Pick<Location, 'latitude' | 'longitude'>) =>
  typeof venue.latitude === 'number' && Number.isFinite(venue.latitude) &&
  typeof venue.longitude === 'number' && Number.isFinite(venue.longitude) &&
  !(venue.latitude === 0 && venue.longitude === 0);

export interface NearestVenueCity extends CityRef {
  venueId: string;
  distanceKm: number;
}

/** Cidade/UF da quadra mais próxima, usando apenas as coordenadas das quadras. */
export function findNearestVenueCity(
  position: GeoPoint,
  venues: readonly Pick<Location, 'id' | 'city' | 'state' | 'latitude' | 'longitude'>[],
  maxKm: number = MAX_NEAREST_VENUE_KM,
): NearestVenueCity | null {
  let best: NearestVenueCity | null = null;
  for (const venue of venues) {
    if (!hasCoordinates(venue) || !venue.city?.trim()) continue;
    const km = distanceKm(position, { latitude: venue.latitude!, longitude: venue.longitude! });
    if (km > maxKm) continue;
    if (!best || km < best.distanceKm) {
      best = {
        city: venue.city.trim(),
        state: normalizeUf(venue.state),
        venueId: venue.id,
        distanceKm: km,
      };
    }
  }
  return best;
}

/** Faixa de latitude para a consulta por intervalo (1° ≈ 111 km). */
export function latitudeBand(latitude: number, radiusKm: number) {
  const delta = radiusKm / 111;
  return { min: latitude - delta, max: latitude + delta };
}

export interface ResolveCityInput {
  manual?: CityRef | null;
  geolocation?: CityRef | null;
  profile?: CityRef | null;
  saved?: CityRef | null;
}

export function resolveVenueCity(input: ResolveCityInput): ResolvedCity | null {
  const ordered: Array<[CitySource, CityRef | null | undefined]> = [
    ['manual', input.manual],
    ['geolocation', input.geolocation],
    ['profile', input.profile],
    ['saved', input.saved],
  ];
  for (const [source, ref] of ordered) {
    if (ref && ref.city.trim()) return { ref, source };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Diretório UF → cidades (seletor "Trocar cidade")
// ---------------------------------------------------------------------------

export interface CityOption extends CityRef {
  count: number;
}

/** Cidades de uma lista de quadras, agrupadas sem acento/caixa e ordenadas pt-BR. */
export function buildCityOptions(
  venues: readonly Pick<Location, 'city' | 'state'>[],
  uf?: string,
): CityOption[] {
  const wanted = uf ? normalizeUf(uf) : '';
  const byKey = new Map<string, CityOption>();
  for (const venue of venues) {
    const ref = toCityRef(venue.city, venue.state);
    if (!ref) continue;
    if (wanted && ref.state !== wanted) continue;
    const key = cityKey(ref);
    const current = byKey.get(key);
    if (current) current.count += 1;
    else byKey.set(key, { ...ref, count: 1 });
  }
  return [...byKey.values()].sort((a, b) =>
    a.city.localeCompare(b.city, 'pt-BR', { sensitivity: 'base' }));
}

// ---------------------------------------------------------------------------
// Última cidade escolhida
// ---------------------------------------------------------------------------

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function readSavedCity(storage?: StorageLike | null): CityRef | null {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(SAVED_CITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { city?: unknown; state?: unknown };
    return toCityRef(
      typeof parsed.city === 'string' ? parsed.city : '',
      typeof parsed.state === 'string' ? parsed.state : '',
    );
  } catch {
    return null;
  }
}

export function saveCity(ref: CityRef, storage?: StorageLike | null): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(SAVED_CITY_STORAGE_KEY, JSON.stringify(ref));
  } catch {
    // armazenamento indisponível (modo privado): a escolha só vale na sessão
  }
}
