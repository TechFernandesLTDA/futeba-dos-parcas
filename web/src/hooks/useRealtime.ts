import { useState, useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, CollectionReference, Query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('useRealtime');

export function useRealtimeDocument<T = unknown>(
  collectionName: string,
  documentId: string | undefined
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!documentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snakeToCamel(snapshot.data()) } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        logger.error(`Error listening to ${collectionName}/${documentId}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId]);

  return { data, loading, error };
}

export function useRealtimeCollection<T = unknown>(
  collectionName: string,
  queryFn?: (ref: CollectionReference) => Query,
  // FIX #584/H3: era effect deps `[collectionName]` apenas — ignorava
  // mudanças no queryFn (queryFnRef pegava nova ref a cada render mas
  // listener não re-subscrevia). Callers com filtros novos recebiam
  // stale data do primeiro render.
  // Agora: caller passa `deps` (valores que afetam o queryFn) e
  // listener re-subscreve quando deps mudam.
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  useEffect(() => {
    setLoading(true);

    const collectionRef = collection(db, collectionName);
    const q = queryFnRef.current ? queryFnRef.current(collectionRef) : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...snakeToCamel(d.data()),
        })) as T[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        logger.error(`Error listening to ${collectionName}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, ...deps]);

  return { data, loading, error };
}
