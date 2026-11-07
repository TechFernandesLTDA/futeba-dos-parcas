import {logger} from "firebase-functions/v2";
import {db} from "../_db";
import type {Game} from "../models";
import {
  NotificationType,
  sendAndSaveNotification,
} from "../notifications/helpers";
import type {PlayerXpTransactionResult} from "./player-xp-transaction";

interface NotificationModule {
  sendStreakNotificationIfMilestone: (
    userId: string,
    currentStreak: number,
    previousStreak?: number
  ) => Promise<boolean>;
}

let notificationImported = false;
let notificationModule: NotificationModule | null = null;

/**
 * Lazy load do módulo de notificações.
 * @return {Promise<NotificationModule>} Módulo de notificações.
 */
async function getNotifications(): Promise<NotificationModule> {
  if (!notificationImported) {
    notificationModule = await import("../notifications.js");
    notificationImported = true;
  }
  return notificationModule!;
}

/**
 * Cria a promise de notificação de comeback e streak para um jogador
 * cujo XP foi processado na transação.
 *
 * @param {string} gameId ID do jogo.
 * @param {string} uid ID do jogador.
 * @param {PlayerXpTransactionResult} transactionResult Resultado da transação.
 * @return {Promise<void>} Promise de envio tratada sem propagar erro.
 */
export function buildPlayerPostGameNotificationTask(
  gameId: string,
  uid: string,
  transactionResult: PlayerXpTransactionResult
): Promise<void> {
  return (async () => {
    try {
      if (transactionResult.comebackXp > 0) {
        await sendAndSaveNotification(uid, {
          userId: uid,
          title: "Tá de volta! 🔙",
          body:
            `Você voltou pra pelada e ganhou +${transactionResult.comebackXp} XP.`,
          type: NotificationType.ACHIEVEMENT,
          action: "achievements",
        }, `xp_comeback_${gameId}_${uid}`);
      }
      const notifModule = await getNotifications();
      await notifModule.sendStreakNotificationIfMilestone(
        uid,
        transactionResult.streak,
        transactionResult.previousStreak
      );
    } catch (err) {
      logger.error(
        "[STREAK] Error sending " +
        "notification for " +
        `user ${uid}:`,
        err
      );
    }
  })();
}

/**
 * Marca o jogo como processado, aguarda notificações de streak e gera
 * a atividade consolidada de jogo finalizado.
 *
 * @param {object} params Parâmetros de finalização pós-jogo.
 * @return {Promise<void>} Conclusão dos efeitos pós-jogo.
 */
export async function finalizeGameXpAndSideEffects(params: {
  gameId: string;
  after: Game;
  afterRef: FirebaseFirestore.DocumentReference;
  activeSeason: string | null;
  now: FirebaseFirestore.FieldValue;
  streakNotificationPromises: Promise<void>[];
}): Promise<void> {
  const {
    gameId,
    after,
    afterRef,
    activeSeason,
    now,
    streakNotificationPromises,
  } = params;

  await afterRef.update({
    xp_processed: true,
    xp_processing: false,
    xp_processed_at: now,
    xp_reward_status: "PROCESSED",
    voting_xp_pending: false,
    ...(activeSeason ? {season_id: activeSeason} : {}),
  });

  logger.info(
    `Game ${gameId} processing ` +
    "complete " +
    "(player transactions committed)."
  );

  if (streakNotificationPromises.length > 0) {
    await Promise.all(streakNotificationPromises);
    logger.info(
      "[STREAK] " +
      `${streakNotificationPromises.length} ` +
      "streak notification(s) processed"
    );
  }

  try {
    const {
      generateGameFinishedActivityDirect,
    } = await import("../activities.js");
    await generateGameFinishedActivityDirect(
      gameId, after, db()
    );
  } catch (e) {
    logger.error(
      "[CONSOLIDATED] Erro ao gerar " +
      `atividade para game ${gameId}:`,
      e
    );
  }
}
