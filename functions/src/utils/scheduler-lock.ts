import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {randomUUID} from "node:crypto";
import {db} from "../_db";

/**
 * Intervalo padrão entre heartbeats do scheduler lock (legado).
 *
 * Issue #3967: antes o lock gravava heartbeat_at uma única vez na
 * aquisição e nunca mais. Numa morte dura (OOM / wall-clock timeout /
 * kill do Cloud Run gen2) o finally NÃO executa, o doc system_locks
 * ficava congelado em status "running" por todo o TTL e engolia todas
 * as retries do Cloud Scheduler. Heartbeat periódico mantém
 * heartbeat_at fresco durante a execução normal e permite detectar um
 * holder morto assim que o TTL estoura (em vez de esperar o próximo
 * tick agendado).
 *
 * Issue #3974: novos callers devem derivar o intervalo do TTL via
 * schedulerHeartbeatIntervalForTtl() em vez de usar esta constante
 * solta, para que o intervalo acompanhe o TTL (que agora é >= timeout
 * da função).
 */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Margem de segurança aplicada ao timeoutSeconds da função dona do
 * lock para obter o TTL. TTL = timeout × este fator.
 *
 * Issue #3974 Defeito B: o #3967 reduziu o TTL para 45s (= 3 ×
 * HEARTBEAT_INTERVAL_MS de 15s), mas cleanupAllSoftDeleted tem
 * timeoutSeconds:540 — o lock expirava 12× durante uma única execução
 * normal, permitindo takeover prematuro pelas retries do Cloud
 * Scheduler. TTL >= timeout × 2 garante folga contra clock drift entre
 * Firestore e function, e mesmo SEM nenhum heartbeat o lock sobrevive
 * a uma execução inteira.
 */
export const SCHEDULER_LOCK_TTL_SAFETY_FACTOR = 2;

/**
 * Quantos heartbeats cabem dentro de um TTL. Quanto maior, mais falhas
 * isoladas de heartbeat (network blip, throttle transiente) são
 * toleradas antes que outra instância considere o holder morto e tome
 * o lock.
 */
export const HEARTBEATS_PER_TTL = 4;

/**
 * TTL padrão do lock (legado). Mantido >= o maior timeoutSeconds entre
 * os crons (540s do cleanupAllSoftDeleted) × SCHEDULER_LOCK_TTL_SAFETY_FACTOR
 * para que o default nunca seja menor que um timeout — corrige o
 * Defeito B (#3974) onde o #3967 tinha fixado TTL=45s (12× menor que o
 * timeout de 540s). Novos callers devem usar
 * schedulerLockTtlForTimeout(timeoutSeconds) passando o próprio timeout.
 */
export const SCHEDULER_LOCK_TTL_MS =
  540_000 * SCHEDULER_LOCK_TTL_SAFETY_FACTOR;

/**
 * Calcula o TTL recomendado para um lock a partir do timeoutSeconds da
 * função dona do lock.
 *
 * Issue #3974: TTL >= timeout impede que o lock expire durante uma
 * execução normal. O #3967 usava TTL=45s fixo, 12× menor que o timeout
 * de 540s do cleanupAllSoftDeleted — o lock expirava no meio do job e
 * uma retry tomava o lock enquanto o holder original ainda gravava.
 *
 * @param {number} timeoutSeconds - timeoutSeconds declarado pela função.
 * @return {number} TTL em milissegundos (= timeoutSeconds × 1000 ×
 *   SCHEDULER_LOCK_TTL_SAFETY_FACTOR).
 */
export function schedulerLockTtlForTimeout(
  timeoutSeconds: number
): number {
  return timeoutSeconds * 1000 * SCHEDULER_LOCK_TTL_SAFETY_FACTOR;
}

/**
 * Deriva o intervalo de heartbeat a partir do TTL do lock.
 *
 * Issue #3974: o intervalo deve derivar do TTL (TTL / HEARTBEATS_PER_TTL)
 * para que múltiplos heartbeats caibam dentro de um TTL maior — assim
 * falhas isoladas de heartbeat não causam takeover falso, e ao mesmo
 * tempo o TTL (agora >= timeout) impede expiração prematura.
 *
 * @param {number} ttlMs - TTL do lock (ver schedulerLockTtlForTimeout).
 * @return {number} Intervalo entre heartbeats em milissegundos.
 */
