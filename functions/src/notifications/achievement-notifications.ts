/**
 * NOTIFICAÇÕES DE CONQUISTAS
 * Triggers para level up, badges, MVP, divisões
 * e streaks.
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {
  FUNCTION_REGION,
} from "../constants";
import {
  NotificationType,
  sendNotificationToUser,
  saveNotificationToFirestore,
  sendAndSaveNotification,
} from "./helpers";
import {ACHIEVEMENT_NOTIFICATIONS} from "./notification-messages";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();

// ==========================================
// LEVEL UP
// ==========================================

/**
 * Trigger: Quando o nível de um usuário muda.
 * Envia notificação de level up.
 */
export const onLevelUp = onDocumentUpdated(
  {document: "users/{userId}", region: FUNCTION_REGION},
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const userId = event.params.userId;

    const beforeLevel = before.level || 0;
    const afterLevel = after.level || 0;

    if (afterLevel > beforeLevel) {
      const levelNames = [
        "Novato", "Iniciante", "Amador",
        "Regular", "Experiente", "Habilidoso",
        "Profissional", "Expert", "Mestre",
        "Lenda", "Imortal",
      ];
      const levelName =
        levelNames[afterLevel] ||
        "Nivel " + afterLevel;

      const imgBase =
        "https://firebasestorage.googleapis.com";
      const imgPath =
        "/v0/b/futeba-dos-parcas.appspot.com" +
        "/o/badges%2Flevel_up.png?alt=media";

      await sendNotificationToUser(userId, {
        title: ACHIEVEMENT_NOTIFICATIONS.LEVEL_UP.title["pt-BR"](),
        body: ACHIEVEMENT_NOTIFICATIONS.LEVEL_UP.body["pt-BR"]({
          levelName,
        }),
        type: NotificationType.LEVEL_UP,
        imageUrl: imgBase + imgPath,
      });
    }
  }
);

// ==========================================
// BADGE AWARDED
// ==========================================

/**
 * Trigger quando uma badge é desbloqueada.
 * Envia notificação push e salva no Firestore.
 */
export const onBadgeAwarded = onDocumentCreated(
  {document: "user_badges/{badgeDocId}", region: FUNCTION_REGION},
  async (event) => {
    const userBadge = event.data?.data();
    if (!userBadge) {
      logger.info(
        "[onBadgeAwarded] No data, skipping"
      );
      return;
    }

    const badgeDocId = event.params.badgeDocId;
    const userId = userBadge.user_id;
    const badgeId = userBadge.badge_id;

    if (!userId || !badgeId) {
      logger.error(
        "[onBadgeAwarded] Missing user_id" +
        ` or badge_id in document ${badgeDocId}`
      );
      return;
    }

    logger.info(
      `[onBadgeAwarded] Badge ${badgeId}` +
      ` awarded to user ${userId}`
    );

    try {
      // Buscar dados da badge para nome e icone
      const badgeDoc = await getDb()
        .collection("badges")
        .doc(badgeId)
        .get();
      const badge = badgeDoc.exists ?
        badgeDoc.data() :
        null;

      const badgeName =
        badge?.name || badge?.title || badgeId;
      const badgeIconUrl =
        badge?.icon_url ||
        badge?.iconUrl ||
        null;

      // Enviar notificação push
      const notificationSent =
        await sendNotificationToUser(userId, {
          title: ACHIEVEMENT_NOTIFICATIONS.BADGE_AWARDED.title["pt-BR"](),
          body: ACHIEVEMENT_NOTIFICATIONS.BADGE_AWARDED.body["pt-BR"]({
            badgeName,
          }),
          type: NotificationType.ACHIEVEMENT,
          imageUrl: badgeIconUrl || undefined,
          data: {
            action: "badges",
            badgeId: badgeId,
          },
        });

      logger.info(
        "[onBadgeAwarded] Push notification" +
        ` sent: ${notificationSent}`
      );

      // Salvar notificação no Firestore
      await saveNotificationToFirestore(userId, {
        userId,
        title: ACHIEVEMENT_NOTIFICATIONS.BADGE_AWARDED.title["pt-BR"](),
        body: ACHIEVEMENT_NOTIFICATIONS.BADGE_AWARDED.body["pt-BR"]({
          badgeName,
        }),
        type: NotificationType.ACHIEVEMENT,
        action: "badges",
      });

      logger.info(
        "[onBadgeAwarded] Notification saved" +
        ` to Firestore for user ${userId}`
      );
    } catch (error) {
      logger.error(
        "[onBadgeAwarded] Error processing" +
        " badge notification:",
        error
      );
    }
  }
);

