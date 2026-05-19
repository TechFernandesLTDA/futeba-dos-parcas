import { useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
  QueryConstraint,
  WhereFilterOp
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('usePaginatedQuery');

interface UsePaginatedQueryOptions {
  collectionName: string;
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  whereClauses?: [string, string, unknown][];
}

export function usePaginatedQuery<T = Record<string, unknown>>(options: UsePaginatedQueryOptions) {
  const {
    collectionName,
    pageSize = 20,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    whereClauses = [],
  } = options;

  const { showError } = useToast();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const loadingRef = useRef(false);

  const fetchData = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const constraints: QueryConstraint[] = [];

      whereClauses.forEach(([field, op, value]) => {
        // #1331: Firestore limita `in`/`not-in`/`array-contains-any` a 10
        // valores. Chunkar aqui (como sugeria a auditoria) é INCOMPATÍVEL
        // com este hook: ele é cursor-paginado (startAfter + limit) — N
        // queries paralelas teriam cursores independentes, quebrando a
        // paginação e a ordenação. Fail-fast com erro claro de dev é o
        // comportamento correto (o caller deve chunkar antes ou usar outro
        // hook); evita o erro críptico do SDK em runtime de produção.
        if (
          (op === 'in' || op === 'not-in' || op === 'array-contains-any') &&
          Array.isArray(value) &&
          value.length > 10
        ) {
          throw new Error(
            `usePaginatedQuery: operador '${op}' em '${field}' excede 10 ` +
              `valores (${value.length}). Este hook é cursor-paginado e não ` +
              `pode chunkar sem quebrar a paginação. Pré-filtre/chunke no ` +
              `caller ou use uma query não-paginada.`
          );
        }
        constraints.push(where(field, op as WhereFilterOp, value));
      });

      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }

      if (lastDocRef.current && !reset) {
        constraints.push(startAfter(lastDocRef.current));
      }

      constraints.push(limit(pageSize + 1));

      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;

      const hasMoreItems = docs.length > pageSize;
      if (hasMoreItems) {
        docs.pop();
      }
      setHasMore(hasMoreItems);

      lastDocRef.current = docs.length > 0 ? docs[docs.length - 1] : null;

      const items = docs.map((d) => ({ id: d.id, ...snakeToCamel(d.data()) })) as T[];

      if (reset) {
        setData(items);
      } else {
        setData((prev) => [...prev, ...items]);
      }
    } catch (err) {
      logger.error(`Error fetching ${collectionName}:`, err);
      setError(err as Error);
      showError('Erro ao carregar dados. Tente novamente.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [collectionName, pageSize, orderByField, orderDirection, whereClauses, showError]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchData(false);
    }
  }, [hasMore, loading, fetchData]);

  const refresh = useCallback(() => {
    lastDocRef.current = null;
    setHasMore(true);
    fetchData(true);
  }, [fetchData]);

  const reset = useCallback(() => {
    setData([]);
    lastDocRef.current = null;
    setHasMore(true);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    reset,
    fetchData: () => fetchData(true),
  };
}
