import { useEffect, useState } from 'react';
import {
  DocumentData,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { Location } from '../types/location';
import { createLogger } from '../utils/logger';

const logger = createLogger('useManageLocations');

/** Tamanho de cada página (cursor). */
export const MANAGE_LOCATIONS_PAGE_SIZE = 250;
/** Teto de segurança: 40 × 250 = 10.000 quadras. Ao atingir, `truncated` avisa na tela. */
export const MANAGE_LOCATIONS_MAX_PAGES = 40;

const toLocation = (doc: QueryDocumentSnapshot<DocumentData>): Location => ({
  ...snakeToCamel<Location>(doc.data()),
  id: doc.id,
});

export interface UseManageLocationsParams {
  isAdmin: boolean;
  userId?: string;
  /** Mude para recarregar do zero (botão "tentar novamente"). */
  reloadKey?: number;
}

/**
 * Quadras do gerenciador (#4372). Sem teto silencioso de 200: lê páginas por
 * cursor (`orderBy('name')` + `startAfter`), cada página com seu `onSnapshot`,
 * então as ações do admin (publicar, excluir...) continuam refletindo em tempo
 * real. A primeira página aparece rápido e as demais chegam em sequência.
 */
export function useManageLocations({ isAdmin, userId, reloadKey = 0 }: UseManageLocationsParams) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadingMore(false);
    setTruncated(false);
    setError(null);
    setLocations([]);

    let cancelled = false;
    const pages: Location[][] = [];
    const unsubscribers: Array<() => void> = [];
    let pendingPages = 0;

    const base: QueryConstraint[] = isAdmin ? [] : [where('owner_id', '==', userId ?? '')];
    const locRef = collection(db, 'locations');

    const subscribePage = (index: number, cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      pendingPages += 1;
      let firstSnapshot = true;
      let nextStarted = false;

      const unsubscribe = onSnapshot(
        query(
          locRef,
          ...base,
          orderBy('name', 'asc'),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(MANAGE_LOCATIONS_PAGE_SIZE),
        ),
        (snapshot) => {
          if (cancelled) return;
          pages[index] = snapshot.docs.map(toLocation);
          setLocations(pages.flat());

          if (firstSnapshot) {
            firstSnapshot = false;
            pendingPages -= 1;
            if (index === 0) setLoading(false);
          }
          const isFull = snapshot.docs.length === MANAGE_LOCATIONS_PAGE_SIZE;
          if (isFull && !nextStarted) {
            if (index + 1 < MANAGE_LOCATIONS_MAX_PAGES) {
              nextStarted = true;
              subscribePage(index + 1, snapshot.docs[snapshot.docs.length - 1]);
            } else {
              setTruncated(true);
            }
          }
          setLoadingMore(pendingPages > 0);
        },
        (err) => {
          if (cancelled) return;
          logger.error('Erro ao carregar locais:', err);
          setError(err);
          setLoading(false);
          setLoadingMore(false);
        },
      );
      unsubscribers.push(unsubscribe);
    };

    subscribePage(0, null);

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isAdmin, userId, reloadKey]);

  return { locations, loading, loadingMore, truncated, error };
}
