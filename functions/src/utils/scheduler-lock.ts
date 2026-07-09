import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {randomUUID} from "node:crypto";
import {db} from "../_db";

/**
 * Tenta adquirir um lock distribuído para jobs agendados.
 *
 * @param {string} lockId - Doc ID em system_locks.
 * @param {number} ttlMs - TTL do lock para takeover de locks stale.
 * @return {Promise<string | null>} Token proprietário ou null se ocupado.
 */
export async function acquireSchedulerLock(
  lockId: string,
  ttlMs: number
): Promise<string | null> {
  const lockRef = db()
    .collection("system_locks")
    .doc(lockId);

  const ownerToken = randomUUID();
  return await db().runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data();
    const startedAtMillis =
      data?.started_at?.toMillis?.() ??
      data?.heartbeat_at?.toMillis?.() ??
      0;
    const isRunning = data?.status === "running";

    if (snap.exists && isRunning) {
      const ageMs = Date.now() - startedAtMillis;
      if (startedAtMillis > 0 && ageMs < ttlMs) {
        return null;
      }

      logger.warn(
        `[SCHED_LOCK] Lock stale detectado para ${lockId}; retomando execucao`
      );
    }

    tx.set(
      lockRef,
      {
        status: "running",
        owner_token: ownerToken,
        started_at:
          FieldValue.serverTimestamp(),
        heartbeat_at:
          FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
    return ownerToken;
  });
}

/**
 * Libera/atualiza o lock distribuído do job agendado.
 *
 * @param {string} lockId - Doc ID em system_locks.
 * @param {string} ownerToken - Token retornado na aquisição.
 * @param {"completed" | "failed"} status - Status final.
 * @param {Record<string, unknown>} extraData - Campos extras opcionais.
 * @return {Promise<boolean>} True somente se este owner liberou o lock.
 */
export async function releaseSchedulerLock(
  lockId: string,
  ownerToken: string,
  status: "completed" | "failed",
  extraData: Record<string, unknown> = {}
): Promise<boolean> {
  const lockRef = db()
    .collection("system_locks")
    .doc(lockId);
  return await db().runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    if (!snap.exists || snap.data()?.owner_token !== ownerToken) {
      logger.warn(
        `[SCHED_LOCK] Owner obsoleto tentou liberar ${lockId}; ignorando`
      );
      return false;
    }

    tx.set(
      lockRef,
      {
        status,
        finished_at: FieldValue.serverTimestamp(),
        ...extraData,
      },
      {merge: true}
    );
    return true;
  });
}
