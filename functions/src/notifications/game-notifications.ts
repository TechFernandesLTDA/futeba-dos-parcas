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
  onDocumentDeleted,
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
import {
  claimNotificationEventOnce,
  completeNotificationEvent,
  releaseNotificationEvent,
} from "./dedup";

const CONFIRMATION_PAGE_SIZE = 100;
const GROUP_MEMBER_PAGE_SIZE = 50;
const MAX_GROUP_VACANCY_NOTIFICATIONS = 20;
const VACANCY_NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;
const WAITLIST_RESPONSE_WINDOW_MS = 30 * 60 * 1000;
const ACTIVE_GROUP_MEMBER_STATUS = "ACTIVE";

/**
 * Lê o user_id/userId persistido no documento de membership.
 * @param {Record<string, unknown>} membership
 * @return {string}
 */
function getMembershipUserId(
  membership: Record<string, unknown>
): string {
  if (typeof membership.user_id === "string") {
    return membership.user_id;
  }
  if (typeof membership.userId === "string") {
    return membership.userId;
  }
  return "";
}

/**
 * Aceita apenas memberships ACTIVE cuja identidade bate com o doc id.
 * @param {admin.firestore.QueryDocumentSnapshot} doc
 * @return {boolean}
 */
function isActiveMembershipDoc(
  doc: admin.firestore.QueryDocumentSnapshot
): boolean {
  const membership = doc.data() as Record<string, unknown>;
  return (
    membership.status === ACTIVE_GROUP_MEMBER_STATUS &&
    getMembershipUserId(membership) === doc.id
  );
}

/**
 * Normaliza o valor de dateTime para comparação estável.
 *
 * FIX #4143: `before.dateTime !== after.dateTime` entre Timestamps é SEMPRE
 * true (cada data() desserializa instância nova) — qualquer escrita em
 * games/{id} virava "data/local mudou", com transação extra e push falso.
 *
 * @param {unknown} value Valor bruto (Timestamp, Date ou string).
 * @return {string} Normalização comparável.
 */
function normalizeDateTimeForChangeCheck(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return String(value.toMillis());
  }
  if (value instanceof Date) {
    return String(value.getTime());
  }
  return String(value ?? "");
}

/**
 * Decide se a atualização alterou a data ou local do jogo.
 *
 * @param {Record<string, unknown>} before
 * @param {Record<string, unknown>} after
 * @return {boolean}
 */
function hasGameUpdateNotificationRelevantChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): boolean {
  return (
    before.date !== after.date ||
    normalizeDateTimeForChangeCheck(before.dateTime) !==
      normalizeDateTimeForChangeCheck(after.dateTime) ||
    before.location_id !== after.location_id ||
    before.locationId !== after.locationId
  );
}

/**
 * Gera chave estável do estado notificado de data/local.
 *
 * @param {Record<string, unknown>} game
 * @return {string}
 */
function buildGameUpdateNotificationKey(
  game: Record<string, unknown>
): string {
  const locationId =
    (game.location_id as string | undefined) ||
    (game.locationId as string | undefined) ||
    "";
  const date = String(game.date || "");
  const dateTime = game.dateTime &&
    typeof game.dateTime === "object" &&
    "toMillis" in game.dateTime &&
    typeof game.dateTime.toMillis === "function" ?
    String(game.dateTime.toMillis()) :
    "";

  return `${locationId}|${date}|${dateTime}`;
}

/**
 * Busca IDs de usuários confirmados para um jogo de forma paginada.
 * @param {string} gameId
 * @return {Promise<string[]>}
 */
