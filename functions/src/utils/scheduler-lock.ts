import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {randomUUID} from "node:crypto";
import {db} from "../_db";

/**
 * Intervalo entre heartbeats do scheduler lock.
 *
 * Issue #3967: antes o lock gravava heartbeat_at uma única vez na
 * aquisição e nunca mais. Numa morte dura (OOM / wall-clock timeout /
 * kill do Cloud Run gen2) o finally NÃO executa, o doc system_locks
 * ficava congelado em status "running" por todo o TTL e engolia todas
 * as retries do Cloud Scheduler. Heartbeat periódico mantém
 * heartbeat_at fresco durante a execução normal e permite detectar um
 * holder morto assim que o TTL estoura (em vez de esperar o próximo
 * tick agendado).
 */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * TTL do lock para takeover de locks stale.
 *
 * Issue #3967: era uma constante solta por função (25 min para
 * autoCancelLowQuorum = ~12× o timeout efetivo de 120s; 15 min para
 * cleanupAllSoftDeleted vs timeout de 540s), fazendo todas as retries
 * do Scheduler caírem dentro do TTL e serem puladas. Com heartbeat a
 * cada HEARTBEAT_INTERVAL_MS, TTL = 3× o intervalo basta: mantém folga
 * de ~2 heartbeats perdidos antes do takeover (sem falsos positivos
 * durante a execução normal) e detecta morte dura em ~30-45s — dentro
 * da janela de retry do Cloud Scheduler (backoff ~5/15/35s).
 */
export const SCHEDULER_LOCK_TTL_MS = 3 * HEARTBEAT_INTERVAL_MS;

/**
 * Tenta adquirir um lock distribuído para jobs agendados.
 *
 * @param {string} lockId - Doc ID em system_locks.
 * @param {number} ttlMs - TTL do lock para takeover de locks stale.
 * @return {Promise<string | null>} Token proprietário ou null se ocupado.
 */
export async function acquireSchedulerLock(
  lockId: string,
  ttlMs: number = SCHEDULER_LOCK_TTL_MS
): Promise<string | null> {
  const lockRef = db()
    .collection("system_locks")
    .doc(lockId);

  const ownerToken = randomUUID();
  return await db().runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data();
    // Issue #3967: staleness calculada a partir de heartbeat_at (que
    // agora é atualizado periodicamente), com fallback para started_at.
    // Antes o código lia started_at, que congela no instante da
    // aquisição — um holder morto cujo finally não rodou continuava
    // "fresco" para sempre dentro do TTL. Com heartbeat vivo, a idade
    // reflete o último sinal de vida real do holder.
    const holderActiveAtMillis =
      data?.heartbeat_at?.toMillis?.() ??
      data?.started_at?.toMillis?.() ??
      0;
    const isRunning = data?.status === "running";

    if (snap.exists && isRunning) {
      const ageMs = Date.now() - holderActiveAtMillis;
      if (holderActiveAtMillis > 0 && ageMs < ttlMs) {
        return null;
      }

      logger.warn(
        `[SCHED_LOCK] Lock stale detectado para ${lockId} ` +
        `(heartbeat há ${ageMs}ms > TTL ${ttlMs}ms); retomando execucao`
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
 * Atualiza heartbeat_at do lock — prova de vida do holder.
 *
 * Deve ser chamado periodicamente (ver startSchedulerHeartbeat) para
 * que outras instâncias consigam detectar takeover rapidamente quando
 * esta morrer de forma dura (OOM / kill), onde o finally NÃO executa.
 *
 * @param {string} lockId - Doc ID em system_locks.
 * @param {string} ownerToken - Token retornado na aquisição.
 * @return {Promise<boolean>} True somente se este owner ainda detém o lock.
 */
export async function heartbeatSchedulerLock(
  lockId: string,
  ownerToken: string
): Promise<boolean> {
  const lockRef = db()
    .collection("system_locks")
    .doc(lockId);
  return await db().runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    if (!snap.exists || snap.data()?.owner_token !== ownerToken) {
      return false;
    }
    tx.set(
      lockRef,
      {heartbeat_at: FieldValue.serverTimestamp()},
      {merge: true}
    );
    return true;
  });
}

/**
 * Inicia heartbeat periódico para um lock já adquirido.
 *
 * Issue #3967: o heartbeat é a prova de vida que viabiliza takeover
 * rápida quando o holder morre de forma dura (finally não roda). O
 * handle retornado DEVE ter stop() chamado no finally do caller —
 * antes de releaseSchedulerLock — para evitar heartbeats fantasmas.
 *
 * @param {string} lockId - Doc ID em system_locks.
 * @param {string} ownerToken - Token retornado na aquisição.
 * @param {number} intervalMs - Intervalo entre heartbeats.
 * @return {object} Handle cujo stop() interrompe o heartbeat.
 */
export function startSchedulerHeartbeat(
  lockId: string,
  ownerToken: string,
  intervalMs: number = HEARTBEAT_INTERVAL_MS
): {stop: () => void} {
  const timer = setInterval(() => {
    // Best-effort: uma falha de heartbeat isolada não derruba o job —
    // o pior caso é um takeover prematuro, e o fencing por owner_token
    // (em releaseSchedulerLock/heartbeatSchedulerLock) impede que dois
    // holders gravem resultados conflitantes.
    void heartbeatSchedulerLock(lockId, ownerToken).catch((err: unknown) => {
      logger.warn(
        `[SCHED_LOCK] Heartbeat falhou para ${lockId}:`,
        err
      );
    });
  }, intervalMs);
  // unref evita que o timer segure o event loop na desalocação do
  // container; o cast Defensive lida com ambientes de teste/DOM.
  (timer as {unref?: () => void}).unref?.();
  return {stop: () => clearInterval(timer)};
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
