/**
 * MOTOR DE RECORRÊNCIA
 *
 * Quando um jogo com recorrência é finalizado (status = FINISHED),
 * cria automaticamente o próximo jogo da série.
 *
 * Idempotência: flag next_game_created no jogo atual.
 * Máximo: 52 recorrências (1 ano de jogos semanais).
 */

import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {FUNCTION_REGION} from "../constants";
import {
  sendNotificationToUsers,
  NotificationType,
  FcmNotification,
} from "../notifications/helpers";

type RecurrenceType = "weekly" | "biweekly" | "monthly";

/**
 * Calcula a próxima data com base no tipo de recorrência.
 * @param {string} dateStr - Data base no formato YYYY-MM-DD
 * @param {RecurrenceType} recurrence - Tipo de recorrência
 * @return {string} Próxima data no formato YYYY-MM-DD
 */
function getNextDate(dateStr: string, recurrence: RecurrenceType): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  switch (recurrence) {
  case "weekly":
    date.setDate(date.getDate() + 7);
    break;
  case "biweekly":
    date.setDate(date.getDate() + 14);
    break;
  case "monthly":
    date.setMonth(date.getMonth() + 1);
    break;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Conta quantos jogos já foram criados nesta série recorrente.
 * @param {admin.firestore.Firestore} db - Instância do Firestore
 * @param {string} originalGameId - ID do jogo original da série
 * @return {Promise<number>} Quantidade de jogos filhos
 */
async function countRecurringGames(
  db: admin.firestore.Firestore,
  originalGameId: string
): Promise<number> {
  const snapshot = await db
    .collection("games")
    .where("recurrence_parent_id", "==", originalGameId)
    .count()
    .get();

  return snapshot.data().count;
}

export const onGameFinishedCreateRecurrence = onDocumentUpdated(
  {document: "games/{gameId}", region: FUNCTION_REGION},
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;

    const gameId = event.params.gameId;

    const wasAlreadyFinished = before?.status === "FINISHED";
    const isNowFinished = after.status === "FINISHED";
    if (!isNowFinished || wasAlreadyFinished) return;

    const recurrence = after.recurrence as string | undefined;
    if (!recurrence || recurrence === "none") return;

    const db = admin.firestore();
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(event.data!.after.ref);
      if (snap.get("next_game_created") === true) return false;
      tx.update(event.data!.after.ref, {next_game_created: true});
      return true;
    });
    if (!claimed) {
      logger.info(`[RECURRENCE] ${gameId} já reivindicado, skip.`);
      return;
    }

    const parentId = (after.recurrence_parent_id as string) || gameId;
    const childCount = await countRecurringGames(db, parentId);
    if (childCount >= 52) {
      logger.info(
        `[RECURRENCE] Max recurrences (52) reached for series ${parentId}, stopping.`
      );
      await event.data?.after.ref.update({next_game_created: true});
      return;
    }

    try {
      const nextDate = getNextDate(after.date as string, recurrence as RecurrenceType);
      const [hours, minutes] = (after.time || "00:00").split(":").map(Number);
      const dateTime = Timestamp.fromDate(
        new Date(`${nextDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`)
      );

      const newGame: Record<string, unknown> = {
        dateTime: dateTime,
        owner_id: after.owner_id,
        owner_name: after.owner_name,
        status: "SCHEDULED",
        date: nextDate,
        time: after.time,
        end_time: after.end_time || null,
        field_type: after.field_type,
        game_type: after.game_type,
        max_players: after.max_players,
        max_goalkeepers: after.max_goalkeepers,
        number_of_teams: after.number_of_teams,
        daily_price: after.daily_price,
        total_cost: after.total_cost,
        pix_payment_enabled: after.pix_payment_enabled || false,
        pix_key: after.pix_key || null,
        pix_key_type: after.pix_key_type || null,
        pix_beneficiary_name: after.pix_beneficiary_name || null,
        location_id: after.location_id || null,
        location_name: after.location_name,
        location_address: after.location_address,
        field_id: after.field_id || null,
        field_name: after.field_name || null,
        visibility: after.visibility,
        rules: after.rules || "",
        recurrence: recurrence,
        recurrence_parent_id: parentId,
        team1_name: "Time 1",
        team2_name: "Time 2",
        players_count: 0,
        goalkeepers_count: 0,
        players: [],
        team1_score: 0,
        team2_score: 0,
        xp_processed: false,
        voting_concluded: false,
        post_game_report_generated: false,
        auto_closed: false,
        co_organizers: [],
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (after.group_id) {
        newGame.group_id = after.group_id;
        newGame.group_name = after.group_name || null;
      }

      if (after.stream_url) {
        newGame.stream_url = after.stream_url;
      }

      const newGameRef = await db.collection("games").add(newGame);
      logger.info(
        `[RECURRENCE] Created recurring game ${newGameRef.id} from ${gameId}` +
        ` (${recurrence}, date ${nextDate}, child ${childCount + 1}/52)`
      );

      await event.data?.after.ref.update({
        next_game_created: true,
        next_game_id: newGameRef.id,
      });

      if (after.group_id) {
        try {
          const membersSnap = await db
            .collection("groups")
            .doc(after.group_id as string)
            .collection("members")
            .get();

          const batch = db.batch();
          const ownerId = after.owner_id as string;

          batch.set(
            db.collection("confirmations").doc(`${newGameRef.id}_${ownerId}`),
            {
              game_id: newGameRef.id,
              user_id: ownerId,
              user_name: after.owner_name || "Organizador",
              status: "CONFIRMED",
              position: "FIELD",
              is_casual_player: false,
              created_at: admin.firestore.FieldValue.serverTimestamp(),
            }
          );

          let inviteCount = 0;
          const memberIds: string[] = [];
          membersSnap.docs.forEach((memberDoc) => {
            const memberId = memberDoc.id;
            if (memberId === ownerId) return;
            const memberData = memberDoc.data();
            batch.set(
              db.collection("confirmations").doc(`${newGameRef.id}_${memberId}`),
              {
                game_id: newGameRef.id,
                user_id: memberId,
                user_name: memberData.display_name || memberData.name || "Membro",
                status: "PENDING",
                position: "FIELD",
                is_casual_player: false,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
              }
            );
            memberIds.push(memberId);
            inviteCount++;
          });

          await batch.commit();
          logger.info(
            `[RECURRENCE] Auto-invited ${inviteCount + 1} members for recurring game ${newGameRef.id}`
          );

          if (memberIds.length > 0) {
            const locationName = after.location_name || "Local";
            const [y, m, d] = nextDate.split("-");
            const timeStr = `${d}/${m}/${y} às ${after.time}`;
            const recurrenceLabel =
              recurrence === "weekly" ?
                "semanal" :
                recurrence === "biweekly" ?
                  "quinzenal" :
                  "mensal";

            const notification: FcmNotification = {
              title: `🔄 Jogo recorrente (${recurrenceLabel}): ${locationName}`,
              body: `Novo jogo ${recurrenceLabel} marcado! ${timeStr}. Confirme presença.`,
              type: NotificationType.GAME_INVITE,
              data: {gameId: newGameRef.id},
            };

            await sendNotificationToUsers(
              memberIds,
              notification,
              after.group_id as string
            );
            logger.info(
              `[RECURRENCE] Sent ${memberIds.length} notifications for ${newGameRef.id}`
            );
          }
        } catch (err) {
          logger.error(
            `[RECURRENCE] Failed to auto-invite/notify for ${newGameRef.id}:`,
            err
          );
        }
      }
    } catch (err) {
      logger.error(`[RECURRENCE] Failed to create recurrence for ${gameId}:`, err);
    }
  }
);