export async function fetchConfirmedUserIdsForGame(
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
export async function countConfirmedPlayersForGame(
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
export async function fetchEligibleGroupMemberIdsForVacancy(
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
      .where("status", "==", ACTIVE_GROUP_MEMBER_STATUS)
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
      if (!isActiveMembershipDoc(doc)) {
        continue;
      }

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
    if (!await claimNotificationEventOnce(`game_created:${event.id}`)) {
      return;
    }

    const gameId = event.params.gameId;
    const ownerId = game.owner_id;

    // Idempotência: verificar se já foi enviada
    if (game.invite_notification_sent === true) {
      logger.info(
        "[GAME_CREATED] Notification for" +
        ` game ${gameId} already sent,` +
        " skipping (idempotent)."
      );
      await completeNotificationEvent(`game_created:${event.id}`);
      return;
    }

    if (game.group_id) {
      try {
        const membersSnap = await db()
          .collection("groups")
          .doc(game.group_id)
          .collection("members")
          .where("status", "==", ACTIVE_GROUP_MEMBER_STATUS)
          .where(
            "role",
            "in",
            ["MEMBER", "ADMIN", "OWNER"]
          )
          .get();

        type DocSnap =
          admin.firestore.QueryDocumentSnapshot;
        const memberIds = membersSnap.docs
          .filter((doc: DocSnap) => isActiveMembershipDoc(doc))
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
        await releaseNotificationEvent(`game_created:${event.id}`);
        throw e;
      }
    }
    await completeNotificationEvent(`game_created:${event.id}`);
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
      if (!await claimNotificationEventOnce(`game_updated:${event.id}`)) {
        return;
      }

      const gameId = event.params.gameId;
      let confirmedUserIds:
        string[] |
        null = null;

      if (
        before.status !== "CANCELLED" &&
        after.status === "CANCELLED"
      ) {
        // FIX #4135: cancelamentos pelo SISTEMA têm push próprio — o texto
        // "cancelado pelo organizador" é falso e, no baixo quórum, gerava
        // DOIS pushes contraditórios para as mesmas pessoas.
        const systemCancellation =
          after.auto_closed === true ||
          after.cancelled_by === "system" ||
          after.auto_cancelled === true;

        try {
          const userIds =
            confirmedUserIds ??
            await fetchConfirmedUserIdsForGame(
              gameId
            );
          confirmedUserIds = userIds;

          if (
            userIds.length > 0 &&
            !systemCancellation
          ) {
            const gameGroupId =
              typeof after.group_id === "string" ?
                after.group_id :
                undefined;
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
              },
              gameGroupId
            );
          }
        } catch (e) {
          logger.error(
            "Erro ao notificar cancelamento:",
            e
          );
          await releaseNotificationEvent(`game_updated:${event.id}`);
          throw e;
        }
      }

      if (
        hasGameUpdateNotificationRelevantChange(before, after)
      ) {
        try {
          const updateKey = buildGameUpdateNotificationKey(after);
          const gameRef =
            event.data?.after.ref ||
            db().collection("games").doc(gameId);

          const shouldNotifyUpdate =
            await db().runTransaction(async (tx) => {
              const freshSnap =
                await tx.get(gameRef);
              const freshData = freshSnap.data() as
                Record<string, unknown> |
                undefined;
              if (!freshData) {
                return false;
              }

              // Skip stale deliveries if the game has already moved
              // to another date/location state since this event.
              if (
                buildGameUpdateNotificationKey(freshData) !==
                updateKey
              ) {
                return false;
              }

              if (
                freshData.last_game_update_notification_key ===
                updateKey
              ) {
                return false;
              }

              tx.update(gameRef, {
                last_game_update_notification_key:
                  updateKey,
                last_game_update_notification_at:
                  FieldValue.serverTimestamp(),
              });
              return true;
            });

          if (!shouldNotifyUpdate) {
            await completeNotificationEvent(`game_updated:${event.id}`);
            return;
          }

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
          await releaseNotificationEvent(`game_updated:${event.id}`);
          throw e;
        }
      }
      await completeNotificationEvent(`game_updated:${event.id}`);
    }
  );

// ==========================================
// GAME VACANCY
// ==========================================