// ==========================================
// STREAK NOTIFICATIONS
// ==========================================

/**
 * Milestones de streak para notificações.
 * Usado pelo processamento de XP em index.ts.
 */
export const STREAK_MILESTONES = [
  {
    streak: 30,
    title: ACHIEVEMENT_NOTIFICATIONS.STREAK_30.title["pt-BR"](),
    body: ACHIEVEMENT_NOTIFICATIONS.STREAK_30.body["pt-BR"](),
  },
  {
    streak: 10,
    title: ACHIEVEMENT_NOTIFICATIONS.STREAK_10.title["pt-BR"](),
    body: ACHIEVEMENT_NOTIFICATIONS.STREAK_10.body["pt-BR"](),
  },
  {
    streak: 7,
    title: ACHIEVEMENT_NOTIFICATIONS.STREAK_7.title["pt-BR"](),
    body: ACHIEVEMENT_NOTIFICATIONS.STREAK_7.body["pt-BR"](),
  },
  {
    streak: 3,
    title: ACHIEVEMENT_NOTIFICATIONS.STREAK_3.title["pt-BR"](),
    body: ACHIEVEMENT_NOTIFICATIONS.STREAK_3.body["pt-BR"](),
  },
];

/**
 * Envia notificação de streak milestone se o
 * jogador atingiu um marco.
 *
 * FIX #1534: itera TODOS os milestones entre
 * previousStreak e currentStreak para não perder
 * milestones intermediários (ex: streak 6→8
 * notifica milestone 7).
 *
 * @param {string} userId - ID do usuário
 * @param {number} currentStreak - Streak atual
 * @param {number} previousStreak - Streak anterior
 * @return {Promise<boolean>} true se enviou
 */
export async function sendStreakNotificationIfMilestone(
  userId: string,
  currentStreak: number,
  previousStreak: number = currentStreak - 1
): Promise<boolean> {
  const reachedMilestones = STREAK_MILESTONES.filter(
    (m) => m.streak > previousStreak && m.streak <= currentStreak
  );

  if (reachedMilestones.length === 0) {
    return false;
  }

  const milestone = reachedMilestones[0];

  logger.info(
    `[STREAK] User ${userId} reached streak` +
    ` milestone: ${currentStreak} games`
  );

  try {
    // Enviar notificação push
    const sent = await sendNotificationToUser(
      userId,
      {
        title: milestone.title,
        body: milestone.body,
        type: NotificationType.ACHIEVEMENT,
        data: {
          action: "achievements",
          streak: String(currentStreak),
        },
      }
    );

    // Salvar no Firestore
    await saveNotificationToFirestore(userId, {
      userId,
      title: milestone.title,
      body: milestone.body,
      type: NotificationType.ACHIEVEMENT,
      action: "achievements",
    });

    logger.info(
      `[STREAK] Notification sent to ${userId}:` +
      ` ${milestone.title}`
    );
    return sent;
  } catch (error) {
    logger.error(
      "[STREAK] Error sending streak" +
      ` notification to ${userId}:`,
      error
    );
    return false;
  }
}

// ==========================================
// MVP RECEIVED
// ==========================================

/**
 * Envia notificação de MVP diretamente (chamado
 * externamente ou pelo trigger).
 *
 * @param {string} gameId - ID do jogo
 * @param {Record<string, unknown>} gameData -
 *   Dados do jogo (já carregados)
 * @return {Promise<void>} Resolução após envio
 */
export async function notifyMvpAwardedDirect(
  gameId: string,
  gameData: Record<string, unknown>
): Promise<void> {
  const mvpId =
    (gameData.mvp_id || gameData.mvpId) as
      string | undefined;
  if (!mvpId) return;

  // Só notifica se o jogo está FINISHED
  if (gameData.status !== "FINISHED") return;

  logger.info(
    "[MVP_AWARDED_DIRECT] MVP definido" +
    ` no jogo ${gameId}: ${mvpId}`
  );

  const gameName =
    (gameData.location_name as string) ||
    (gameData.field_name as string) ||
    "a partida";

  await sendAndSaveNotification(mvpId, {
    userId: mvpId,
    title: ACHIEVEMENT_NOTIFICATIONS.MVP_RECEIVED.title["pt-BR"](),
    body: ACHIEVEMENT_NOTIFICATIONS.MVP_RECEIVED.body["pt-BR"]({
      gameName,
    }),
    type: NotificationType.MVP_RECEIVED,
    gameId: gameId,
    action: "game_detail/" + gameId,
  });

  logger.info(
    "[MVP_AWARDED_DIRECT] Notificacao" +
    ` enviada para ${mvpId}`
  );
}

