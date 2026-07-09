import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {db} from "../_db";

/**
 * Reivindica um evento de notificação uma única vez.
 *
 * A claim fica pendente por um período curto. Assim, uma execução que
 * falha antes de concluir não bloqueia permanentemente o retry.
 *
 * @param {string} claimId - ID determinístico do evento.
 * @return {Promise<boolean>} true na primeira execução, false em duplicatas.
 */
export async function claimNotificationEventOnce(
  claimId: string
): Promise<boolean> {
  const ref = db().collection("notif_dedup").doc(claimId);
  try {
    await ref.create({
      status: "pending",
      claimed_at: FieldValue.serverTimestamp(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    });
    return true;
  } catch (error: unknown) {
    const code = (error as {code?: number | string} | null)?.code;
    if (code === 6 || code === "already-exists") {
      const snapshot = await ref.get();
      const data = snapshot?.data?.() as {
        status?: string;
        expires_at?: {toDate?: () => Date} | Date;
      } | undefined;
      const expiresAt = data?.expires_at instanceof Date ?
        data.expires_at :
        data?.expires_at?.toDate?.();

      if (
        data?.status === "pending" &&
        expiresAt &&
        expiresAt.getTime() <= Date.now()
      ) {
        return db().runTransaction(async (transaction) => {
          const fresh = await transaction.get(ref);
          const freshData = fresh.data() as typeof data;
          const freshExpiresAt = freshData?.expires_at instanceof Date ?
            freshData.expires_at :
            freshData?.expires_at?.toDate?.();
          if (
            freshData?.status !== "pending" ||
            !freshExpiresAt ||
            freshExpiresAt.getTime() > Date.now()
          ) {
            return false;
          }
          transaction.update(ref, {
            claimed_at: FieldValue.serverTimestamp(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          });
          return true;
        });
      }

      logger.info(
        "[NOTIF_DEDUP] Evento ja processado ou em andamento:",
        claimId
      );
      return false;
    }
    throw error;
  }
}

/**
 * Marca a entrega como concluída, bloqueando reentregas.
 * @param {string} claimId - ID determinístico do evento.
 */
export async function completeNotificationEvent(
  claimId: string
): Promise<void> {
  await db().collection("notif_dedup").doc(claimId).update({
    status: "completed",
    completed_at: FieldValue.serverTimestamp(),
  });
}

/**
 * Libera uma claim pendente para que o trigger possa ser reexecutado.
 * @param {string} claimId - ID determinístico do evento.
 */
export async function releaseNotificationEvent(
  claimId: string
): Promise<void> {
  try {
    await db().collection("notif_dedup").doc(claimId).delete();
  } catch (error) {
    logger.error("[NOTIF_DEDUP] Falha ao liberar claim:", claimId, error);
  }
}
