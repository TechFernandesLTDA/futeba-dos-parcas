/**
 * Consultas de quadras para o seletor de jogos (#4370).
 *
 * Nada aqui varre a coleção `locations` por padrão: a lista padrão é por
 * cidade/UF e a descoberta da cidade usa uma faixa de latitude. Só a busca
 * "em outras cidades" (quando a cidade não tem resultado) lê a coleção, em
 * páginas por cursor.
 *
 * Todas as consultas usam apenas igualdade ou um intervalo num único campo,
 * atendidas pelos índices simples automáticos do Firestore (sem composto).
 */
import {
  DocumentData,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Location } from '../types/location';
import { CityRef, GeoPoint, latitudeBand } from '../utils/venueCity';
import { normalizeUf } from '../utils/brazilStates';
import { isVenueSelectable } from '../utils/venueSelector';

export const VENUE_PAGE_SIZE = 300;
/** Teto de páginas por consulta (300 × 10 = 3.000 quadras) — evita loop infinito. */
export const VENUE_MAX_PAGES = 10;
/** Raios (km) tentados, do mais barato ao mais largo, ao achar a cidade pela posição. */
export const NEAR_RADII_KM = [30, 100, 200] as const;

const toLocation = (doc: QueryDocumentSnapshot<DocumentData>): Location => ({
  ...snakeToCamel<Location>(doc.data()),
  id: doc.id,
});

async function fetchPaged(constraints: QueryConstraint[]): Promise<Location[]> {
  const venues: Location[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  for (let page = 0; page < VENUE_MAX_PAGES; page++) {
    const snapshot: QuerySnapshot<DocumentData> = await getDocs(query(
      collection(db, 'locations'),
      ...constraints,
      ...(cursor ? [startAfter(cursor)] : []),
      limit(VENUE_PAGE_SIZE),
    ));
    venues.push(...snapshot.docs.map(toLocation));
    if (snapshot.docs.length < VENUE_PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
  return venues;
}

const selectable = (venues: Location[]) => venues.filter(isVenueSelectable);

/** Quadras de uma cidade (e UF, quando conhecida). */
export async function fetchCityVenues(ref: CityRef): Promise<Location[]> {
  const constraints: QueryConstraint[] = [where('city', '==', ref.city)];
  if (ref.state) constraints.push(where('state', '==', normalizeUf(ref.state)));
  return selectable(await fetchPaged(constraints));
}

/** Quadras de um estado — alimenta a lista de cidades do "Trocar cidade". */
export async function fetchStateVenues(uf: string): Promise<Location[]> {
  return selectable(await fetchPaged([where('state', '==', normalizeUf(uf))]));
}

/** Busca em outras cidades: leitura paginada de todo o catálogo, só sob demanda. */
export async function fetchAllVenues(): Promise<Location[]> {
  return selectable(await fetchPaged([]));
}

/**
 * Quadras perto de um ponto, sem varrer a coleção: intervalo de latitude
 * (campo único) + filtro de longitude no cliente. Alarga o raio até achar.
 */
export async function fetchVenuesNear(position: GeoPoint): Promise<Location[]> {
  for (const radiusKm of NEAR_RADII_KM) {
    const band = latitudeBand(position.latitude, radiusKm);
    const lngDelta = radiusKm / (111 * Math.max(Math.cos((position.latitude * Math.PI) / 180), 0.2));
    const venues = (await fetchPaged([
      where('latitude', '>=', band.min),
      where('latitude', '<=', band.max),
    ])).filter((venue) =>
      typeof venue.longitude === 'number' &&
      Math.abs(venue.longitude - position.longitude) <= lngDelta);
    if (venues.length > 0) return selectable(venues);
  }
  return [];
}
