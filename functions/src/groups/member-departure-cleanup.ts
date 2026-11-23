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
  /** Backfill: itens de jogo aberto ao público deixados de lado. */
  publicSkipped: number;
}

export interface DepartureCleanupOptions {
  /**
   * Só conta o que seria feito, sem escrever nada (nem a claim da
   * promoção). Usado pelo dry-run do backfill.
   */
  dryRun?: boolean;
  /**
   * Backfill de quem saiu antes do trigger existir. Em jogo aberto ao
   * público, quem saiu pode entrar de novo como avulso, e isso não deve ser
   * desfeito: só entra o que foi criado até `departedAt`, que é o que o
   * trigger teria visto no momento da saída. Sem a data, nada de jogo
   * público entra. O trigger não passa esta opção.
   */
  backfill?: {departedAt: Date | null};
}

/**
 * Mesmo critério das callables joinPublicGame e joinGameWaitlist para jogo
 * que aceita quem não é do grupo.
 *
 * @param {Record<string, unknown>} game dados do jogo
 * @return {boolean} se o jogo aceita participantes de fora do grupo
 */
function isOpenToPublic(game: Record<string, unknown>): boolean {
  return game.visibility === "PUBLIC_OPEN" ||
    (game.is_public === true && !game.visibility);
}

/**
 * Converte Timestamp, Date, número ou texto em milissegundos.
 *
 * @param {unknown} value valor de data do Firestore
 * @return {number | null} milissegundos, ou null se não houver data
 */
export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const maybe = value as {toMillis?: () => number; toDate?: () => Date};
  if (typeof maybe.toMillis === "function") return maybe.toMillis();
  if (typeof maybe.toDate === "function") return maybe.toDate().getTime();
  return null;
}

/**
 * Tira a pessoa dos jogos futuros do grupo. Idempotente: cada escrita
 * relê o documento e só age se ele ainda está no estado de antes.
 *
 * @param {string} groupId grupo de onde a pessoa saiu
 * @param {string} userId quem saiu
 * @param {string} eventId CloudEvent id, para a promoção da fila não repetir
 * @param {DepartureCleanupOptions} options dry-run e corte do backfill
 * @return {Promise<DepartureCleanupResult>} contadores do que foi feito
 */
export async function cleanupDepartedMemberGames(
  groupId: string,
  userId: string,
  eventId: string,
  options: DepartureCleanupOptions = {},
): Promise<DepartureCleanupResult> {
  const firestore = db();
  const dryRun = options.dryRun === true;
  const result: DepartureCleanupResult = {
    games: 0,
    confirmationsCancelled: 0,
    waitlistRemoved: 0,
    promotions: 0,
    publicSkipped: 0,
  };

  // No backfill, item de jogo público só entra se for anterior à saída.
  const cutoffMs = options.backfill ?
    toMillis(options.backfill.departedAt) :
    null;
  const keepsPublicItem = (
    game: Record<string, unknown>,
    createdAt: unknown,
  ): boolean => {
    if (!options.backfill || !isOpenToPublic(game)) return true;
    const createdMs = toMillis(createdAt);
    if (cutoffMs === null || createdMs === null) return false;
    return createdMs <= cutoffMs;
  };

  const gamesSnap = await firestore
    .collection("games")
    .where("group_id", "==", groupId)
    .where("status", "in", ACTIVE_GAME_STATUSES)
    .get();
  const games = gamesSnap.docs
    .map((gameDoc) => ({
      id: gameDoc.id,
      data: gameDoc.data() as Record<string, unknown>,
    }))
    .filter(({data}) => !data.deleted_at && !data.deletedAt);
  result.games = games.length;

  for (const {id: gameId, data: game} of games) {
    const confirmationsSnap = await firestore
      .collection("confirmations")
      .where("game_id", "==", gameId)
      .where("user_id", "==", userId)
      .get();
    for (const confirmation of confirmationsSnap.docs) {
      const current = confirmation.data() as Record<string, unknown>;
      if (!CANCELLABLE_CONFIRMATION_STATUSES.has(String(current.status))) {
        continue;
      }
      if (!keepsPublicItem(game, current.created_at)) {
        result.publicSkipped += 1;
        continue;
      }
      if (dryRun) {
        result.confirmationsCancelled += 1;
        continue;
      }
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
    const waitlistSnap = await waitlistRef.get();
    const waitlistData = waitlistSnap.exists ?
      (waitlistSnap.data() as Record<string, unknown>) :
      undefined;
    const waitlistStatus = waitlistData ? String(waitlistData.status) : null;
    if (!waitlistStatus || !WAITLIST_ACTIVE_STATUSES.has(waitlistStatus)) {
      continue;
    }
    if (!keepsPublicItem(game, waitlistData?.added_at)) {
      result.publicSkipped += 1;
      continue;
    }
    if (dryRun) {
      if (waitlistStatus === "NOTIFIED") result.promotions += 1;
      result.waitlistRemoved += 1;
      continue;
    }

    // Quem foi chamado (NOTIFIED) segurava a vaga até o prazo. Sem a
    // entrada, a varredura de prazo vencido não acha ninguém, então a vaga
    // passa para o próximo da fila ANTES de apagar a entrada: se a
    // promoção falhar, a entrada continua NOTIFIED e a nova entrega do
    // evento tenta de novo. A claim evita promover duas pessoas.
    if (waitlistStatus === "NOTIFIED") {
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

    const removed = await firestore.runTransaction(async (tx) => {
      const fresh = await tx.get(waitlistRef);
      const status = fresh.exists ? String(fresh.data()?.status) : null;
      if (!status || !WAITLIST_ACTIVE_STATUSES.has(status)) return false;
      tx.delete(waitlistRef);
      return true;
    });
    if (removed) result.waitlistRemoved += 1;
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
