/* eslint-disable require-jsdoc */
import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import {
  FUNCTION_REGION,
  FIRESTORE_PAGINATION_LIMIT,
} from "./constants";
import {
  GAMIFICATION_NUDGES,
} from "./notifications/notification-messages";
import {
  NotificationType,
  sendAndSaveNotification,
} from "./notifications/helpers";
import {
  claimNotificationEventOnce,
  releaseNotificationEvent,
} from "./notifications/dedup";
import {LEVELS} from "./xp/pipeline";
import {db} from "./_db";

type AlmostBadgeHint = {
  badgeName: string;
  remaining: number;
  unit: string;
};

const MAX_LEVEL_DISTANCE_XP = 100;
const BADGE_PROGRESS_THRESHOLD = 0.8;
const BRT_TIMEZONE = "America/Sao_Paulo";
const GAME_QUERY_BATCH_SIZE = 5;
const ACTIVE_GAME_STATUSES = ["SCHEDULED", "CONFIRMED"] as const;

// FIX #4058: cooldown mínimo por (userId, tipo) — cobre o caso em que o valor
// oscila 1 XP e burlaria a camada de "mudou?". 7 dias.
const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
// FIX #4058: após N nudges consecutivos não lidos do mesmo tipo, suspende.
const NUDGE_MAX_CONSECUTIVE_UNREAD = 3;
// FIX #4058: doc de estado por (userId, tipo) com last_sent_at + last_value.
const NUDGE_STATE_COLLECTION = "gamification_nudge_state";

// #3875: teto de memberships lidos por usuário. Cobre o número realista de
// grupos por jogador; combinado com orderBy(documentId()) torna o subconjunto
// determinístico (antes o limit(20) sem orderBy devolvia grupos arbitrários e
// podia descartar o grupo ativo relevante). Mantemos o filtro status=="ACTIVE"
// em memória de propósito: aplicá-lo na query exigiria um índice composto.
const MEMBERSHIP_QUERY_LIMIT = 100;
// #3875: teto de jogos futuros lidos por grupo — evita leitura ilimitada dentro
// de um cron que roda para a base inteira.
const UPCOMING_GAMES_LIMIT = 50;
// #3875: concorrência controlada ao processar os usuários de uma página.
const USER_CONCURRENCY = 10;
// #3875: orçamento de tempo por execução. Ao atingir, persistimos o cursor e
// encerramos de forma limpa; a execução seguinte retoma de onde parou. Fica
// abaixo do timeoutSeconds (180s) para dar folga à persistência final.
const TIME_BUDGET_MS = 150_000;
// #3875: doc de estado que guarda o último usuário processado (cursor
// persistido entre execuções). Sem isso a cauda da base nunca era coberta,
// porque o cursor local reiniciava a cada run e a varredura recomeçava do zero.
const CURSOR_STATE_COLLECTION = "system_state";
const CURSOR_STATE_DOC = "gamification_nudges_cursor";
// #3901: teto de idade do cursor persistido. Acima disso, a retomada é
// descartada e a varredura reinicia do começo — evita retomar de um ponto que
// já não reflete a base de forma útil após uma janela longa sem execução
// (cron pausado por deploy quebrado, quota, etc.).
const CURSOR_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const BADGE_HINTS = [
  {
    badgeName: "Goleador",
    unit: "gols",
    field: "totalGoals",
    thresholds: [10, 25, 50, 100, 250],
  },
  {
    badgeName: "Garçom",
    unit: "assistências",
    field: "totalAssists",
    thresholds: [10, 25, 50, 100],
  },
  {
    badgeName: "Muralha",
    unit: "defesas",
    field: "totalSaves",
    thresholds: [25, 50, 100, 250],
  },
  {
    badgeName: "Vencedor",
    unit: "vitórias",
    field: "gamesWon",
    thresholds: [10, 25, 50, 100],
  },
] as const;

function notificationDocId(
  type: string,
  userId: string,
): string {
  // FIX #4058: a chave NÃO pode conter a data. Com `_${todayKey()}`, a claim de
  // dedup era sempre nova a cada dia → reenvio idêntico para sempre. Chave
  // estável garante um único doc de notificação por (tipo, usuário) e a política
  // de reenvio fica em `sendNudgeIfDue` (mudança de valor OU cooldown).
  return `gamification_nudge_${type}_${userId}`;
}

