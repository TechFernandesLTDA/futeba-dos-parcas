/**
 * Lista do seletor de quadras (#4370): quais quadras entram, selo
 * "Não verificada" e ordenação (últimas utilizações → ordem alfabética).
 */
import { Location } from '../types/location';
import { filterVenuesByQuery, getVenueSearchFields, tokenizeVenueQuery } from './venueSearch';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export const compareVenueNames = (a: Pick<Location, 'name'>, b: Pick<Location, 'name'>) =>
  collator.compare(a.name ?? '', b.name ?? '');

/**
 * Quadra "Não verificada": importada em rascunho ou ainda sem aprovação do admin.
 * O selo aparece para qualquer quadra sem `isVerified`.
 */
export const isVenueUnverified = (venue: Pick<Location, 'isVerified' | 'publicationStatus'>) =>
  venue.isVerified !== true;

/**
 * Pode ser escolhida ao criar um jogo? Usuário logado vê quadras em rascunho
 * (importadas), mas não as suspensas/rejeitadas, inativas ou sem mensalidade
 * válida.
 */
export function isVenueSelectable(
  venue: Pick<Location, 'isActive' | 'publicationStatus' | 'subscriptionStatus'>,
): boolean {
  if (venue.isActive === false) return false;
  if (venue.publicationStatus === 'SUSPENDED' || venue.publicationStatus === 'REJECTED') return false;
  if (venue.subscriptionStatus && !['TRIAL', 'ACTIVE'].includes(venue.subscriptionStatus)) return false;
  return true;
}

/**
 * Primeiro as quadras das últimas utilizações (da mais recente para a mais
 * antiga, conforme `recentIds`), depois as demais em ordem alfabética pt-BR.
 */
export function orderVenuesForSelector<T extends Pick<Location, 'id' | 'name'>>(
  venues: readonly T[],
  recentIds: readonly string[] = [],
): T[] {
  const rank = new Map<string, number>();
  recentIds.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, index);
  });
  return [...venues].sort((a, b) => {
    const rankA = rank.get(a.id);
    const rankB = rank.get(b.id);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return compareVenueNames(a, b);
  });
}

export interface VenueSelectorResult<T> {
  inCity: T[];
  /** Só preenchido quando há busca e nada bateu na cidade. */
  otherCities: T[];
  /** A busca não achou nada na cidade: o caller deve carregar as outras cidades. */
  needsOtherCities: boolean;
}

/**
 * Monta as seções da lista. Busca vazia = quadras da cidade. Com busca e sem
 * resultado na cidade, procura nas outras ("Resultados em outras cidades").
 */
export function buildVenueSelectorResult<T extends Location>(params: {
  cityVenues: readonly T[];
  otherVenues?: readonly T[];
  query: string;
  recentIds?: readonly string[];
}): VenueSelectorResult<T> {
  const { cityVenues, otherVenues, query, recentIds = [] } = params;
  const hasQuery = tokenizeVenueQuery(query).length > 0;

  const search = (items: readonly T[]) =>
    filterVenuesByQuery(items, query, (item) => getVenueSearchFields(item));

  const inCity = orderVenuesForSelector(search(cityVenues), recentIds);
  if (!hasQuery || inCity.length > 0) {
    return { inCity, otherCities: [], needsOtherCities: false };
  }

  const cityIds = new Set(cityVenues.map((venue) => venue.id));
  const otherCities = orderVenuesForSelector(
    search((otherVenues ?? []).filter((venue) => !cityIds.has(venue.id))),
    recentIds,
  );
  return { inCity, otherCities, needsOtherCities: true };
}