/**
 * Trigger quando um jogador é eleito MVP.
 * Escuta mudanças no campo mvp_id do jogo
 * FINISHED.
 */
export const onMvpAwarded = onDocumentUpdated(
  {document: "games/{gameId}", region: FUNCTION_REGION},
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const gameId = event.params.gameId;

    // Verificar se MVP foi definido
    const beforeMvpId =
      before.mvp_id || before.mvpId;
    const afterMvpId =
      after.mvp_id || after.mvpId;

    if (
      !afterMvpId ||
      beforeMvpId === afterMvpId
    ) {
      return;
    }

    // Só notifica se o jogo está FINISHED
    if (after.status !== "FINISHED") return;

    try {
      await notifyMvpAwardedDirect(
        gameId,
        after as Record<string, unknown>
      );
    } catch (e) {
      logger.error(
        "[MVP_AWARDED] Erro ao notificar" +
        ` MVP ${afterMvpId}:`,
        e
      );
    }
  }
);

// ==========================================
// RANKING/DIVISION CHANGED
// ==========================================

/**
 * Trigger quando a divisão de um jogador muda
 * (promoção ou rebaixamento).
 */
export const onDivisionChanged =
  onDocumentUpdated(
    {document: "season_participation/{partId}", region: FUNCTION_REGION},
    async (event) => {
      const before = event.data?.before.data();
      const after = event.data?.after.data();
      if (!before || !after) return;

      const userId =
        after.user_id || after.userId;
      if (!userId) return;

      const beforeDivision = before.division;
      const afterDivision = after.division;

      // Só notifica se a divisão mudou
      if (
        !afterDivision ||
        beforeDivision === afterDivision
      ) {
        return;
      }

      logger.info(
        `[RANKING_CHANGED] User ${userId}:` +
        ` ${beforeDivision} -> ${afterDivision}`
      );

      // Determinar promoção ou rebaixamento
      const divisionOrderMap:
        Record<string, number> = {
          // Nomes em português (padrão league.ts)
          BRONZE: 0,
          PRATA: 1,
          OURO: 2,
          DIAMANTE: 3,
          // Nomes em inglês (legado)
          SILVER: 1,
          GOLD: 2,
          DIAMOND: 3,
        };
      const beforeIndex =
        divisionOrderMap[
          beforeDivision || "BRONZE"
        ] ?? 0;
      const afterIndex =
        divisionOrderMap[afterDivision] ?? 0;
      const isPromotion =
        afterIndex > beforeIndex;

      // Mapear nomes para exibição
      const divisionNames:
        Record<string, string> = {
          BRONZE: "Bronze",
          PRATA: "Prata",
          OURO: "Ouro",
          DIAMANTE: "Diamante",
          SILVER: "Prata",
          GOLD: "Ouro",
          DIAMOND: "Diamante",
        };

      const divisionName =
        divisionNames[afterDivision] ||
        afterDivision;
      const msg = isPromotion ?
        ACHIEVEMENT_NOTIFICATIONS.DIVISION_PROMOTED :
        ACHIEVEMENT_NOTIFICATIONS.DIVISION_DEMOTED;
      const title = msg.title["pt-BR"]();
      const body = isPromotion ?
        `Parabéns! Você subiu para a divisão ${divisionName}!` :
        `Você desceu para a divisão ${divisionName}. Continue jogando!`;

      try {
        await sendAndSaveNotification(userId, {
          userId,
          title,
          body,
          type:
            NotificationType.RANKING_CHANGED,
          action: "profile",
        });

        logger.info(
          "[RANKING_CHANGED] Notificacao" +
          ` enviada para ${userId}`
        );
      } catch (e) {
        logger.error(
          "[RANKING_CHANGED] Erro ao" +
          ` notificar ${userId}:`,
          e
        );
      }
    }
  );