/**
 * Converte um valor possivelmente Timestamp (Firestore) em epoch millis.
 * @param {unknown} value Valor a converter.
 * @return {number} Millis ou 0.
 */
function timestampMillis(value: unknown): number {
  if (value && typeof value === "object") {
    const v = value as {toMillis?: () => number; toDate?: () => Date};
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.toDate === "function") return v.toDate().getTime();
  }
  return 0;
}

/**
 * FIX #4058: decide se um nudge deve ser (re)enviado e envia se devido.
 *
 * Política: envia se o valor mudou desde o último envio OU se o cooldown
 * expirou; suspende o tipo após N não lidos consecutivos. O estado vive em
 * `gamification_nudge_state/{type}_{userId}`.
 *
 * @param {string} type Tipo do nudge.
 * @param {string} userId UID alvo.
 * @param {string | number} value Valor que motivou o nudge.
 * @param {Function} buildPayload Factory do payload de notificação.
 * @return {Promise<void>}
 */
async function sendNudgeIfDue(
  type: string,
  userId: string,
  value: string | number,
  buildPayload: () => Parameters<typeof sendAndSaveNotification>[1],
): Promise<void> {
  const docId = notificationDocId(type, userId);
  const stateRef = db()
    .collection(NUDGE_STATE_COLLECTION)
    .doc(`${type}_${userId}`);
  const stateSnap = await stateRef.get();
  const state = stateSnap.exists ? (stateSnap.data() ?? {}) : {};
  const now = Date.now();
  const lastSentAt = timestampMillis(state.last_sent_at);
  const valueChanged = state.last_value !== value;
  const cooldownElapsed = now - lastSentAt >= NUDGE_COOLDOWN_MS;

  if (!valueChanged && !cooldownElapsed) return;

  // Supressão por não-engajamento: conta nudges consecutivos não lidos.
  const prevNotification = await db()
    .collection("notifications")
    .doc(docId)
    .get();
  const previousUnread = prevNotification.exists &&
    prevNotification.data()?.read === false;
  const consecutiveUnread = previousUnread ?
    (typeof state.consecutive_unread === "number" ?
      state.consecutive_unread : 0) + 1 :
    0;

  if (consecutiveUnread >= NUDGE_MAX_CONSECUTIVE_UNREAD) {
    logger.info(
      "[GAMIFICATION_NUDGES] nudge suprimido após " +
      `${consecutiveUnread} não lidos consecutivos`,
      {type, userId},
    );
    return;
  }

  await sendGamificationNotificationOnce(userId, buildPayload(), docId);

  await stateRef.set({
    last_sent_at: Timestamp.fromDate(new Date(now)),
    last_value: value,
    consecutive_unread: consecutiveUnread,
  }, {merge: true});
}

function getAlmostLevelHint(
  currentXp: number,
): {xpLeft: number; levelName: string} | null {
  const nextLevel = LEVELS.find((level) => level.xpRequired > currentXp);
  if (!nextLevel) return null;
  const xpLeft = nextLevel.xpRequired - currentXp;
  if (xpLeft >= MAX_LEVEL_DISTANCE_XP) return null;
  return {
    xpLeft,
    levelName: nextLevel.name,
  };
}

