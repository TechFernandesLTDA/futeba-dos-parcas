import { useState, useEffect } from 'react';
import { Query, onSnapshot, DocumentData } from 'firebase/firestore';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('useFirestoreQuery');

interface UseFirestoreQueryOptions<T> {
  /** Query do Firestore */
  query: Query<DocumentData> | null;
  /** Transforma o documento raw em tipo T (após snakeToCamel) */
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
          if (transform) {
            return transform(converted, doc.id);
          }
          return { id: doc.id, ...converted } as T;
        });
        setData(results);
        setLoading(false);
      },
      (err) => {
        logger.error('Firestore query error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestoreQuery, enabled, transform]);

  return { data, loading, error };
}
