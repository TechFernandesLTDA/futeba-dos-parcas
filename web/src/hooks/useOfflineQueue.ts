import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNetworkStatus } from './useNetworkStatus';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useOfflineQueue');
const STORAGE_KEY = 'offline_write_queue';
const KEY_STORAGE_KEY = 'offline_queue_enc_key';

const MAX_RETRIES = 5;

interface QueuedMutation {
  id: string;
  collection: string;
  operation: 'set' | 'update' | 'delete' | 'add';
  data: Record<string, unknown>;
  docId?: string;
  enqueuedAt: number;
  // #2171: contagem de tentativas para re-enfileirar falhas com limite.
  retries?: number;
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
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  // #2171: ref espelha a fila para que processQueue leia sempre o estado atual,
  // evitando closures obsoletas e o race em que enqueue durante o processamento
  // era sobrescrito por setQueue([]).
  const queueRef = useRef<QueuedMutation[]>([]);
  queueRef.current = queue;

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

  const runMutation = useCallback(async (mutation: QueuedMutation) => {
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
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    setProcessing(true);
    setError(null);

    // #2171: snapshot do lote a processar. Mutações enfileiradas durante o
    // processamento NÃO entram neste lote e são preservadas no setQueue final.
    const batch = [...queueRef.current];
    const processedIds = new Set<string>();
    const retried: QueuedMutation[] = [];

    for (const mutation of batch) {
      try {
        await runMutation(mutation);
        processedIds.add(mutation.id);
      } catch (err) {
        logger.error('Offline mutation failed:', err);
        setError(t('feedback.offline.syncError'));
        const retries = (mutation.retries ?? 0) + 1;
        if (retries <= MAX_RETRIES) {
          // Re-enfileira para nova tentativa
          retried.push({ ...mutation, retries });
        } else {
          // Excedeu o limite — descarta e marca como processada para não travar a fila
          logger.error(`Descartando mutação após ${MAX_RETRIES} tentativas:`, mutation.id);
          processedIds.add(mutation.id);
        }
      }
    }

    // #2171: remove apenas as processadas com sucesso (ou descartadas) e mantém
    // tanto as re-enfileiradas quanto as novas mutações chegadas durante o loop.
    setQueue(prev => {
      const remaining = prev.filter(m => !processedIds.has(m.id));
      // Atualiza retries das que falharam mas continuam na fila
      return remaining.map(m => {
        const r = retried.find(x => x.id === m.id);
        return r ? { ...m, retries: r.retries } : m;
      });
    });

    setProcessing(false);
    processingRef.current = false;
  }, [runMutation]);

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
