import { useState, useCallback } from 'react';
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

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  const fetchData = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const constraints: QueryConstraint[] = [];

      whereClauses.forEach(([field, op, value]) => {
        constraints.push(where(field, op as WhereFilterOp, value));
      });

      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }

      if (lastDoc && !reset) {
        constraints.push(startAfter(lastDoc));
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

      if (docs.length > 0) {
        setLastDoc(docs[docs.length - 1]);
      }

      const items = docs.map((d) => ({ id: d.id, ...snakeToCamel(d.data()) })) as T[];

      if (reset) {
        setData(items);
      } else {
        setData((prev) => [...prev, ...items]);
      }
    } catch (err) {
      logger.error(`Error fetching ${collectionName}:`, err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [collectionName, pageSize, orderByField, orderDirection, whereClauses, lastDoc, loading]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchData(false);
    }
  }, [hasMore, loading, fetchData]);

  const refresh = useCallback(() => {
    setLastDoc(null);
    setHasMore(true);
    fetchData(true);
  }, [fetchData]);

  const reset = useCallback(() => {
    setData([]);
    setLastDoc(null);
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
