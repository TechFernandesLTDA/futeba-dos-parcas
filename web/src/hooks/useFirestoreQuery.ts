import { useState, useEffect, useRef } from 'react';
import { Query, onSnapshot, DocumentData } from 'firebase/firestore';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { getFirestoreErrorMessage } from '../utils/firebaseErrors';

const logger = createLogger('useFirestoreQuery');

interface UseFirestoreQueryOptions<T> {
  /** Query do Firestore */
  query: Query<DocumentData> | null;
  /** Transforma o documento raw em tipo T (após snakeToCamel) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform?: (data: Record<string, any>, id: string) => T;
  /** Ativa/desativa a query */
  enabled?: boolean;
}

interface UseFirestoreQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook genérico para queries Firestore com listener em tempo real.
 * Converte automaticamente snake_case → camelCase e gerencia lifecycle.
 */
export function useFirestoreQuery<T>({
  query: firestoreQuery,
  transform,
  enabled = true,
}: UseFirestoreQueryOptions<T>): UseFirestoreQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const transformRef = useRef(transform);
  transformRef.current = transform;

  useEffect(() => {
    if (!firestoreQuery || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      firestoreQuery,
      (snapshot) => {
        const results = snapshot.docs.map((doc) => {
          const raw = doc.data();
          const converted = snakeToCamel(raw);
          if (transformRef.current) {
            return transformRef.current(converted, doc.id);
          }
          return { id: doc.id, ...converted } as T;
        });
        setData(results);
        setLoading(false);
      },
      (err) => {
        logger.error('Firestore query error:', err);
        setError(getFirestoreErrorMessage(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestoreQuery, enabled]);

  return { data, loading, error };
}
