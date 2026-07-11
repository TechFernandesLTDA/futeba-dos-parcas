import {randomUUID} from "crypto";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";

const DEFAULT_LEASE_MS = 10 * 60 * 1000;

type TimestampLike = {
  toMillis?: () => number;
  toDate?: () => Date;
};

export interface OperationLease {
  ref: FirebaseFirestore.DocumentReference;
  ownerId: string;
}

interface AcquireOperationLeaseOptions {
  cooldownMs: number;
  leaseMs?: number;
}

/**
 * Converte Timestamp/Date em epoch millis sem confiar no shape do documento.
 *
 * @param {unknown} value Valor persistido no lock.
 * @return {number|null} Epoch millis ou null.
 */
function timestampToMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (!value || typeof value !== "object") return null;

  const timestamp = value as TimestampLike;
  if (typeof timestamp.toMillis === "function") {
    return timestamp.toMillis();
  }
  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate().getTime();
  }
  return null;
}

/**
 * Adquire lease distribuído e cooldown no mesmo transaction boundary.
 *
 * Locks antigos sem lease_expires_at continuam reconhecidos por
 * last_run_at + leaseMs, permitindo migração segura do schema.
 *
 * @param {FirebaseFirestore.Firestore} database Firestore.
 * @param {string} lockId ID estável do job.
 * @param {string} actorUid UID do administrador.
 * @param {AcquireOperationLeaseOptions} options Cooldown e duração do lease.
 * @return {Promise<OperationLease>} Lease adquirido.
 */
export async function acquireOperationLease(
  database: FirebaseFirestore.Firestore,
  lockId: string,
  actorUid: string,
  options: AcquireOperationLeaseOptions,
): Promise<OperationLease> {
  const ref = database.collection("system_locks").doc(lockId);
  const ownerId = randomUUID();
  const nowMs = Date.now();
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;

  await database.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const lastRunMs = timestampToMillis(data.last_run_at);
    const explicitLeaseMs = timestampToMillis(data.lease_expires_at);
    const leaseExpiresMs = explicitLeaseMs ??
      (data.status === "running" && lastRunMs !== null ?
        lastRunMs + leaseMs :
        null);

    if (data.status === "running" && leaseExpiresMs !== null && leaseExpiresMs > nowMs) {
      throw new HttpsError(
        "resource-exhausted",
        "Esta operação já está em andamento.",
        {retryAfter: Math.ceil((leaseExpiresMs - nowMs) / 1000)},
      );
    }

    if (
      data.status === "completed" &&
      lastRunMs !== null &&
      nowMs - lastRunMs < options.cooldownMs
    ) {
      throw new HttpsError(
        "resource-exhausted",
        "Esta operação foi executada recentemente.",
        {
          retryAfter: Math.ceil(
            (options.cooldownMs - (nowMs - lastRunMs)) / 1000,
          ),
        },
      );
    }

    tx.set(ref, {
      last_run_at: Timestamp.fromMillis(nowMs),
      started_by: actorUid,
      status: "running",
      lease_owner: ownerId,
      lease_expires_at: Timestamp.fromMillis(nowMs + leaseMs),
      completed_at: FieldValue.delete(),
      failed_at: FieldValue.delete(),
      error_code: FieldValue.delete(),
    }, {merge: true});
  });

  return {ref, ownerId};
}

/**
 * Finaliza somente o lease que pertence a esta execução.
 *
 * @param {FirebaseFirestore.Firestore} database Firestore.
 * @param {OperationLease} lease Lease atual.
 * @param {Record<string, unknown>} result Métricas finais.
 */
export async function completeOperationLease(
  database: FirebaseFirestore.Firestore,
  lease: OperationLease,
  result: Record<string, unknown>,
): Promise<void> {
  await database.runTransaction(async (tx) => {
    const snap = await tx.get(lease.ref);
    if (snap.data()?.lease_owner !== lease.ownerId) {
      throw new HttpsError(
        "aborted",
        "A execução perdeu o lease administrativo.",
      );
    }

    tx.set(lease.ref, {
      ...result,
      status: "completed",
      completed_at: FieldValue.serverTimestamp(),
      lease_owner: FieldValue.delete(),
      lease_expires_at: FieldValue.delete(),
    }, {merge: true});
  });
}

/**
 * Marca falha sem permitir que uma chamada não-autorizada ou execução antiga
 * sobrescreva o estado de outro processo.
 *
 * @param {FirebaseFirestore.Firestore} database Firestore.
 * @param {OperationLease} lease Lease atual.
 * @param {unknown} error Erro capturado.
 */
export async function failOperationLease(
  database: FirebaseFirestore.Firestore,
  lease: OperationLease,
  error: unknown,
): Promise<void> {
  await database.runTransaction(async (tx) => {
    const snap = await tx.get(lease.ref);
    if (snap.data()?.lease_owner !== lease.ownerId) return;

    const errorCode = error instanceof HttpsError ? error.code : "internal";
    tx.set(lease.ref, {
      status: "failed",
      failed_at: FieldValue.serverTimestamp(),
      error_code: errorCode,
      lease_owner: FieldValue.delete(),
      lease_expires_at: FieldValue.delete(),
    }, {merge: true});
  });
}
