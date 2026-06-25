import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { snakeToCamel } from './firestoreHelpers';
import { createLogger } from './logger';

const logger = createLogger('userBatch');
const FIRESTORE_IN_LIMIT = 10;

export type BatchedUserData = Record<string, unknown> & {
  id: string;
};

export async function getUsersByIds(userIds: string[]): Promise<Map<string, BatchedUserData>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = new Map<string, BatchedUserData>();

  const chunks = Array.from(
    { length: Math.ceil(uniqueIds.length / FIRESTORE_IN_LIMIT) },
    (_, index) => uniqueIds.slice(index * FIRESTORE_IN_LIMIT, (index + 1) * FIRESTORE_IN_LIMIT)
  );

  const results = await Promise.allSettled(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
    )
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn(`Falha ao buscar lote de usuários ${index + 1}`, result.reason);
      return;
    }

    result.value.docs.forEach((docSnap) => {
      users.set(docSnap.id, {
        ...snakeToCamel<Record<string, unknown>>(docSnap.data()),
        id: docSnap.id,
      });
    });
  });

  return users;
}