/**
 * Núcleo de promoção de vaga (FIX #4144), compartilhado por:
 * - onGameVacancy (trigger UPDATE: before CONFIRMED -> after CANCELLED);
 * - onGameVacancyDeleted (trigger DELETE de confirmação CONFIRMED — caminho
 *   que clientes ainda usam: fila offline, remoção de membro via cliente
 *   sem branch de rules, etc).
 *
 * Cooldown de 5 min passa a valer SOMENTE para o broadcast ao grupo:
 * cada vaga aberta promove UMA pessoa nova da waitlist (promovee diferente
 * a cada evento, sem risco de spam), e o antigo gate que engolia a 2ª
 * vaga dentro de 5 min foi removido.
 *
 * @param {string} gameId - Id do jogo com vaga aberta.
 * @return {Promise<void>} -
 */
export async function promoteWaitlistOnVacancy(
  gameId: string
): Promise<void> {
  const gameRef = db()
    .collection("games")
    .doc(gameId);

  try {
    const gameDoc = await gameRef.get();
    const game = gameDoc.data() as
      Record<string, unknown> |
      undefined;
    if (!game) {
      return;
    }

    if (
      game.status !== "SCHEDULED" &&
      game.status !== "CONFIRMED"
    ) {
      return;
    }

    const maxPlayers =
      typeof game.max_players === "number" ?
        game.max_players :
        typeof game.maxPlayers === "number" ?
          game.maxPlayers :
          14;
    const groupId =
      typeof game.group_id === "string" ?
        game.group_id :
        typeof game.groupId === "string" ?
          game.groupId :
          undefined;
    const gameName =
      typeof game.location_name === "string" ?
        game.location_name :
        typeof game.field_name === "string" ?
          game.field_name :
          "o jogo";
    const gameDate =
      typeof game.date === "string" ?
        game.date :
        "";

    // Contar confirmações atuais
    const currentPlayers =
      await countConfirmedPlayersForGame(
        gameId
      );

    // Só promove se há vaga real após cancelamento (FIX #1582).
    if (currentPlayers >= maxPlayers) {
      return;
    }

    // 1. Promover a próxima entrada WAITING e notificá-la — SEM cooldown.
    // FIX #753: ordem autoritativa é queue_position (FIX #4043: promote a
    // NOTIFIED com response_deadline = now + 30min).
    const waitlistSnap = await db()
      .collection("games")
      .doc(gameId)
      .collection("waitlist")
      .where("status", "==", "WAITING")
      .orderBy("queue_position", "asc")
      .limit(3)
      .get();

    const waitingUserIds =
      waitlistSnap.docs
        .map((doc: admin.firestore.QueryDocumentSnapshot) => {
          const data = doc.data();
          return data.user_id || data.userId;
        })
        .filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.length > 0
        );

    if (!waitlistSnap.empty) {
      const entry = waitlistSnap.docs[0];
      const entryData = entry.data();
      const nextUserId =
        entryData.user_id || entryData.userId;
      const newDeadline =
        admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + WAITLIST_RESPONSE_WINDOW_MS)
        );

      const promoted = await db().runTransaction(async (tx) => {
        const fresh = await tx.get(entry.ref);
        if (!fresh.exists || fresh.data()?.status !== "WAITING") {
          return false;
        }
        tx.update(entry.ref, {
          status: "NOTIFIED",
          notified_at: FieldValue.serverTimestamp(),
          response_deadline: newDeadline,
        });
        return true;
      });

      if (promoted && typeof nextUserId === "string" && nextUserId) {
        await sendNotificationToUsers(
          [nextUserId],
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
          "[GAME_VACANCY] Promovido e notificado " +
          `${nextUserId} na waitlist`
        );
      }
    }

    // 2. Se poucos na espera, notificar grupo — isolado em try/catch
    // próprio (FIX #4043). FIX #4144: o broadcast (muitas pessoas de uma
    // vez) continua com cooldown de 5 min via claim vacancy_notified_at;
    // a promoção individual acima nunca mais é travada por ele.
    if (
      groupId &&
      waitingUserIds.length < 3
    ) {
      try {
        const broadcastClaim =
          await db().runTransaction(async (tx) => {
            const freshDoc = await tx.get(gameRef);
            if (!freshDoc.exists) {
              return false;
            }
            const freshGame = freshDoc.data() as
              Record<string, unknown> |
              undefined;
            if (
              !freshGame ||
              (freshGame.status !== "SCHEDULED" &&
                freshGame.status !== "CONFIRMED")
            ) {
              return false;
            }

            const freshNotifiedAt =
              freshGame.vacancy_notified_at &&
              typeof freshGame.vacancy_notified_at === "object" &&
              "toDate" in freshGame.vacancy_notified_at &&
              typeof freshGame.vacancy_notified_at.toDate === "function" ?
                freshGame.vacancy_notified_at.toDate() as Date :
                null;

            if (
              freshNotifiedAt &&
              (Date.now() - freshNotifiedAt.getTime()) <
                VACANCY_NOTIFICATION_COOLDOWN_MS
            ) {
              return false;
            }

            tx.update(gameRef, {
              vacancy_notified_at:
                FieldValue.serverTimestamp(),
            });
            return true;
          });

        if (!broadcastClaim) {
          logger.info(
            "[GAME_VACANCY] Broadcast ao grupo em cooldown para " +
            `${gameId}.`
          );
          return;
        }

        const confirmedUserIds =
          await fetchConfirmedUserIdsForGame(
            gameId
          );
        const excludedUserIds =
          new Set<string>([
            ...confirmedUserIds,
            ...waitingUserIds,
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
      } catch (groupNotifyError) {
        logger.error(
          "[GAME_VACANCY] Erro ao notificar" +
          " grupo sobre vaga:",
          groupNotifyError
        );
      }
    }
  } catch (e) {
    logger.error(
      "[GAME_VACANCY] Erro ao" +
      " processar vaga:",
      e
    );
    throw e;
  }
}

