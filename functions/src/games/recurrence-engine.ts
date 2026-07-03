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
import {Timestamp, FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {FUNCTION_REGION} from "../constants";
import {
  sendNotificationToUsers,
  NotificationType,
  FcmNotification,
} from "../notifications/helpers";
import {
  RecurrenceType,
  getNextDate,
  recurrenceStopReason,
} from "./recurrence-limits";

const ACTIVE_MEMBER_STATUS = "ACTIVE";
const MAX_CONFIRMATION_WRITES_PER_BATCH = 450;
const RECURRING_MEMBERS_PAGE_SIZE = 100;

export interface RecurringMemberInvite {
  memberId: string;
  userName: string;
}

/**
 * Retorna dados de convite apenas para membros ativos e diferentes do owner.
 *
 * @param {string} memberId - ID do documento do membro.
 * @param {admin.firestore.DocumentData} memberData - Dados do membro.
 * @param {string} ownerId - ID do organizador do jogo.
 * @return {RecurringMemberInvite | null} Convite normalizado ou null.
 */
export function toActiveRecurringMemberInvite(
  memberId: string,
  memberData: admin.firestore.DocumentData,
  ownerId: string
): RecurringMemberInvite | null {
  if (memberId === ownerId) return null;
  if (memberData.status !== ACTIVE_MEMBER_STATUS) return null;

  return {
    memberId,
    userName: memberData.display_name || memberData.name || "Membro",
  };
}

/**
 * Divide listas em blocos para respeitar o limite de writes do Firestore.
 *
 * @template T
 * @param {Array<T>} items - Itens a dividir.
 * @param {number} size - Tamanho de cada bloco.
 * @return {Array<Array<T>>} Lista em blocos.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Busca membros ativos de um grupo em páginas para
 * evitar carregar a subcoleção inteira em uma única
 * leitura quando a série recorrente gera convites.
 *
 * @param {admin.firestore.Firestore} db - Instância do Firestore.
 * @param {string} groupId - Grupo dono da série.
 * @param {string} ownerId - Organizador atual do jogo.
 * @return {Promise<RecurringMemberInvite[]>} Convites elegíveis.
 */
export async function fetchActiveRecurringMemberInvites(
  db: admin.firestore.Firestore,
  groupId: string,
  ownerId: string
): Promise<RecurringMemberInvite[]> {
  const invites: RecurringMemberInvite[] = [];
  let lastDoc:
    admin.firestore.QueryDocumentSnapshot |
    undefined;

  while (true) {
    // #2994: pagina por __name__ implícito para
    // evitar .get() irrestrito sobre members.
    let query: admin.firestore.Query = db
      .collection("groups")
      .doc(groupId)
      .collection("members")
      .limit(RECURRING_MEMBERS_PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const membersSnap = await query.get();
    if (membersSnap.empty) {
      break;
    }

    invites.push(
      ...membersSnap.docs
        .map((memberDoc) => toActiveRecurringMemberInvite(
          memberDoc.id,
          memberDoc.data(),
          ownerId
        ))
        .filter((invite): invite is RecurringMemberInvite => invite !== null)
    );

    if (
      membersSnap.size <
      RECURRING_MEMBERS_PAGE_SIZE
    ) {
      break;
    }

    lastDoc =
      membersSnap.docs[membersSnap.docs.length - 1];
  }

  return invites;
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
    const hasPendingFollowUp =
      after.next_game_created === true &&
      after.next_game_confirmations_created !== true &&
      typeof after.next_game_id === "string";
    if (after.next_game_created === true && !hasPendingFollowUp) {
      logger.info(`[RECURRENCE] ${gameId} já possui próximo jogo, skip.`);
      return;
    }

    const db = admin.firestore();
    const parentId = (after.recurrence_parent_id as string) || gameId;
    const childCount = await countRecurringGames(db, parentId);

    // Limite efetivo da série (spec #2398, decisão "ambos"):
    // count XOR end_date, sempre respeitando o hard cap de 52.
    // Índice 1-based: a 1ª ocorrência (criada por web/android) não tem
    // recurrence_index → tratamos como 1.
    const currentIndex = (after.recurrence_index as number) || 1;
    const nextIndex = currentIndex + 1;
    const recurrenceCount =
      typeof after.recurrence_count === "number" ?
        (after.recurrence_count as number) :
        null;
    const recurrenceEndDate =
      typeof after.recurrence_end_date === "string" ?
        (after.recurrence_end_date as string) :
        null;

    try {
      const nextDate = getNextDate(after.date as string, recurrence as RecurrenceType);

      // Decisão de parada centralizada (count XOR end_date, sob hard cap 52).
      const stop = recurrenceStopReason({
        currentIndex,
        childCount,
        recurrenceCount,
        recurrenceEndDate,
        nextDate,
      });
      if (stop) {
        logger.info(
          `[RECURRENCE] Série ${parentId} encerrada (motivo=${stop}) no índice ` +
          `${currentIndex}; próxima data seria ${nextDate}.`
        );
        await event.data?.after.ref.update({
          next_game_created: true,
          recurrence_stop_reason: stop,
          updated_at: FieldValue.serverTimestamp(),
        });
        return;
      }

      const [hours, minutes] = (after.time || "00:00").split(":").map(Number);
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const dateTime = Timestamp.fromDate(
        new Date(`${nextDate}T${pad2(hours)}:${pad2(minutes)}:00-03:00`)
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
        location_lat: after.location_lat ?? null,
        location_lng: after.location_lng ?? null,
        location_lat_approx: after.location_lat_approx ?? null,
        location_lng_approx: after.location_lng_approx ?? null,
        field_id: after.field_id || null,
        field_name: after.field_name || null,
        visibility: after.visibility,
        rules: after.rules || "",
        recurrence: recurrence,
        recurrence_parent_id: parentId,
        // Propaga config de limite da série para a próxima ocorrência (spec #2398).
        recurrence_index: nextIndex,
        recurrence_count: recurrenceCount,
        recurrence_end_date: recurrenceEndDate,
        recurrence_cancelled: false,
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
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      if (after.group_id) {
        newGame.group_id = after.group_id;
        newGame.group_name = after.group_name || null;
      }

      if (after.stream_url) {
        newGame.stream_url = after.stream_url;
      }

      const targetNextGameId =
        hasPendingFollowUp ?
          after.next_game_id as string :
          `recurring_${parentId}_${nextIndex}`;
      const newGameRef = db
        .collection("games")
        .doc(targetNextGameId);

      const transactionResult = await db.runTransaction(async (tx) => {
        const currentSnap = await tx.get(event.data!.after.ref);
        const currentNextGameCreated =
          currentSnap.get("next_game_created") === true;
        const currentNextGameId =
          currentSnap.get("next_game_id") as string | undefined;
        const currentConfirmationsCreated =
          currentSnap.get("next_game_confirmations_created") === true;

        if (currentNextGameCreated) {
          return {
            createdNewGame: false,
            shouldProvisionParticipants: !currentConfirmationsCreated,
            nextGameId: currentNextGameId || newGameRef.id,
          };
        }

        const existingChildSnap = await tx.get(newGameRef);
        if (!existingChildSnap.exists) {
          tx.set(newGameRef, newGame);
        }

        tx.update(event.data!.after.ref, {
          next_game_created: true,
          next_game_id: newGameRef.id,
          next_game_confirmations_created: false,
          updated_at: FieldValue.serverTimestamp(),
        });

        return {
          createdNewGame: !existingChildSnap.exists,
          shouldProvisionParticipants: true,
          nextGameId: newGameRef.id,
        };
      });

      if (!transactionResult.shouldProvisionParticipants) {
        logger.info(
          `[RECURRENCE] ${gameId} já criou próximo jogo ${newGameRef.id}, skip.`
        );
        return;
      }

      if (transactionResult.createdNewGame) {
        logger.info(
          `[RECURRENCE] Created recurring game ${newGameRef.id} from ${gameId}` +
          ` (${recurrence}, date ${nextDate}, child ${childCount + 1}/52)`
        );
      } else {
        logger.info(
          `[RECURRENCE] Retrying participant provisioning for ${newGameRef.id}`
        );
      }

      if (after.group_id) {
        try {
          const ownerId = after.owner_id as string;
          const invites =
            await fetchActiveRecurringMemberInvites(
              db,
              after.group_id as string,
              ownerId
            );

          let batch = db.batch();
          let batchOps = 0;
          const commitBatch = async () => {
            if (batchOps === 0) return;
            await batch.commit();
            batch = db.batch();
            batchOps = 0;
          };
          const queueConfirmation = async (
            userId: string,
            userName: string,
            status: "CONFIRMED" | "PENDING"
          ) => {
            batch.set(
              db.collection("confirmations").doc(`${newGameRef.id}_${userId}`),
              {
                game_id: newGameRef.id,
                user_id: userId,
                user_name: userName,
                status,
                position: "FIELD",
                is_casual_player: false,
                created_at: FieldValue.serverTimestamp(),
              }
            );
            batchOps++;
            if (batchOps >= MAX_CONFIRMATION_WRITES_PER_BATCH) {
              await commitBatch();
            }
          };

          await queueConfirmation(
            ownerId,
            (after.owner_name as string) || "Organizador",
            "CONFIRMED"
          );

          for (const invite of invites) {
            await queueConfirmation(invite.memberId, invite.userName, "PENDING");
          }

          await commitBatch();
          await event.data!.after.ref.update({
            next_game_confirmations_created: true,
            updated_at: FieldValue.serverTimestamp(),
          });
          logger.info(
            `[RECURRENCE] Auto-invited ${invites.length + 1} active members ` +
            `for recurring game ${newGameRef.id}`
          );

          const memberIds = invites.map((invite) => invite.memberId);
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
          throw err;
        }
      }
    } catch (err) {
      logger.error(`[RECURRENCE] Failed to create recurrence for ${gameId}:`, err);
      throw err;
    }
  }
);