function getAlmostBadgeHint(
  stats: Record<string, unknown>,
): AlmostBadgeHint | null {
  for (const hint of BADGE_HINTS) {
    const current = Number(stats[hint.field] ?? 0);
    if (!Number.isFinite(current)) continue;
    const nextThreshold = hint.thresholds.find((threshold) => threshold > current);
    if (!nextThreshold) continue;
    if (current / nextThreshold < BADGE_PROGRESS_THRESHOLD) continue;
    return {
      badgeName: hint.badgeName,
      remaining: nextThreshold - current,
      unit: hint.unit,
    };
  }
  return null;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function sendGamificationNotificationOnce(
  userId: string,
  payload: Parameters<typeof sendAndSaveNotification>[1],
  docId: string,
): Promise<void> {
  const claimed = await claimNotificationEventOnce(docId);
  if (!claimed) return;

  try {
    await sendAndSaveNotification(userId, payload, docId);
  } catch (error) {
    await releaseNotificationEvent(docId);
    throw error;
  }

  // FIX #4058: chave estável (sem data) faz a dedup "completed" bloquear para
  // sempre. Liberamos a claim após o sucesso para permitir reenvio futuro
  // (decidido por sendNudgeIfDue). A claim só existe para evitar corrida
  // concorrente no mesmo run.
  await releaseNotificationEvent(docId);
}

async function maybeSendAlmostLevel(
  userId: string,
  userData: Record<string, unknown>,
): Promise<void> {
  const currentXp = Number(userData.experience_points ?? 0);
  if (!Number.isFinite(currentXp)) return;
  const hint = getAlmostLevelHint(currentXp);
  if (!hint) return;

  await sendNudgeIfDue("almost_level", userId, hint.xpLeft, () => ({
    userId,
    title: GAMIFICATION_NUDGES.ALMOST_LEVEL.title["pt-BR"](),
    body: GAMIFICATION_NUDGES.ALMOST_LEVEL.body["pt-BR"]({
      xpLeft: String(hint.xpLeft),
      levelName: hint.levelName,
    }),
    type: NotificationType.ACHIEVEMENT,
    action: "achievements",
  }));
}

async function maybeSendAlmostBadge(
  userId: string,
  statsData: Record<string, unknown>,
): Promise<void> {
  const hint = getAlmostBadgeHint(statsData);
  if (!hint) return;

  await sendNudgeIfDue(
    "almost_badge",
    userId,
    `${hint.badgeName}:${hint.remaining}`,
    () => ({
      userId,
      title: GAMIFICATION_NUDGES.ALMOST_BADGE.title["pt-BR"](),
      body: GAMIFICATION_NUDGES.ALMOST_BADGE.body["pt-BR"]({
        remaining: String(hint.remaining),
        unit: hint.unit,
        badgeName: hint.badgeName,
      }),
      type: NotificationType.ACHIEVEMENT,
      action: "badges",
    }),
  );
}

async function findUpcomingOpenGameForUser(
  userId: string,
): Promise<string | null> {
  // #3875: orderBy(documentId()) torna o subconjunto lido determinístico
  // (servido pelo índice single-field automático que a query anterior já
  // usava implicitamente) e o cap sobe para MEMBERSHIP_QUERY_LIMIT. Antes, o
  // limit(20) sem orderBy devolvia memberships arbitrários e podia descartar o
  // grupo ativo relevante, fazendo o nudge de "streak em risco" nunca sair.
  const memberships = await db()
    .collectionGroup("members")
    .where("user_id", "==", userId)
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(MEMBERSHIP_QUERY_LIMIT)
    .get();

  const groupIds = Array.from(new Set(
    memberships.docs.flatMap((membership) => {
      const data = membership.data() ?? {};
      if (data.status !== "ACTIVE") return [];
      const groupId = membership.ref.parent.parent?.id;
      return groupId ? [groupId] : [];
    }),
  ));

  if (groupIds.length === 0) return null;

  const nowTs = Timestamp.fromDate(new Date());
  // FIX #4150: o nudge só faz sentido se CONFIRMAR a presença ainda salva
  // a sequência — a janela que mantém é de 8 dias (pelada semanal + 1).
  // Jogo aberto a 3+ dias com a regra antiga era promessa sem efeito.
  const STREAK_KEEP_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
  const windowEndTs = Timestamp.fromDate(
    new Date(Date.now() + STREAK_KEEP_WINDOW_MS)
  );

  for (const groupBatch of chunk(groupIds, GAME_QUERY_BATCH_SIZE)) {
    const batchResults = await Promise.all(
      groupBatch.map(async (groupId) => {
        const gamesSnap = await db()
          .collection("games")
          .where("group_id", "==", groupId)
          .where("status", "in", ACTIVE_GAME_STATUSES)
          .where("dateTime", ">", nowTs)
          .where("dateTime", "<=", windowEndTs)
          .orderBy("dateTime", "asc")
          // #3875: limita leitura de jogos futuros por grupo. Já vamos parar no
          // primeiro jogo aberto não confirmado; ler tudo era amplificação de
          // leitura desnecessária num cron que roda para a base inteira.
          .limit(UPCOMING_GAMES_LIMIT)
          .get();

        if (gamesSnap.empty) return null;

        const confirmationSnaps = await Promise.all(
          gamesSnap.docs.map((gameDoc) =>
            db()
              .collection("confirmations")
              .doc(`${gameDoc.id}_${userId}`)
              .get(),
          ),
        );

        for (let index = 0; index < gamesSnap.docs.length; index++) {
          const confirmationStatus =
            confirmationSnaps[index].data()?.status;
          if (confirmationStatus !== "CONFIRMED") {
            return gamesSnap.docs[index].id;
          }
        }

        return null;
      }),
    );

    const foundGameId = batchResults.find((gameId) => gameId !== null);
    if (foundGameId) return foundGameId;
  }

  return null;
}

async function maybeSendStreakAtRisk(
  userId: string,
  streak: number,
): Promise<void> {
  if (streak < 3) return;
  const gameId = await findUpcomingOpenGameForUser(userId);
  if (!gameId) return;

  await sendNudgeIfDue("streak_at_risk", userId, streak, () => ({
    userId,
    title: GAMIFICATION_NUDGES.STREAK_AT_RISK.title["pt-BR"](),
    body: GAMIFICATION_NUDGES.STREAK_AT_RISK.body["pt-BR"]({
      streak: String(streak),
    }),
    type: NotificationType.ACHIEVEMENT,
    gameId,
    action: "games",
  }));
}

// #3875: processa um único usuário — nível, badge e streak. Toda a leitura e
// envio de um usuário fica aqui para que o laço principal possa isolar a falha
// dele sem abortar a varredura inteira.
async function processUser(
  userDoc: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<void> {
  const userId = userDoc.id;
  const userData = userDoc.data() ?? {};
  await maybeSendAlmostLevel(userId, userData);

  const statsSnap = await db()
    .collection("statistics")
    .doc(userId)
    .get();
  if (statsSnap.exists) {
    await maybeSendAlmostBadge(userId, statsSnap.data() ?? {});
  }

  const streakSnap = await db()
    .collection("user_streaks")
    .doc(userId)
    .get();
  if (streakSnap.exists) {
    const streak = Number(streakSnap.data()?.current_streak ?? 0);
    if (Number.isFinite(streak)) {
      await maybeSendStreakAtRisk(userId, streak);
    }
  }
}

// #3875: executa `worker` sobre `items` com concorrência limitada. Cada tarefa
// resolve independentemente (Promise.allSettled): a rejeição de uma não aborta
// o lote. O worker já isola o erro por usuário, então aqui só garantimos que o
// throughput não fique estritamente sequencial.
async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  for (let start = 0; start < items.length; start += concurrency) {
    const batch = items.slice(start, start + concurrency);
    await Promise.allSettled(batch.map((item) => worker(item)));
  }
}

type RunOptions = {
  pageLimit?: number;
  timeBudgetMs?: number;
  concurrency?: number;
  now?: () => number;
};

// #3875: varredura da base com cursor PERSISTIDO + orçamento de tempo +
// isolamento de erro por usuário.
//
// - Cursor persistido em `system_state/gamification_nudges_cursor`: ao esgotar
//   o orçamento de tempo, salvamos o último usuário processado e encerramos; a
//   execução seguinte retoma dali em vez de recomeçar do início. Assim, a cauda
//   da base — que antes nunca era alcançada dentro dos 180s — passa a ser
//   coberta ao longo de execuções sucessivas.
// - Ao concluir a varredura (página final), o doc de estado é apagado para que
//   o próximo dia comece do zero.
// - Falha de um usuário é logada e ignorada (não aborta o run). Falhas de query
//   de página ou de persistência de cursor propagam de propósito.
//
// Exportada para testes (retomada e orçamento). O handler agendado usa os
// padrões de produção.
export async function runGamificationNudges(
  options: RunOptions = {},
): Promise<void> {
  const pageLimit = options.pageLimit ?? FIRESTORE_PAGINATION_LIMIT;
  const timeBudgetMs = options.timeBudgetMs ?? TIME_BUDGET_MS;
  const concurrency = options.concurrency ?? USER_CONCURRENCY;
  const now = options.now ?? Date.now;
  const startedAt = now();

  const stateRef = db()
    .collection(CURSOR_STATE_COLLECTION)
    .doc(CURSOR_STATE_DOC);

  // #3901: retoma do cursor persistido (se houver e não estiver obsoleto).
  // Passamos a REFERÊNCIA do doc ao startAfter em vez de reler o snapshot:
  // com orderBy(documentId()) a referência já é um valor de cursor válido,
  // existindo o doc ou não — o usuário pode ter sido excluído de verdade
  // (onUserDeleted em account-cleanup.ts faz delete() real, não soft-delete)
  // entre a execução que persistiu o cursor e esta. Descartar o cursor nesse
  // caso reiniciava a varredura do zero e reintroduzia a inanição da cauda
  // que #3875 resolveu. Isso também elimina o get() extra que a versão
  // anterior fazia só para confirmar existência.
  let cursor:
    FirebaseFirestore.QueryDocumentSnapshot |
    FirebaseFirestore.DocumentReference |
    null = null;
  const stateSnap = await stateRef.get();
  const stateData = stateSnap.data();
  const lastUserId = stateData?.last_user_id;
  const persistedAt = stateData?.updated_at as
    FirebaseFirestore.Timestamp | undefined;
  const cursorAgeMs = persistedAt ?
    now() - persistedAt.toDate().getTime() :
    null;

  if (typeof lastUserId === "string" && lastUserId.length > 0) {
    if (cursorAgeMs !== null && cursorAgeMs > CURSOR_MAX_AGE_MS) {
      // Único caso em que a retomada é descartada: cursor obsoleto (D2 da
      // spec). Ausência do doc do usuário deixou de ser motivo de descarte.
      logger.warn(
        "[GAMIFICATION_NUDGES] cursor persistido excede 48h; " +
          "descartando e reiniciando varredura do início",
        {lastUserId, cursorAgeMs},
      );
    } else {
      cursor = db().collection("users").doc(lastUserId);
    }
  }

  while (true) {
    let usersQuery = db()
      .collection("users")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageLimit);
    if (cursor) {
      usersQuery = usersQuery.startAfter(cursor);
    }
    const usersSnap = await usersQuery.get();
    if (usersSnap.empty) {
      // Varredura concluída (nada além do cursor): zera o estado.
      await stateRef.delete();
      break;
    }

    // Isola o erro por usuário: uma falha individual é logada e a varredura
    // segue para os próximos usuários.
    await runWithConcurrency(usersSnap.docs, concurrency, async (userDoc) => {
      try {
        await processUser(userDoc);
      } catch (error) {
        logger.error(
          "[GAMIFICATION_NUDGES] falha ao processar usuário; seguindo",
          {userId: userDoc.id, error},
        );
      }
    });

    cursor = usersSnap.docs[usersSnap.docs.length - 1] ?? null;
    const reachedEnd = usersSnap.size < pageLimit;
    if (reachedEnd) {
      // Última página processada: varredura completa, zera o estado.
      await stateRef.delete();
      break;
    }

    // Persiste o cursor ANTES da checagem de orçamento, para que uma parada por
    // tempo já deixe o ponto de retomada gravado.
    await stateRef.set({
      last_user_id: cursor?.id ?? null,
      updated_at: Timestamp.fromDate(new Date(now())),
    });

    if (now() - startedAt >= timeBudgetMs) {
      logger.info(
        "[GAMIFICATION_NUDGES] orçamento de tempo atingido; " +
          "cursor persistido para retomada",
        {lastUserId: cursor?.id ?? null},
      );
      return;
    }
  }

  logger.info("[GAMIFICATION_NUDGES] daily run complete");
}

export const sendGamificationNudgesDaily = onSchedule(
  {
    region: FUNCTION_REGION,
    schedule: "0 10 * * *",
    timeZone: BRT_TIMEZONE,
    memory: "512MiB",
    timeoutSeconds: 180,
  },
  async () => {
    await runGamificationNudges();
  },
);
