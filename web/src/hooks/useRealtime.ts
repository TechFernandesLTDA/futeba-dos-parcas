import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('useRealtime');

export function useRealtimeDocument<T = any>(
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

export function useRealtimeCollection<T = any>(
  collectionName: string,
  queryFn?: (ref: any) => any
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    
    const collectionRef = collection(db, collectionName);
    const q = queryFn ? queryFn(collectionRef) : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const items = snapshot.docs.map((d: any) => ({
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
  }, [collectionName, queryFn]);

  return { data, loading, error };
}
