import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNetworkStatus } from './useNetworkStatus';
import { createLogger } from '../utils/logger';

const logger = createLogger('useOfflineQueue');
const STORAGE_KEY = 'offline_write_queue';

interface QueuedMutation {
  id: string;
  collection: string;
  operation: 'set' | 'update' | 'delete' | 'add';
  data: Record<string, unknown>;
  docId?: string;
  enqueuedAt: number;
}

function loadQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // quota exceeded
  }
}

export function useOfflineQueue() {
  const { isOnline } = useNetworkStatus();
  const [queue, setQueue] = useState<QueuedMutation[]>(loadQueue);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  const enqueue = useCallback((mutation: Omit<QueuedMutation, 'id' | 'enqueuedAt'>) => {
    const entry: QueuedMutation = {
      ...mutation,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      enqueuedAt: Date.now(),
    };
    setQueue(prev => [...prev, entry]);
    return entry.id;
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queue.length === 0) return;
    processingRef.current = true;
    setProcessing(true);

    for (const mutation of queue) {
      try {
        switch (mutation.operation) {
          case 'set':
            await setDoc(doc(db, mutation.collection, mutation.docId!), mutation.data, { merge: true });
            break;
          case 'update':
            await updateDoc(doc(db, mutation.collection, mutation.docId!), mutation.data);
            break;
          case 'delete':
            await deleteDoc(doc(db, mutation.collection, mutation.docId!));
            break;
          case 'add':
            await addDoc(collection(db, mutation.collection), mutation.data);
            break;
        }
      } catch (err) {
        logger.error('Offline mutation failed:', err);
      }
    }

    setQueue([]);
    setProcessing(false);
    processingRef.current = false;
  }, [queue]);

  useEffect(() => {
    if (isOnline && queue.length > 0 && !processingRef.current) {
      processQueue();
    }
  }, [isOnline, queue.length, processQueue]);

  return {
    enqueue,
    queueLength: queue.length,
    processing,
    isOnline,
  };
}