export function schedulerHeartbeatIntervalForTtl(
  ttlMs: number
): number {
  return Math.max(1_000, Math.floor(ttlMs / HEARTBEATS_PER_TTL));
}

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
 * Handle retornado por startSchedulerHeartbeat.
 *
 * `stop()` interrompe o intervalo; `isLost()` reporta se um heartbeat
 * foi rejeitado (outro owner tomou o lock). Callers DEVEM checar
 * isLost() em seus loops principais e abortar graciosamente quando
 * true, evitando writes conflitantes com o novo owner (Issue #3974
 * Defeito A: antes o retorno boolean do heartbeat era ignorado e a
 * execução continuava mesmo após perder o lock).
 */
export interface SchedulerHeartbeatHandle {
  /** Interrompe o intervalo de heartbeat. */
  stop: () => void;
  /**
   * True quando um heartbeat retornou false — outro owner tomou o lock
   * (execução overrunning o TTL + retry entrou, ou takeover manual/stale).
   * Uma vez true, permanece true (o lock não volta para este owner).
   */
  isLost: () => boolean;
}

/**
 * Inicia heartbeat periódico para um lock já adquirido.
 *
 * Issue #3967: o heartbeat é a prova de vida que viabiliza takeover
 * rápida quando o holder morre de forma dura (finally não roda). O
 * handle retornado DEVE ter stop() chamado no finally do caller —
 * antes de releaseSchedulerLock — para evitar heartbeats fantasmas.
 *
 * Issue #3974 Defeito A: agora o retorno boolean de heartbeatSchedulerLock
 * é observado. Se um heartbeat for rejeitado (outro owner tomou o lock),
 * isLost() passa a retornar true e o caller DEVE abortar a execução.
 * Antes o boolean era descartado e o holder original continuava
 * gravando depois de perder o lock, competindo com o novo owner.
 *
 * @param {string} lockId - Doc ID em system_locks.
 * @param {string} ownerToken - Token retornado na aquisição.
 * @param {number} intervalMs - Intervalo entre heartbeats (default
 *   HEARTBEAT_INTERVAL_MS; prefira schedulerHeartbeatIntervalForTtl).
 * @return {SchedulerHeartbeatHandle} Handle cujo stop() interrompe o
 *   heartbeat e cujo isLost() reporta perda de ownership.
 */
export function startSchedulerHeartbeat(
  lockId: string,
  ownerToken: string,
  intervalMs: number = HEARTBEAT_INTERVAL_MS
): SchedulerHeartbeatHandle {
  let lost = false;
  const timer = setInterval(() => {
    // Best-effort: uma falha isolada (network/throttle) não derruba o
    // job nem marca como perdido — só um `false` explícito (owner
    // divergente) marca. O pior caso de uma falha isolada é um
    // takeover prematuro, e o fencing por owner_token (em
    // releaseSchedulerLock/heartbeatSchedulerLock) impede que dois
    // holders gravem resultados conflitantes.
    void heartbeatSchedulerLock(lockId, ownerToken)
      .then((ok: boolean) => {
        // Issue #3974 Defeito A: antes este retorno era ignorado.
        if (!ok && !lost) {
          lost = true;
          logger.error(
            `[SCHED_LOCK] Heartbeat rejeitado para ${lockId}: ` +
            "lock foi tomado por outro owner. " +
            "Caller deve abortar a execucao para evitar writes conflitantes."
          );
        }
      })
      .catch((err: unknown) => {
        logger.warn(
          `[SCHED_LOCK] Heartbeat falhou para ${lockId}:`,
          err
        );
      });
  }, intervalMs);
  // unref evita que o timer segure o event loop na desalocação do
  // container; o cast Defensive lida com ambientes de teste/DOM.
  (timer as {unref?: () => void}).unref?.();
  return {
    stop: () => clearInterval(timer),
    isLost: () => lost,
  };
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