/**
 * Trigger quando um jogador cancela presença e
 * abre vaga (update CONFIRMED -> CANCELLED).
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
    if (!await claimNotificationEventOnce(`game_vacancy:${event.id}`)) {
      return;
    }

    logger.info(
      "[GAME_VACANCY] Vaga aberta no" +
      ` jogo ${gameId}` +
      ` (confirmacao ${confirmationId})`
    );

    try {
      await promoteWaitlistOnVacancy(gameId);
    } catch (e) {
      await releaseNotificationEvent(`game_vacancy:${event.id}`);
      throw e;
    }
    await completeNotificationEvent(`game_vacancy:${event.id}`);
  }
);

/**
 * FIX #4144: trigger DELETE de confirmação. Clientes que ainda apagam a
 * confirmação (fila offline do web, remoção de membro por caminhos sem
 * branch de rules, apps desatualizados) não passam pelo onGameVacancy
 * (que exige before/after) — a vaga ficava sem promover a waitlist em
 * silêncio. Este trigger cobre o mesmo fluxo no delete.
 */
export const onGameVacancyDeleted = onDocumentDeleted(
  {document: "confirmations/{confirmationId}", region: FUNCTION_REGION},
  async (event) => {
    const deleted = event.data?.data();
    if (!deleted) return;

    // Só havia vaga real se a confirmação apagada era CONFIRMED.
    if (deleted.status !== "CONFIRMED") return;

    const gameId =
      deleted.game_id || deleted.gameId;
    if (!gameId) return;

    const claimed =
      await claimNotificationEventOnce(
        `game_vacancy_del:${event.id}`
      );
    if (!claimed) return;

    const confirmationId =
      event.params.confirmationId;
    logger.info(
      "[GAME_VACANCY] Vaga aberta por DELETE de" +
      ` confirmacao ${confirmationId}` +
      ` no jogo ${gameId}`
    );

    try {
      await promoteWaitlistOnVacancy(gameId);
    } catch (e) {
      await releaseNotificationEvent(`game_vacancy_del:${event.id}`);
      throw e;
    }
    await completeNotificationEvent(`game_vacancy_del:${event.id}`);
  }
);
