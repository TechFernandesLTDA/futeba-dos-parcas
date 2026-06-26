/**
 * NOTIFICAÇÕES DE JOGOS
 * Triggers para criação, atualização, cancelamento
 * e vagas em jogos.
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {
  FUNCTION_REGION,
} from "../constants";
import {
  NotificationType,
  sendNotificationToUsers,
} from "./helpers";
import {GAME_NOTIFICATIONS} from "./notification-messages";
import {db} from "../_db";

const CONFIRMATION_PAGE_SIZE = 100;
const GROUP_MEMBER_PAGE_SIZE = 50;
const MAX_GROUP_VACANCY_NOTIFICATIONS = 20;

/**
 * Busca IDs de usuários confirmados para um jogo de forma paginada.
 * @param {string} gameId
 * @return {Promise<string[]>}
 */
async function fetchConfirmedUserIdsForGame(
  gameId: string
): Promise<string[]> {
  const userIds: string[] = [];
  let lastDoc:
    FirebaseFirestore.QueryDocumentSnapshot |
    undefined;

  while (true) {
    // #2994: pagina por __name__ implícito para
    // evitar leituras irrestritas da coleção raiz
    // de confirmations em handlers event-driven.
    let query: FirebaseFirestore.Query = db()
      .collection("confirmations")
      .where("game_id", "==", gameId)
      .where("status", "==", "CONFIRMED")
      .limit(CONFIRMATION_PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const confirmationsSnap = await query.get();
    if (confirmationsSnap.empty) {
      break;
    }

    type DocSnap =
      admin.firestore.QueryDocumentSnapshot;
    userIds.push(
      ...confirmationsSnap.docs.map(
        (doc: DocSnap) => {
          const data = doc.data();
          return data.user_id || data.userId;
        }
      )
    );

    if (
      confirmationsSnap.size <
      CONFIRMATION_PAGE_SIZE
    ) {
      break;
    }

    lastDoc =
      confirmationsSnap.docs[
        confirmationsSnap.docs.length - 1
      ];
  }

  return userIds;
}

/**
 * Conta confirmações ativas usando agregação em vez de full scan.
 * @param {string} gameId
 * @return {Promise<number>}
 */
async function countConfirmedPlayersForGame(
  gameId: string
): Promise<number> {
  const countSnap = await db()
    .collection("confirmations")
    .where("game_id", "==", gameId)
    .where("status", "==", "CONFIRMED")
    .count()
    .get();

  return countSnap.data().count;
}

/**
 * Coleta membros elegíveis do grupo até o limite de notificações de vaga.
 * @param {string} groupId
 * @param {Set<string>} excludedUserIds
 * @param {number} limit
 * @return {Promise<string[]>}
 */
async function fetchEligibleGroupMemberIdsForVacancy(
  groupId: string,
  excludedUserIds: Set<string>,
  limit: number
): Promise<string[]> {
  const memberIds: string[] = [];
  let lastDoc:
    FirebaseFirestore.QueryDocumentSnapshot |
    undefined;

  while (memberIds.length < limit) {
    // #2994: pagina por __name__ implícito e
    // para assim que juntamos membros elegíveis
    // suficientes para a notificação de vaga.
    let query: FirebaseFirestore.Query = db()
      .collection("groups")
      .doc(groupId)
      .collection("members")
      .limit(GROUP_MEMBER_PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const membersSnap = await query.get();
    if (membersSnap.empty) {
      break;
    }

    type DocSnap =
      admin.firestore.QueryDocumentSnapshot;
    for (const doc of membersSnap.docs as DocSnap[]) {
      if (excludedUserIds.has(doc.id)) {
        continue;
      }

      memberIds.push(doc.id);
      if (memberIds.length >= limit) {
        break;
      }
    }

    if (membersSnap.size < GROUP_MEMBER_PAGE_SIZE) {
      break;
    }

    lastDoc =
      membersSnap.docs[
        membersSnap.docs.length - 1
      ];
  }

  return memberIds;
}

// ==========================================
// GAME CREATED
// ==========================================

/**
 * Trigger: Quando um novo jogo é criado.
 * Envia notificação de convite para todos os
 * membros do grupo.
 *
 * IDEMPOTÊNCIA: Marca o documento do jogo com
 * notification_sent para evitar envio duplicado.
 */
export const onGameCreated = onDocumentCreated(
  {document: "games/{gameId}", region: FUNCTION_REGION},
  async (event) => {
    const game = event.data?.data();
    if (!game) return;

    const gameId = event.params.gameId;
    const ownerId = game.owner_id;

    // Idempotência: verificar se já foi enviada
    if (game.invite_notification_sent === true) {
      logger.info(
        "[GAME_CREATED] Notification for" +
        ` game ${gameId} already sent,` +
        " skipping (idempotent)."
      );
      return;
    }

    if (game.group_id) {
      try {
        const membersSnap = await db()
          .collection("groups")
          .doc(game.group_id)
          .collection("members")
          .where(
            "role",
            "in",
            ["MEMBER", "ADMIN", "OWNER"]
          )
          .get();

        type DocSnap =
          admin.firestore.QueryDocumentSnapshot;
        const memberIds = membersSnap.docs
          .map((doc: DocSnap) => doc.id)
          .filter(
            (id: string) => id !== ownerId
          );

        if (memberIds.length > 0) {
          const ownerDoc = await db()
            .collection("users")
            .doc(ownerId)
            .get();
          const ownerName = ownerDoc.exists ?
            (ownerDoc.data()?.name ||
              ownerDoc.data()?.nickname ||
              "Alguem") :
            "Alguem";

          await sendNotificationToUsers(
            memberIds,
            {
              title: GAME_NOTIFICATIONS.GAME_CREATED.title["pt-BR"](),
              body: GAME_NOTIFICATIONS.GAME_CREATED.body["pt-BR"]({
                ownerName,
              }),
              type: NotificationType.GAME_INVITE,
              data: {
                gameId: gameId,
                action: "game_detail/" + gameId,
              },
            }
          );

          // Marcar como enviado para idempotência
          await db()
            .collection("games")
            .doc(gameId)
            .update({
              invite_notification_sent: true,
            });
        }
      } catch (e) {
        logger.error(
          "Erro ao notificar membros do grupo:",
          e
        );
      }
    }
  }
);

// ==========================================
// GAME UPDATED / CANCELLED
// ==========================================

/**
 * Trigger: Quando um jogo é atualizado.
 * Notifica sobre cancelamento ou mudança de
 * detalhes.
 */
export const onGameUpdatedNotification =
  onDocumentUpdated(
    {document: "games/{gameId}", region: FUNCTION_REGION},
    async (event) => {
      const before = event.data?.before.data();
      const after = event.data?.after.data();
      if (!before || !after) return;

      const gameId = event.params.gameId;
      let confirmedUserIds:
        string[] |
        null = null;

      if (
        before.status !== "CANCELLED" &&
        after.status === "CANCELLED"
      ) {
        try {
          const userIds =
            confirmedUserIds ??
            await fetchConfirmedUserIdsForGame(
              gameId
            );
          confirmedUserIds = userIds;

          if (userIds.length > 0) {
            await sendNotificationToUsers(
              userIds,
              {
                title: GAME_NOTIFICATIONS.GAME_CANCELLED.title["pt-BR"](),
                body: GAME_NOTIFICATIONS.GAME_CANCELLED.body["pt-BR"](),
                type:
                  NotificationType.GAME_CANCELLED,
                data: {
                  gameId: gameId,
                },
              }
            );
          }
        } catch (e) {
          logger.error(
            "Erro ao notificar cancelamento:",
            e
          );
        }
      }

      if (
        before.date !== after.date ||
        before.location_id !== after.location_id
      ) {
        try {
          const userIds =
            confirmedUserIds ??
            await fetchConfirmedUserIdsForGame(
              gameId
            );
          confirmedUserIds = userIds;

          if (userIds.length > 0) {
            await sendNotificationToUsers(
              userIds,
              {
                title: GAME_NOTIFICATIONS.GAME_UPDATED.title["pt-BR"](),
                body: GAME_NOTIFICATIONS.GAME_UPDATED.body["pt-BR"](),
                type:
                  NotificationType.GAME_UPDATED,
                data: {
                  gameId: gameId,
                },
              }
            );
          }
        } catch (e) {
          logger.error(
            "Erro ao notificar atualizacao:",
            e
          );
        }
      }
    }
  );

// ==========================================
// GAME VACANCY
// ==========================================

/**
 * Trigger quando um jogador cancela presença e
 * abre vaga. Notifica waitlist e membros do grupo.
 */
export const onGameVacancy = onDocumentUpdated(
  {document: "confirmations/{confirmationId}", region: FUNCTION_REGION},
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const confirmationId =
      event.params.confirmationId;
    const beforeStatus = before.status;
    const afterStatus = after.status;

    // Só notifica se era CONFIRMED -> CANCELLED
    if (
      beforeStatus !== "CONFIRMED" ||
      afterStatus !== "CANCELLED"
    ) {
      return;
    }

    const gameId =
      after.game_id || after.gameId;
    if (!gameId) return;

    logger.info(
      "[GAME_VACANCY] Vaga aberta no" +
      ` jogo ${gameId}` +
      ` (confirmacao ${confirmationId})`
    );

    try {
      // Buscar dados do jogo
      const gameDoc = await db()
        .collection("games")
        .doc(gameId)
        .get();
      if (!gameDoc.exists) return;

      const game = gameDoc.data();
      if (!game) return;

      // Só notifica se jogo ainda aberto
      if (
        game.status !== "SCHEDULED" &&
        game.status !== "CONFIRMED"
      ) {
        return;
      }

      // B2: Idempotencia - verificar se vaga ja foi
      // notificada recentemente (evita envio duplicado
      // quando multiplos jogadores cancelam em seguida)
      if (game.vacancy_notified_at) {
        const notifiedAt =
            game.vacancy_notified_at.toDate();
        const now = new Date();
        const minutesSince =
            (now.getTime() - notifiedAt.getTime()) /
            60000;
        if (minutesSince < 5) {
          logger.info(
            "[GAME_VACANCY] Vaga ja notificada" +
              ` ha ${minutesSince.toFixed(1)}min` +
              ` para jogo ${gameId}, ignorando.`
          );
          return;
        }
      }

      // Marcar como notificada para idempotencia
      // (antes de enviar, para evitar race condition
      // com triggers paralelos)
      await db()
        .collection("games")
        .doc(gameId)
        .update({
          vacancy_notified_at:
              FieldValue
                .serverTimestamp(),
        });

      const maxPlayers =
        game.max_players ||
        game.maxPlayers ||
        14;
      const groupId =
        game.group_id || game.groupId;
      const gameName =
        game.location_name ||
        game.field_name ||
        "o jogo";
      const gameDate = game.date || "";

      // Contar confirmações atuais
      const currentPlayers =
        await countConfirmedPlayersForGame(
          gameId
        );

      // Só notifica se há vaga real após cancelamento
      // FIX #1582: condição era currentPlayers >= maxPlayers - 1,
      // que disparava mesmo quando o jogo continuava cheio
      // (ex: 15 confirmados, 1 cancela → 14 = maxPlayers, sem vaga).
      if (currentPlayers < maxPlayers) {
        // 1. Notificar a waitlist
        // FIX #753: era .collection("waitlist") raiz inexistente.
        // Android escreve em games/{gameId}/waitlist/ (subcollection).
        // Usar subcollection direta com gameId já disponível.
        const waitlistSnap = await db()
          .collection("games")
          .doc(gameId)
          .collection("waitlist")
          .where("status", "==", "WAITING")
          .orderBy("created_at", "asc")
          .limit(5)
          .get();

        type DocSnap =
          admin.firestore.QueryDocumentSnapshot;
        const waitlistUserIds =
          waitlistSnap.docs.map(
            (doc: DocSnap) => {
              const data = doc.data();
              return data.user_id || data.userId;
            }
          );

        if (waitlistUserIds.length > 0) {
          await sendNotificationToUsers(
            waitlistUserIds,
            {
              title: GAME_NOTIFICATIONS.GAME_VACANCY.title["pt-BR"](),
              body: GAME_NOTIFICATIONS.GAME_VACANCY.body["pt-BR"]({
                gameName,
              }),
              type:
                NotificationType.GAME_VACANCY,
              data: {
                gameId: gameId,
                action:
                  "game_detail/" + gameId,
              },
            }
          );

          logger.info(
            "[GAME_VACANCY] Notificacao" +
            " enviada para" +
            ` ${waitlistUserIds.length}` +
            " na waitlist"
          );
        }

        // 2. Se poucos na espera, notificar grupo
        if (
          groupId &&
          waitlistUserIds.length < 3
        ) {
          const confirmedUserIds =
            await fetchConfirmedUserIdsForGame(
              gameId
            );
          const excludedUserIds =
            new Set<string>([
              ...confirmedUserIds,
              ...waitlistUserIds,
            ]);
          const memberIds =
            await fetchEligibleGroupMemberIdsForVacancy(
              groupId,
              excludedUserIds,
              MAX_GROUP_VACANCY_NOTIFICATIONS
            );

          if (memberIds.length > 0) {
            await sendNotificationToUsers(
              memberIds,
              {
                title: GAME_NOTIFICATIONS.GAME_VACANCY.title["pt-BR"](),
                body: GAME_NOTIFICATIONS.GAME_VACANCY_GROUP.body["pt-BR"]({
                  gameName,
                  gameDate,
                }),
                type:
                  NotificationType.GAME_VACANCY,
                data: {
                  gameId: gameId,
                  action:
                    "game_detail/" + gameId,
                },
              }
            );

            logger.info(
              "[GAME_VACANCY] Notificacao" +
              " enviada para" +
              ` ${memberIds.length}` +
              " membros do grupo"
            );
          }
        }
      }
    } catch (e) {
      logger.error(
        "[GAME_VACANCY] Erro ao" +
        " processar vaga:",
        e
      );
    }
  }
);
