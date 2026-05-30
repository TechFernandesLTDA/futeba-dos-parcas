import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNetworkStatus } from './useNetworkStatus';
import { createLogger } from '../utils/logger';

const logger = createLogger('useOfflineQueue');
const STORAGE_KEY = 'offline_write_queue';
const KEY_STORAGE_KEY = 'offline_queue_enc_key';

interface QueuedMutation {
  id: string;
  collection: string;
  operation: 'set' | 'update' | 'delete' | 'add';
  data: Record<string, unknown>;
  docId?: string;
  enqueuedAt: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const existingKey = localStorage.getItem(KEY_STORAGE_KEY);
  if (existingKey) {
    const rawKey = Uint8Array.from(atob(existingKey), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(KEY_STORAGE_KEY, btoa(String.fromCharCode(...new Uint8Array(exported))));
  return key;
}

async function encryptQueue(queue: QueuedMutation[]): Promise<string> {
  if (queue.length === 0) return '';
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(queue));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptQueue(encrypted: string): Promise<QueuedMutation[]> {
  if (!encrypted) return [];
  const key = await getOrCreateEncryptionKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(decoder.decode(plaintext));
}

async function loadQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return await decryptQueue(raw);
  } catch {
    logger.warn('Failed to decrypt offline queue, starting fresh');
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    const encrypted = await encryptQueue(queue);
    if (encrypted) {
      localStorage.setItem(STORAGE_KEY, encrypted);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    logger.warn('Failed to save offline queue', error);
  }
}

export function useOfflineQueue() {
  const { isOnline } = useNetworkStatus();
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    loadQueue().then((loaded) => {
      setQueue(loaded);
      setQueueLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (queueLoaded) {
      saveQueue(queue);
    }
  }, [queue, queueLoaded]);

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
    setError(null);

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
        setError('Falha ao sincronizar alterações offline.');
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
    error,
    isOnline,
  };
}
