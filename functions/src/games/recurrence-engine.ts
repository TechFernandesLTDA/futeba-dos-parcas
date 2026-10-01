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
import {NotificationType} from "../notifications/helpers";
import {
  RecurrenceType,
  getNextDate,
  recurrenceStopReason,
} from "./recurrence-limits";

const ACTIVE_MEMBER_STATUS = "ACTIVE";
const MAX_CONFIRMATION_WRITES_PER_BATCH = 450;
const RECURRING_MEMBERS_PAGE_SIZE = 100;
const USER_PROFILE_READ_BATCH_SIZE = 100;
const GENERIC_MEMBER_NAME = "membro";
const UNKNOWN_PLAYER_NAME = "Jogador";

export interface RecurringMemberInvite {
  memberId: string;
  userName: string;
}

/**
 * Retorna um nome de perfil utilizável sem propagar placeholders legados.
 *
 * @param {admin.firestore.DocumentData | undefined} data - Perfil do usuário.
 * @return {string | null} Nome normalizado ou null.
 */
function profileName(
  data: admin.firestore.DocumentData | undefined
): string | null {
  if (!data) return null;
  for (const value of [
    data.display_name,
    data.displayName,
    data.name,
    data.nickname,
  ]) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Indica se o nome precisa ser resolvido no perfil canônico do usuário.
 *
 * @param {string} value - Nome denormalizado no membro/confirmation.
 * @return {boolean} True para vazio ou placeholder "Membro".
 */
function needsProfileName(value: string): boolean {
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  return normalized.length === 0 || normalized === GENERIC_MEMBER_NAME;
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
    userName: profileName(memberData) || "",
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
 * Hidrata nomes ausentes/genéricos diretamente de `users/{uid}`.
 *
 * @param {admin.firestore.Firestore} db - Instância do Firestore.
 * @param {RecurringMemberInvite[]} invites - Participantes a normalizar.
 * @return {Promise<RecurringMemberInvite[]>} Participantes com nomes seguros.
 */
export async function hydrateRecurringMemberNames(
  db: admin.firestore.Firestore,
  invites: RecurringMemberInvite[]
): Promise<RecurringMemberInvite[]> {
  const unresolvedIds = Array.from(new Set(
    invites
      .filter((invite) => needsProfileName(invite.userName))
      .map((invite) => invite.memberId)
  ));
  if (unresolvedIds.length === 0) return invites;

  const resolvedNames = new Map<string, string>();
  for (const idChunk of chunkArray(
    unresolvedIds,
    USER_PROFILE_READ_BATCH_SIZE
  )) {
    const refs = idChunk.map((memberId) =>
      db.collection("users").doc(memberId)
    );
    const snapshots = await db.getAll(...refs);
    snapshots.forEach((snapshot) => {
      const resolved = snapshot.exists ? profileName(snapshot.data()) : null;
      if (resolved && !needsProfileName(resolved)) {
        resolvedNames.set(snapshot.id, resolved);
      }
    });
  }

  return invites.map((invite) => {
    if (!needsProfileName(invite.userName)) return invite;
    return {
      ...invite,
      userName: resolvedNames.get(invite.memberId) || UNKNOWN_PLAYER_NAME,
    };
  });
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

  return hydrateRecurringMemberNames(db, invites);
}

interface RecurrenceWork {
  action: "provision";
  sourceGameId: string;
  parentId: string;
  nextGameId: string;
  nextIndex: number;
  nextDate: string;
  recurrence: RecurrenceType;
  ownerId: string;
  ownerName: string;
  groupId: string | null;
  sourceDate: string;
  time: string;
  locationName: string;
  createdNewGame: boolean;
  confirmationsCreated: boolean;
  notificationEnqueued: boolean;
}

interface RecurringChildExpectation {
  parentId: string;
  ownerId: string;
  nextIndex: number;
  groupId: string | null;
}

type RecurrenceTransactionResult =
  RecurrenceWork |
  {action: "skip" | "stopped"};

/**
 * Normaliza string opcional vinda do Firestore.
 * @param {unknown} value - Valor persistido.
 * @return {string | null} String válida ou null.
 */
function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Normaliza o índice 1-based da ocorrência atual.
 * @param {unknown} value - Valor persistido.
 * @return {number} Índice positivo ou 1 para documentos legados.
 */
function currentRecurrenceIndex(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 ? value : 1;
}

/**
 * Converte apenas recorrências suportadas pelo motor.
 * @param {unknown} value - Recorrência persistida.
 * @return {RecurrenceType | null} Recorrência válida ou null.
 */
function recurrenceType(value: unknown): RecurrenceType | null {
  if (value === "weekly" || value === "biweekly" || value === "monthly") {
    return value;
  }
  return null;
}

// FIX #4147: strip compartilhado que preserva FieldValue/Timestamp/GeoPoint
// (a cópia local destrava sentinelas — ver utils/strip-undefined.ts).
import {stripUndefinedValues} from "../utils/strip-undefined";

/**
 * Classifica erros permanentes de invariantes/dados para evitar retry infinito.
 *
 * @param {unknown} error Erro capturado.
 * @return {boolean} true quando o erro não deve ser reprocessado.
 */
function isNonRetryableRecurrenceError(error: unknown): boolean {
  return error instanceof Error &&
    error.message.startsWith("[RECURRENCE]");
}

/**
 * Indica se ainda há etapa durável pendente para um filho já marcado.
 * @param {admin.firestore.DocumentData} game - Jogo atual.
 * @return {boolean} True quando confirmações/outbox ainda não terminaram.
 */
function hasIncompleteFollowUp(
  game: admin.firestore.DocumentData
): boolean {
  if (optionalString(game.recurrence_stop_reason)) return false;
  return game.next_game_created === true && (
    typeof game.next_game_id !== "string" ||
    game.next_game_confirmations_created !== true ||
    game.next_game_notification_enqueued !== true
  );
}

/**
 * Gera o payload do filho usando somente o snapshot autoritativo atual.
 * @param {string} sourceGameId - ID do jogo finalizado (para diagnóstico).
 * @param {admin.firestore.DocumentData} current - Jogo atual.
 * @param {string} parentId - ID raiz da série.
 * @param {number} nextIndex - Índice do filho.
 * @param {string} nextDate - Data do filho.
 * @param {RecurrenceType} recurrence - Tipo de recorrência.
 * @return {Record<string, unknown>} Payload do novo jogo.
 */
function buildRecurringGame(
  sourceGameId: string,
  current: admin.firestore.DocumentData,
  parentId: string,
  nextIndex: number,
  nextDate: string,
  recurrence: RecurrenceType
): Record<string, unknown> {
  const time = optionalString(current.time) || "00:00";
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!timeMatch) {
    throw new Error(`[RECURRENCE] time inválido em ${sourceGameId}: ${time}`);
  }
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  if (hours > 23 || minutes > 59) {
    throw new Error(`[RECURRENCE] time inválido em ${sourceGameId}: ${time}`);
  }
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const dateTime = Timestamp.fromDate(
    new Date(`${nextDate}T${pad2(hours)}:${pad2(minutes)}:00-03:00`)
  );
  const recurrenceCount =
    typeof current.recurrence_count === "number" ?
      current.recurrence_count : null;
  const recurrenceEndDate = optionalString(current.recurrence_end_date);

  const child: Record<string, unknown> = {
    dateTime,
    owner_id: current.owner_id,
    owner_name: current.owner_name,
    status: "SCHEDULED",
    date: nextDate,
    time,
    end_time: current.end_time || null,
    duration_minutes: current.duration_minutes || null,
    field_type: current.field_type,
    game_type: current.game_type,
    max_players: current.max_players,
    max_goalkeepers: current.max_goalkeepers,
    number_of_teams: current.number_of_teams,
    daily_price: current.daily_price,
    total_cost: current.total_cost,
    price_manual_override: current.price_manual_override === true,
    pix_payment_enabled: current.pix_payment_enabled || false,
    pix_key: current.pix_key || null,
    pix_key_type: current.pix_key_type || null,
    pix_beneficiary_name: current.pix_beneficiary_name || null,
    location_id: current.location_id || null,
    location_name: current.location_name,
    location_address: current.location_address,
    location_lat: current.location_lat ?? null,
    location_lng: current.location_lng ?? null,
    location_lat_approx: current.location_lat_approx ?? null,
    location_lng_approx: current.location_lng_approx ?? null,
    field_id: current.field_id || null,
    field_name: current.field_name || null,
    visibility: current.visibility,
    gender: current.gender ?? null,
    name: current.name || null,
    rules: current.rules || "",
    recurrence,
    recurrence_parent_id: parentId,
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
    co_organizers: Array.isArray(current.co_organizers) ? current.co_organizers : [],
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const groupId = optionalString(current.group_id);
  if (groupId) {
    child.group_id = groupId;
    child.group_name = current.group_name || null;
  }
  if (optionalString(current.stream_url)) {
    child.stream_url = current.stream_url;
  }
  return stripUndefinedValues(child);
}

/**
 * Impede que um documento pré-criado com ID determinístico seja adotado.
 * @param {admin.firestore.DocumentSnapshot} childSnap - Filho encontrado.
 * @param {RecurringChildExpectation} expected - Identidade esperada.
 * @return {void}
 */
function assertCompatibleChild(
  childSnap: admin.firestore.DocumentSnapshot,
  expected: RecurringChildExpectation
): void {
  if (!childSnap.exists) return;
  const child = childSnap.data() || {};
  const actualGroupId = optionalString(child.group_id);
  if (
    child.recurrence_parent_id !== expected.parentId ||
    child.owner_id !== expected.ownerId ||
    child.recurrence_index !== expected.nextIndex ||
    child.status !== "SCHEDULED" ||
    actualGroupId !== expected.groupId
  ) {
    throw new Error(
      `[RECURRENCE] Filho determinístico incompatível: ${childSnap.id}`
    );
  }
}

/**
 * Revalida que o jogo atual ainda representa o trabalho calculado.
 * @param {admin.firestore.DocumentSnapshot} currentSnap - Snapshot atual.
 * @param {RecurrenceWork} work - Trabalho derivado anteriormente.
 * @return {void}
 */
function assertCurrentWork(
  currentSnap: admin.firestore.DocumentSnapshot,
  work: RecurrenceWork
): void {
  const current = currentSnap.data();
  if (!current) {
    throw new Error(`[RECURRENCE] Jogo ${work.sourceGameId} removido`);
  }
  const parentId =
    optionalString(current.recurrence_parent_id) || work.sourceGameId;
  if (
    current.status !== "FINISHED" ||
    recurrenceType(current.recurrence) !== work.recurrence ||
    parentId !== work.parentId ||
    currentRecurrenceIndex(current.recurrence_index) + 1 !== work.nextIndex ||
    optionalString(current.owner_id) !== work.ownerId ||
    optionalString(current.group_id) !== work.groupId ||
    optionalString(current.date) !== work.sourceDate ||
    current.next_game_created !== true ||
    current.next_game_id !== work.nextGameId
  ) {
    throw new Error(
      `[RECURRENCE] Estado de ${work.sourceGameId} mudou durante o processamento`
    );
  }
}

/**
 * Marca confirmações concluídas somente após revalidar pai e filho.
 * @param {admin.firestore.Firestore} db - Instância do Firestore.
 * @param {admin.firestore.DocumentReference} currentRef - Jogo atual.
 * @param {RecurrenceWork} work - Trabalho autoritativo.
 * @return {Promise<void>}
 */
async function markConfirmationsCreated(
  db: admin.firestore.Firestore,
  currentRef: admin.firestore.DocumentReference,
  work: RecurrenceWork
): Promise<void> {
  const childRef = db.collection("games").doc(work.nextGameId);
  await db.runTransaction(async (tx) => {
    const currentSnap = await tx.get(currentRef);
    const childSnap = await tx.get(childRef);
    assertCurrentWork(currentSnap, work);
    if (!childSnap.exists) {
      throw new Error(
        `[RECURRENCE] Filho ${work.nextGameId} removido antes das confirmações`
      );
    }
    assertCompatibleChild(childSnap, {
      parentId: work.parentId,
      ownerId: work.ownerId,
      nextIndex: work.nextIndex,
      groupId: work.groupId,
    });
    if (currentSnap.get("next_game_confirmations_created") === true) return;
    tx.update(currentRef, {
      next_game_confirmations_created: true,
      updated_at: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Persiste uma notificação determinística e seu marker na mesma transação.
 * @param {admin.firestore.Firestore} db - Instância do Firestore.
 * @param {admin.firestore.DocumentReference} currentRef - Jogo atual.
 * @param {RecurrenceWork} work - Trabalho autoritativo.
 * @param {string[]} memberIds - Destinatários ativos.
 * @return {Promise<void>}
 */
async function enqueueRecurringNotification(
  db: admin.firestore.Firestore,
  currentRef: admin.firestore.DocumentReference,
  work: RecurrenceWork,
  memberIds: string[]
): Promise<void> {
  const childRef = db.collection("games").doc(work.nextGameId);
  const outboxRef = db.collection("notification_queue")
    .doc(`recurrence_${work.nextGameId}`);
  const uniqueMemberIds = [...new Set(memberIds)].sort();

  await db.runTransaction(async (tx) => {
    const currentSnap = await tx.get(currentRef);
    const childSnap = await tx.get(childRef);
    const outboxSnap = await tx.get(outboxRef);
    assertCurrentWork(currentSnap, work);
    if (!childSnap.exists) {
      throw new Error(
        `[RECURRENCE] Filho ${work.nextGameId} removido antes da notificação`
      );
    }
    assertCompatibleChild(childSnap, {
      parentId: work.parentId,
      ownerId: work.ownerId,
      nextIndex: work.nextIndex,
      groupId: work.groupId,
    });
    if (currentSnap.get("next_game_notification_enqueued") === true) return;

    if (uniqueMemberIds.length > 0) {
      if (outboxSnap.exists) {
        const queued = outboxSnap.data() || {};
        const queuedData = queued.data || {};
        if (
          queued.source !== "RECURRENCE_ENGINE" ||
          queued.sourceGameId !== work.sourceGameId ||
          queuedData.gameId !== work.nextGameId
        ) {
          throw new Error(
            `[RECURRENCE] Outbox determinístico incompatível: ${outboxRef.id}`
          );
        }
      } else {
        const [year, month, day] = work.nextDate.split("-");
        const dateLabel = `${day}/${month}/${year} às ${work.time}`;
        const recurrenceLabel = work.recurrence === "weekly" ?
          "semanal" : work.recurrence === "biweekly" ?
            "quinzenal" : "mensal";
        const data: Record<string, string> = {gameId: work.nextGameId};
        if (work.groupId) data.groupId = work.groupId;
        tx.set(outboxRef, {
          userIds: uniqueMemberIds,
          title:
            `🔄 Jogo recorrente (${recurrenceLabel}): ${work.locationName}`,
          body:
            `Novo jogo ${recurrenceLabel} marcado! ${dateLabel}. ` +
            "Confirme presença.",
          type: NotificationType.GAME_INVITE,
          data,
          status: "PENDING",
          priority: "HIGH",
          source: "RECURRENCE_ENGINE",
          sourceGameId: work.sourceGameId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    tx.update(currentRef, {
      next_game_notification_enqueued: true,
      next_game_notification_outbox_id:
        uniqueMemberIds.length > 0 ? outboxRef.id : null,
      updated_at: FieldValue.serverTimestamp(),
    });
  });
}

export const onGameFinishedCreateRecurrence = onDocumentUpdated(
  {document: "games/{gameId}", region: FUNCTION_REGION, retry: true},
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || after.status !== "FINISHED") return;

    const gameId = event.params.gameId;
    if (
      before?.status === "FINISHED" &&
      !hasIncompleteFollowUp(after)
    ) {
      return;
    }

    const db = admin.firestore();
    const currentRef = event.data!.after.ref;

    try {
      const transactionResult: RecurrenceTransactionResult =
        await db.runTransaction(async (tx) => {
          const currentSnap = await tx.get(currentRef);
          const current = currentSnap.data();
          if (!current || current.status !== "FINISHED") {
            return {action: "skip" as const};
          }

          const recurrence = recurrenceType(current.recurrence);
          if (!recurrence) return {action: "skip" as const};
          const currentNextGameCreated = current.next_game_created === true;
          if (
            currentNextGameCreated &&
            !hasIncompleteFollowUp(current)
          ) {
            return {action: "skip" as const};
          }

          const ownerId = optionalString(current.owner_id);
          const sourceDate = optionalString(current.date);
          if (!ownerId || !sourceDate) {
            throw new Error(
              `[RECURRENCE] Jogo ${gameId} sem owner_id/date válidos`
            );
          }
          const parentId =
            optionalString(current.recurrence_parent_id) || gameId;
          const currentIndex = currentRecurrenceIndex(
            current.recurrence_index
          );
          const nextIndex = currentIndex + 1;
          const deterministicChildId = `recurring_${parentId}_${nextIndex}`;
          const currentNextGameId = optionalString(current.next_game_id);
          if (
            currentNextGameCreated &&
            currentNextGameId !== deterministicChildId
          ) {
            throw new Error(
              `[RECURRENCE] next_game_id incompatível em ${gameId}`
            );
          }

          const nextDate = getNextDate(sourceDate, recurrence);
          let childCount = Math.max(0, currentIndex - 1);
          if (!currentNextGameCreated) {
            const childQuery = db.collection("games")
              .where("recurrence_parent_id", "==", parentId);
            const childrenSnap = await tx.get(childQuery);
            childCount = childrenSnap.size;
            const recurrenceCount =
              typeof current.recurrence_count === "number" ?
                current.recurrence_count : null;
            const stop = recurrenceStopReason({
              currentIndex,
              childCount,
              recurrenceCount,
              recurrenceEndDate:
                optionalString(current.recurrence_end_date),
              nextDate,
            });
            if (stop) {
              tx.update(currentRef, {
                next_game_created: true,
                next_game_confirmations_created: true,
                next_game_notification_enqueued: true,
                recurrence_stop_reason: stop,
                updated_at: FieldValue.serverTimestamp(),
              });
              logger.info(
                `[RECURRENCE] Série ${parentId} encerrada (motivo=${stop}) ` +
                `no índice ${currentIndex}; próxima data seria ${nextDate}.`
              );
              return {action: "stopped" as const};
            }
          }

          const childRef = db.collection("games").doc(deterministicChildId);
          const childSnap = await tx.get(childRef);
          const groupId = optionalString(current.group_id);
          assertCompatibleChild(childSnap, {
            parentId,
            ownerId,
            nextIndex,
            groupId,
          });
          if (!childSnap.exists) {
            tx.set(childRef, buildRecurringGame(
              gameId,
              current,
              parentId,
              nextIndex,
              nextDate,
              recurrence
            ));
          }

          if (!currentNextGameCreated) {
            tx.update(currentRef, {
              next_game_created: true,
              next_game_id: deterministicChildId,
              next_game_confirmations_created: false,
              next_game_notification_enqueued: false,
              updated_at: FieldValue.serverTimestamp(),
            });
          } else if (!childSnap.exists) {
            tx.update(currentRef, {
              next_game_confirmations_created: false,
              next_game_notification_enqueued: false,
              updated_at: FieldValue.serverTimestamp(),
            });
          }

          return {
            action: "provision" as const,
            sourceGameId: gameId,
            parentId,
            nextGameId: deterministicChildId,
            nextIndex,
            nextDate,
            recurrence,
            ownerId,
            ownerName: optionalString(current.owner_name) || "Organizador",
            groupId,
            sourceDate,
            time: optionalString(current.time) || "00:00",
            locationName: optionalString(current.location_name) || "Local",
            createdNewGame: !childSnap.exists,
            confirmationsCreated:
              childSnap.exists &&
              current.next_game_confirmations_created === true,
            notificationEnqueued:
              childSnap.exists &&
              current.next_game_notification_enqueued === true,
          };
        });

      if (transactionResult.action !== "provision") return;
      const work = transactionResult;
      if (work.createdNewGame) {
        logger.info(
          `[RECURRENCE] Created recurring game ${work.nextGameId} ` +
          `from ${gameId} (${work.recurrence}, date ${work.nextDate})`
        );
      }

      let invites: RecurringMemberInvite[] = [];
      if (work.groupId) {
        invites = await fetchActiveRecurringMemberInvites(
          db,
          work.groupId,
          work.ownerId
        );
      }

      if (!work.confirmationsCreated && work.groupId) {
        const [owner] = await hydrateRecurringMemberNames(db, [{
          memberId: work.ownerId,
          userName: work.ownerName,
        }]);
        const participants = [
          {
            userId: work.ownerId,
            userName: owner.userName,
            status: "CONFIRMED" as const,
          },
          ...invites.map((invite) => ({
            userId: invite.memberId,
            userName: invite.userName,
            status: "PENDING" as const,
          })),
        ];

        for (const participantChunk of chunkArray(
          participants,
          MAX_CONFIRMATION_WRITES_PER_BATCH
        )) {
          await db.runTransaction(async (tx) => {
            const refs = participantChunk.map(({userId}) =>
              db.collection("confirmations")
                .doc(`${work.nextGameId}_${userId}`)
            );
            const snapshots = await Promise.all(
              refs.map((ref) => tx.get(ref))
            );
            snapshots.forEach((snapshot, index) => {
              if (snapshot.exists) return;
              const participant = participantChunk[index];
              tx.set(refs[index], {
                game_id: work.nextGameId,
                user_id: participant.userId,
                user_name: participant.userName,
                status: participant.status,
                position: "FIELD",
                is_casual_player: false,
                created_at: FieldValue.serverTimestamp(),
              });
            });
          });
        }
      }

      await markConfirmationsCreated(db, currentRef, work);
      if (work.groupId && !work.confirmationsCreated) {
        logger.info(
          `[RECURRENCE] Auto-invited ${invites.length + 1} active members ` +
          `for recurring game ${work.nextGameId}`
        );
      }

      if (!work.notificationEnqueued) {
        await enqueueRecurringNotification(
          db,
          currentRef,
          work,
          invites.map((invite) => invite.memberId)
        );
      }
    } catch (err) {
      logger.error(
        `[RECURRENCE] Failed to create/provision recurrence for ${gameId}:`,
        err
      );
      if (isNonRetryableRecurrenceError(err)) {
        logger.info(
          "[RECURRENCE] Suppressing retry for non-retryable recurrence " +
          `error on ${gameId}`
        );
        return;
      }
      throw err;
    }
  }
);
