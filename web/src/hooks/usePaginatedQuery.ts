import { useState, useCallback, useRef, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';

const logger = createLogger('usePaginatedQuery');

interface UsePaginatedQueryOptions {
  collectionName: string;
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  whereClauses?: [string, string, unknown][];
}

export function usePaginatedQuery<T = Record<string, unknown>>(options: UsePaginatedQueryOptions) {
  const { t } = useTranslation();
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
  const activeRequestCountRef = useRef(0);
  const requestVersionRef = useRef(0);
  const whereClausesKey = JSON.stringify(whereClauses);

  // FIX #1595: useRef para whereClauses evita recriar fetchData quando o caller
  // passa um array inline (nova referência a cada render)
  const whereClausesRef = useRef(whereClauses);
  whereClausesRef.current = whereClauses;

  useEffect(() => {
    // Quando o contexto da lista muda (coleção/filtros/ordem), invalidamos
    // respostas em voo e limpamos o estado para não exibir dados stale da
    // consulta anterior.
    requestVersionRef.current += 1;
    activeRequestCountRef.current = 0;
    loadingRef.current = false;
    lastDocRef.current = null;
    setData([]);
    setHasMore(true);
    setError(null);
    setLoading(false);
  }, [collectionName, pageSize, orderByField, orderDirection, whereClausesKey]);

  const fetchData = useCallback(async (reset = false, options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (loadingRef.current && !force) return;

    const requestVersion = force
      ? requestVersionRef.current + 1
      : requestVersionRef.current;
    if (force) {
      requestVersionRef.current = requestVersion;
    }
    activeRequestCountRef.current += 1;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const constraints: QueryConstraint[] = [];

      whereClausesRef.current.forEach(([field, op, value]) => {
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

      const cursor = reset ? null : lastDocRef.current;
      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      constraints.push(limit(pageSize + 1));

      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);
      if (requestVersion !== requestVersionRef.current) {
        return;
      }
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
      if (requestVersion !== requestVersionRef.current) {
        return;
      }
      logger.error(`Error fetching ${collectionName}:`, err);
      setError(err as Error);
      showError(t('feedback.generic.loadDataError'));
    } finally {
      activeRequestCountRef.current = Math.max(0, activeRequestCountRef.current - 1);
      if (activeRequestCountRef.current === 0) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [collectionName, pageSize, orderByField, orderDirection, showError, t]);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingRef.current) {
      fetchData(false);
    }
  }, [hasMore, fetchData]);

  const refresh = useCallback(() => {
    lastDocRef.current = null;
    setHasMore(true);
    void fetchData(true, { force: true });
  }, [fetchData]);

  const reset = useCallback(() => {
    requestVersionRef.current += 1;
    activeRequestCountRef.current = 0;
    loadingRef.current = false;
    setData([]);
    lastDocRef.current = null;
    setHasMore(true);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    reset,
    fetchData: () => fetchData(true, { force: true }),
  };
}
