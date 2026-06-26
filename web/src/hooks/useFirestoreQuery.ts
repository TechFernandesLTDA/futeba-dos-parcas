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
  // #2276: Record<string, unknown> em vez de any — força casts explícitos no transform.
  transform?: (data: Record<string, unknown>, id: string) => T;
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
 *
 * ATENÇÃO: `query` deve ser memoizado pelo caller com `useMemo`.
 * Passar uma query inline (ex: `query(collection(...), ...)` diretamente)
 * cria uma nova referência a cada render, causando re-subscribe e memory leak.
 *
 * @example
 * // CORRETO — query memoizada
 * const q = useMemo(() => query(collection(db, 'games'), where('status', '==', 'LIVE')), []);
 * const { data } = useFirestoreQuery({ query: q });
 *
 * // ERRADO — nova ref a cada render = listener duplicado
 * const { data } = useFirestoreQuery({ query: query(collection(db, 'games'), ...) });
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
      // Evita exibir resultados de uma query antiga quando o caller desabilita
      // o hook ou remove a query atual (troca de rota, logout, dependências).
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    // Quando a referência da query muda, começamos um novo ciclo de loading sem
    // manter dados potencialmente pertencentes ao contexto anterior.
    setData([]);
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
