/**
 * NOTIFICAÇÕES DE JOGOS
 * Triggers para criação, atualização, cancelamento
 * e vagas em jogos.
 */

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
  sendNotificationToUsers,
} from "./helpers";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();

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
      console.log(
        "[GAME_CREATED] Notification for" +
        ` game ${gameId} already sent,` +
        " skipping (idempotent)."
      );
      return;
    }

    if (game.group_id) {
      try {
        const membersSnap = await getDb()
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
          const ownerDoc = await getDb()
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
              title: "Novo jogo criado!",
              body: ownerName +
                " criou um novo jogo." +
                " Confirme sua presenca!",
              type: NotificationType.GAME_INVITE,
              data: {
                gameId: gameId,
                action: "game_detail/" + gameId,
              },
            }
          );

          // Marcar como enviado para idempotência
          await getDb()
            .collection("games")
            .doc(gameId)
            .update({
              invite_notification_sent: true,
            });
        }
      } catch (e) {
        console.error(
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

      if (
        before.status !== "CANCELLED" &&
        after.status === "CANCELLED"
      ) {
        try {
          const confirmationsSnap = await getDb()
            .collection("confirmations")
            .where("game_id", "==", gameId)
            .where("status", "==", "CONFIRMED")
            .get();

          type DocSnap =
            admin.firestore.QueryDocumentSnapshot;
          const userIds =
            confirmationsSnap.docs.map(
              (doc: DocSnap) => {
                const d = doc.data();
                return d.user_id || d.userId;
              }
            );

          if (userIds.length > 0) {
            await sendNotificationToUsers(
              userIds,
              {
                title: "Jogo cancelado",
                body: "O jogo foi cancelado" +
                  " pelo organizador.",
                type:
                  NotificationType.GAME_CANCELLED,
                data: {
                  gameId: gameId,
                },
              }
            );
          }
        } catch (e) {
          console.error(
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
          const confirmationsSnap = await getDb()
            .collection("confirmations")
            .where("game_id", "==", gameId)
            .where("status", "==", "CONFIRMED")
            .get();

          type DocSnap =
            admin.firestore.QueryDocumentSnapshot;
          const userIds =
            confirmationsSnap.docs.map(
              (doc: DocSnap) => {
                const d = doc.data();
                return d.user_id || d.userId;
              }
            );

          if (userIds.length > 0) {
            await sendNotificationToUsers(
              userIds,
              {
                title: "Jogo atualizado",
                body: "Os detalhes do jogo" +
                  " mudaram. Confira no app.",
                type:
                  NotificationType.GAME_UPDATED,
                data: {
                  gameId: gameId,
                },
              }
            );
          }
        } catch (e) {
          console.error(
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

    console.log(
      "[GAME_VACANCY] Vaga aberta no" +
      ` jogo ${gameId}` +
      ` (confirmacao ${confirmationId})`
    );

    try {
      // Buscar dados do jogo
      const gameDoc = await getDb()
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
          console.log(
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
      await getDb()
        .collection("games")
        .doc(gameId)
        .update({
          vacancy_notified_at:
              admin.firestore.FieldValue
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
      const confirmationsSnap = await getDb()
        .collection("confirmations")
        .where("game_id", "==", gameId)
        .where("status", "==", "CONFIRMED")
        .get();

      const currentPlayers =
        confirmationsSnap.size;

      // Só notifica se há vaga real após cancelamento
      // FIX #1582: condição era currentPlayers >= maxPlayers - 1,
      // que disparava mesmo quando o jogo continuava cheio
      // (ex: 15 confirmados, 1 cancela → 14 = maxPlayers, sem vaga).
      if (currentPlayers < maxPlayers) {
        // 1. Notificar a waitlist
        // FIX #753: era .collection("waitlist") raiz inexistente.
        // Android escreve em games/{gameId}/waitlist/ (subcollection).
        // Usar subcollection direta com gameId já disponível.
        const waitlistSnap = await getDb()
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
              title: "Vaga disponivel!",
              body: "Abriu uma vaga em" +
                ` ${gameName}. Corra` +
                " para confirmar!",
              type:
                NotificationType.GAME_VACANCY,
              data: {
                gameId: gameId,
                action:
                  "game_detail/" + gameId,
              },
            }
          );

          console.log(
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
          const membersSnap = await getDb()
            .collection("groups")
            .doc(groupId)
            .collection("members")
            .get();

          const confirmedUserIds =
            confirmationsSnap.docs.map(
              (doc: DocSnap) => {
                const data = doc.data();
                return (
                  data.user_id || data.userId
                );
              }
            );

          const memberIds = membersSnap.docs
            .map((doc: DocSnap) => doc.id)
            .filter(
              (id: string) =>
                !confirmedUserIds
                  .includes(id) &&
                !waitlistUserIds
                  .includes(id)
            )
            .slice(0, 20);

          if (memberIds.length > 0) {
            await sendNotificationToUsers(
              memberIds,
              {
                title: "Vaga disponivel!",
                body: "Abriu uma vaga em" +
                  ` ${gameName}` +
                  ` (${gameDate}).` +
                  " Confirme sua presenca!",
                type:
                  NotificationType.GAME_VACANCY,
                data: {
                  gameId: gameId,
                  action:
                    "game_detail/" + gameId,
                },
              }
            );

            console.log(
              "[GAME_VACANCY] Notificacao" +
              " enviada para" +
              ` ${memberIds.length}` +
              " membros do grupo"
            );
          }
        }
      }
    } catch (e) {
      console.error(
        "[GAME_VACANCY] Erro ao" +
        " processar vaga:",
        e
      );
    }
  }
);
