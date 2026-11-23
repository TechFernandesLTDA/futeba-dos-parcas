/**
 * #4629: quem sai ou é removido do grupo deixa de ocupar os jogos futuros
 * do grupo.
 *
 * Antes, só o web limpava, e só as confirmações CONFIRMED: as regras deixam
 * o admin do grupo passar apenas CONFIRMED -> CANCELLED. Confirmações
 * PENDING e WAITLIST e as entradas da fila de espera continuavam no jogo, e
 * o Android e o iOS não limpavam nada.
 *
 * Este trigger roda quando o vínculo deixa de ser ativo (ACTIVE para
 * INACTIVE, REMOVED, BLOCKED ou BANNED, ou o documento é apagado) e, nos
 * jogos SCHEDULED e CONFIRMED do grupo:
 *  - passa para CANCELLED as confirmações CONFIRMED, PENDING e WAITLIST da
 *    pessoa. A passagem de CONFIRMED abre a vaga pelos triggers de sempre
 *    (onConfirmationWrite desconta, onGameVacancy promove a fila);
 *  - apaga a entrada dela na fila de espera (WAITING ou NOTIFIED), como a
 *    própria pessoa faz ao sair da fila. Se ela tinha sido chamada
 *    (NOTIFIED), a vaga oferecida passa para o próximo da fila.
 *
 * O merge de contas também desativa o vínculo do alias, mas move as
 * confirmações para a conta canônica; esse caso (merged_to_uid) fica de fora.
 */

import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isActiveMember} from "./member-counter";
import {
  claimNotificationEventOnce,
  completeNotificationEvent,
  releaseNotificationEvent,
} from "../notifications/dedup";
import {promoteWaitlistOnVacancy} from "../notifications/game-notifications";

const ACTIVE_GAME_STATUSES = ["SCHEDULED", "CONFIRMED"];
const CANCELLABLE_CONFIRMATION_STATUSES = new Set([
  "CONFIRMED",
  "PENDING",
  "WAITLIST",
]);
const WAITLIST_ACTIVE_STATUSES = new Set(["WAITING", "NOTIFIED"]);

export interface DepartureCleanupResult {
  games: number;
  confirmationsCancelled: number;
  waitlistRemoved: number;
  promotions: number;
}

/**
 * Tira a pessoa dos jogos futuros do grupo. Idempotente: cada escrita
 * relê o documento e só age se ele ainda está no estado de antes.
 *
 * @param {string} groupId grupo de onde a pessoa saiu
 * @param {string} userId quem saiu
 * @param {string} eventId CloudEvent id, para a promoção da fila não repetir
 * @return {Promise<DepartureCleanupResult>} contadores do que foi feito
 */
export async function cleanupDepartedMemberGames(
  groupId: string,
  userId: string,
  eventId: string,
): Promise<DepartureCleanupResult> {
  const firestore = db();
  const result: DepartureCleanupResult = {
    games: 0,
    confirmationsCancelled: 0,
    waitlistRemoved: 0,
    promotions: 0,
  };

  const gamesSnap = await firestore
    .collection("games")
    .where("group_id", "==", groupId)
    .where("status", "in", ACTIVE_GAME_STATUSES)
    .get();
  const gameIds = gamesSnap.docs
    .filter((gameDoc) => {
      const game = gameDoc.data() as Record<string, unknown>;
      return !game.deleted_at && !game.deletedAt;
    })
    .map((gameDoc) => gameDoc.id);
  result.games = gameIds.length;

  for (const gameId of gameIds) {
    const confirmationsSnap = await firestore
      .collection("confirmations")
      .where("game_id", "==", gameId)
      .where("user_id", "==", userId)
      .get();
    for (const confirmation of confirmationsSnap.docs) {
      const cancelled = await firestore.runTransaction(async (tx) => {
        const fresh = await tx.get(confirmation.ref);
        const status = fresh.exists ? fresh.data()?.status : undefined;
        if (!CANCELLABLE_CONFIRMATION_STATUSES.has(String(status))) {
          return false;
        }
        tx.update(confirmation.ref, {
          status: "CANCELLED",
          updated_at: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (cancelled) result.confirmationsCancelled += 1;
    }

    const waitlistRef = firestore.doc(`games/${gameId}/waitlist/${userId}`);
    const removedStatus = await firestore.runTransaction(async (tx) => {
      const fresh = await tx.get(waitlistRef);
      const status = fresh.exists ? String(fresh.data()?.status) : null;
      if (!status || !WAITLIST_ACTIVE_STATUSES.has(status)) return null;
      tx.delete(waitlistRef);
      return status;
    });
    if (removedStatus) result.waitlistRemoved += 1;

    // Quem foi chamado (NOTIFIED) segurava a vaga até o prazo. Sem a
    // entrada, a varredura de prazo vencido não acha ninguém, então a vaga
    // passa agora para o próximo da fila. A claim evita promover duas
    // pessoas se o evento for entregue de novo.
    if (removedStatus === "NOTIFIED") {
      const claimId = `member_departed:${eventId}:${gameId}`;
      if (await claimNotificationEventOnce(claimId)) {
        try {
          await promoteWaitlistOnVacancy(gameId);
        } catch (error) {
          await releaseNotificationEvent(claimId);
          throw error;
        }
        await completeNotificationEvent(claimId);
        result.promotions += 1;
      }
    }
  }

  return result;
}

export const onMemberDepartedCleanupGames = onDocumentWritten(
  {
    document: "groups/{groupId}/members/{memberId}",
    region: FUNCTION_REGION,
    retry: true,
  },
  async (event) => {
    const before = event.data?.before?.data() as
      Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as
      Record<string, unknown> | undefined;
    if (!isActiveMember(before) || isActiveMember(after)) return;
    // Merge de contas: as confirmações vão para a conta canônica.
    if (typeof after?.merged_to_uid === "string" && after.merged_to_uid) {
      return;
    }

    const {groupId, memberId} = event.params;
    const eventId = event.id;
    if (!eventId) {
      const error = new Error("Member departure event is missing CloudEvent id");
      logger.error("[MEMBER_DEPARTED] evento inválido", {
        groupId,
        memberId,
        error: error.message,
      });
      throw error;
    }

    const result = await cleanupDepartedMemberGames(groupId, memberId, eventId);
    logger.info("[MEMBER_DEPARTED] jogos futuros limpos", {
      groupId,
      memberId,
      nextStatus: after?.status ?? "DELETED",
      ...result,
    });
  }
);
