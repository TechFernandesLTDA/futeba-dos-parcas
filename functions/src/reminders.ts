/**
 * SISTEMA DE LEMBRETES DE JOGOS
 * Futeba dos Parcas
 *
 * Notifica jogadores que ainda nao confirmaram
 * presenca:
 * - 24 horas antes do jogo
 * - 2 horas antes do jogo
 *
 * Recursos:
 * - Anti-spam: nao envia o mesmo lembrete 2x
 * - Ignora jogos cancelados ou finalizados
 * - Timezone: America/Sao_Paulo
 */

import {logger} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {
  FUNCTION_REGION,
} from "./constants";
import {
  sendNotificationToUser,
  sendNotificationToUsers,
  NotificationType,
  saveNotificationToFirestore,
} from "./notifications";
import {
  REMINDER_NOTIFICATIONS,
  GAME_NOTIFICATIONS,
} from "./notifications/notification-messages";
import {
  getNotificationSettings,
  isMuted,
  isGroupMuted,
} from "./notifications/preferences";

import {db} from "./_db";

// ==========================================
// CONSTANTES
// ==========================================

// Janelas de tempo para lembretes (ms)
const REMINDER_24H_MS = 24 * 60 * 60 * 1000;
const REMINDER_2H_MS = 2 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Tolerancia para a janela de busca (min)
// Rodando a cada hora, precisamos de uma
// janela de 30 min antes/depois
const WINDOW_TOLERANCE_MS = 30 * 60 * 1000;

// Status de jogos que NAO devem receber
// lembretes
export const EXCLUDED_GAME_STATUSES = [
  "CANCELLED",
  "FINISHED",
  "LIVE",
];

// Status de confirmacao que ja esta OK
// (nao precisa lembrete)
export const CONFIRMED_STATUSES = ["CONFIRMED"];

// Status de confirmacao que devem ser pulados
// (ja confirmou ou ja recusou/cancelou)
export const REMINDER_SKIP_STATUSES = [
  "CONFIRMED",
  "DECLINED",
  "CANCELLED",
] as const;

// ==========================================
// INTERFACES
// ==========================================

export interface GameForReminder {
  id: string;
  dateTime: admin.firestore.Timestamp | null;
  date: string | null;
  time: string | null;
  status: string;
  group_id: string | null;
  location_name?: string;
}

interface ConfirmationForReminder {
  id: string;
  user_id: string;
  game_id: string;
  status: string;
  reminder_24h_sent?: boolean;
  reminder_2h_sent?: boolean;
  reminder_1h_sent?: boolean;
}

// ==========================================
// FUNCOES AUXILIARES
// ==========================================

/**
 * Converte data do jogo para Date (UTC).
 *
 * Priority 1: dateTime Timestamp (ja e UTC,
 *   retorna direto sem conversao).
 * Priority 2: date + time strings (BRT),
 *   converte para UTC corretamente.
 *
 * @param {GameForReminder} game - Jogo.
 * @return {Date | null} Data convertida (UTC).
 */
export function getGameDateTime(
  game: GameForReminder
): Date | null {
  if (
    game.dateTime &&
    typeof game.dateTime.toDate === "function"
  ) {
    return game.dateTime.toDate();
  }

  if (game.date) {
    const dateStr = game.date;
    const timeStr = game.time || "20:00";

    const [year, month, day] =
      dateStr.split("-").map(Number);
    const [hour, minute] =
      timeStr.split(":").map(Number);

    if (year && month && day) {
      // Constrói como data BRT (America/Sao_Paulo
      // = UTC-3) e converte para UTC sem double-shift
      const brtDate = new Date(
        year,
        month - 1,
        day,
        hour || 20,
        minute || 0,
        0
      );
      const utcMs =
        brtDate.getTime() + 3 * 60 * 60 * 1000;
      return new Date(utcMs);
    }
  }

  return null;
}

/**
 * Formata a data/hora do jogo para exibicao
 * na notificacao.
 *
 * @param {Date} date - Data do jogo.
 * @return {string} Data formatada.
 */
export function formatGameDateTime(
  date: Date
): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  };

  try {
    return date.toLocaleString("pt-BR", options);
  } catch {
    return date.toISOString();
  }
}

/**
 * Busca jogos que estao na janela de lembrete.
 *
 * @param {number} hoursBeforeGame - Horas antes
 *   do jogo (24, 2 ou 1).
 * @return {Promise<GameForReminder[]>} Jogos
 *   na janela.
 */
async function fetchGamesInReminderWindow(
  hoursBeforeGame: number
): Promise<GameForReminder[]> {
  const now = new Date();
  const reminderTimeMs = hoursBeforeGame === 24 ?
    REMINDER_24H_MS :
    hoursBeforeGame === 2 ?
      REMINDER_2H_MS :
      hoursBeforeGame * ONE_HOUR_MS;

  // Calcular janela de busca
  // Se o jogo e as 20:00 e queremos lembrar
  // 24h antes, buscamos jogos onde:
  // (gameTime - 24h) esta proximo de "agora"
  // Ou seja: gameTime esta proximo
  // de (agora + 24h)
  const targetTime = new Date(
    now.getTime() + reminderTimeMs
  );
  const windowStart = new Date(
    targetTime.getTime() - WINDOW_TOLERANCE_MS
  );
  const windowEnd = new Date(
    targetTime.getTime() + WINDOW_TOLERANCE_MS
  );

  const hoursLabel = hoursBeforeGame;
  logger.info(
    "[REMINDERS] Buscando jogos na " +
    `janela de ${hoursLabel}h:`
  );
  logger.info(
    `  - Agora: ${now.toISOString()}`
  );
  logger.info(
    "  - Janela: " +
    `${windowStart.toISOString()} ate ` +
    `${windowEnd.toISOString()}`
  );

  // Query: jogos com dateTime na janela e
  // status nao excluido
  // Nota: Firestore nao suporta NOT IN,
  // entao filtramos depois
  const startTs =
    admin.firestore.Timestamp.fromDate(
      windowStart
    );
  const endTs =
    admin.firestore.Timestamp.fromDate(
      windowEnd
    );
  const gamesSnap = await db()
    .collection("games")
    .where("dateTime", ">=", startTs)
    .where("dateTime", "<=", endTs)
    .get();

  const games: GameForReminder[] = [];

  for (const doc of gamesSnap.docs) {
    const data = doc.data();
    const status = data.status || "SCHEDULED";

    // Filtrar status excluidos
    if (
      EXCLUDED_GAME_STATUSES.includes(status)
    ) {
      logger.info(
        `  - Jogo ${doc.id} ignorado` +
        ` (status: ${status})`
      );
      continue;
    }

    games.push({
      id: doc.id,
      dateTime: data.dateTime || null,
      date: data.date || null,
      time: data.time || null,
      status: status,
      group_id: data.group_id || null,
      location_name:
        data.location_name ||
        data.locationName ||
        null,
    });
  }

  // B3: Buscar jogos sem dateTime com fallback
  // para created_at. Jogos criados antes da
  // migracao podem nao ter o campo dateTime.
  try {
    const noDateTimeSnap = await db()
      .collection("games")
      .where("dateTime", "==", null)
      .orderBy("created_at", "desc")
      .limit(50)
      .get();

    for (const doc of noDateTimeSnap.docs) {
      const data = doc.data();
      const status = data.status || "SCHEDULED";

      if (
        EXCLUDED_GAME_STATUSES.includes(status)
      ) {
        continue;
      }

      if (!data.created_at) continue;

      const createdAt =
        typeof data.created_at.toDate === "function" ?
          data.created_at.toDate() :
          null;
      if (!createdAt) continue;

      const createdTarget =
        new Date(
          createdAt.getTime() + reminderTimeMs
        );
      if (
        createdTarget >= windowStart &&
        createdTarget <= windowEnd
      ) {
        games.push({
          id: doc.id,
          dateTime: data.dateTime || null,
          date: data.date || null,
          time: data.time || null,
          status: status,
          group_id: data.group_id || null,
          location_name:
            data.location_name ||
            data.locationName ||
            null,
        });
      }
    }

    if (noDateTimeSnap.size > 0) {
      logger.info(
        "[REMINDERS] " +
        `${noDateTimeSnap.size} jogos sem` +
        " dateTime processados (fallback" +
        " created_at)"
      );
    }
  } catch (e) {
    logger.error(
      "[REMINDERS] Erro ao buscar jogos" +
      " sem dateTime:",
      e
    );
  }

  logger.info(
    `[REMINDERS] Encontrados ${games.length}` +
    " jogos elegiveis para lembrete" +
    ` de ${hoursLabel}h`
  );
  return games;
}

/**
 * Busca confirmacoes de um jogo que NAO estao
 * confirmadas e que ainda nao receberam o
 * lembrete especifico.
 *
 * @param {string} gameId - ID do jogo.
 * @param {string} reminderType - Tipo (24h/2h).
 * @return {Promise<ConfirmationForReminder[]>}
 *   Confirmacoes pendentes.
 */
async function fetchPendingConfirmations(
  gameId: string,
  reminderType: "24h" | "2h" | "1h"
): Promise<ConfirmationForReminder[]> {
  const reminderField =
    reminderType === "24h" ?
      "reminder_24h_sent" :
      reminderType === "2h" ?
        "reminder_2h_sent" :
        "reminder_1h_sent";

  // Buscar todas as confirmacoes do jogo
  const confirmationsSnap = await db()
    .collection("confirmations")
    .where("game_id", "==", gameId)
    .get();

  const pending: ConfirmationForReminder[] = [];

  for (const doc of confirmationsSnap.docs) {
    const data = doc.data();
    const userId = data.user_id || data.userId;
    const status = data.status || "PENDING";

    // Pular se ja confirmou, recusou ou cancelou
    if (REMINDER_SKIP_STATUSES.includes(status)) {
      continue;
    }

    // Pular se lembrete ja foi enviado
    if (data[reminderField] === true) {
      logger.info(
        `  - User ${userId} ja recebeu` +
        ` lembrete ${reminderType}`
      );
      continue;
    }

    pending.push({
      id: doc.id,
      user_id: userId,
      game_id: gameId,
      status: status,
      reminder_24h_sent:
        data.reminder_24h_sent || false,
      reminder_2h_sent:
        data.reminder_2h_sent || false,
    });
  }

  return pending;
}

/**
 * Busca membros do grupo que NAO tem
 * confirmacao no jogo. Para jogos de grupo,
 * queremos notificar todos os membros.
 *
 * @param {string} gameId - ID do jogo.
 * @param {string} groupId - ID do grupo.
 * @param {string} reminderType - Tipo (24h/2h).
 * @return {Promise<string[]>} IDs dos membros
 *   sem confirmacao.
 */
async function fetchGroupMembersWithoutConfirmation(
  gameId: string,
  groupId: string,
  reminderType: "24h" | "2h" | "1h"
): Promise<string[]> {
  const reminderField =
    reminderType === "24h" ?
      "reminder_24h_sent" :
      reminderType === "2h" ?
        "reminder_2h_sent" :
        "reminder_1h_sent";

  const membersSnap = await db()
    .collection("groups")
    .doc(groupId)
    .collection("members")
    .where(
      "role",
      "in",
      ["MEMBER", "ADMIN", "OWNER"]
    )
    .get();

  const memberIds = membersSnap.docs.map(
    (doc) => doc.id
  );

  const confirmationsSnap = await db()
    .collection("confirmations")
    .where("game_id", "==", gameId)
    .get();

  const usersWithConfirmation =
    new Set<string>();
  const usersAlreadyNotified =
    new Set<string>();

  for (const doc of confirmationsSnap.docs) {
    const data = doc.data();
    const userId = data.user_id || data.userId;
    usersWithConfirmation.add(userId);

    if (data[reminderField] === true) {
      usersAlreadyNotified.add(userId);
    }
  }

  // B2: Verificar tambem tracking collection
  // para membros sem confirmacao (evita spam)
  const trackingSnap = await db()
    .collection("reminder_tracking")
    .where("game_id", "==", gameId)
    .where("reminder_type", "==", reminderType)
    .get();

  for (const doc of trackingSnap.docs) {
    const data = doc.data();
    const userId = data.user_id || data.userId;
    usersAlreadyNotified.add(userId);
  }

  const membersWithoutConfirmation =
    memberIds.filter(
      (id) =>
        !usersWithConfirmation.has(id) &&
        !usersAlreadyNotified.has(id)
    );

  return membersWithoutConfirmation;
}

/**
 * Envia lembrete para um usuario.
 *
 * @param {string} userId - ID do usuario.
 * @param {GameForReminder} game - Dados do jogo.
 * @param {string} reminderType - Tipo (24h/2h).
 * @return {Promise<boolean>} Se enviou com
 *   sucesso.
 */
/**
 * Verifica preferencias de notificacao do usuario.
 * Falha aberta: se o doc nao existir ou campo
 * ausente, assume que notificacoes estao habilitadas.
 *
 * @param {string} userId - ID do usuario
 * @param {string | null} groupId - ID do grupo (para mute_groups)
 * @return {Promise<boolean>} true se pode enviar
 */
async function canSendReminderToUser(
  userId: string,
  groupId: string | null
): Promise<boolean> {
  try {
    // FIX #2477: usa o helper canônico único (mesmo de shouldNotifyUser),
    // que lê `notification_settings/{uid}` tolerando snake (web) e camel
    // (android). Antes lia só camelCase — opt-out de lembrete era ignorado
    // para a maioria web (`enableGameReminders` undefined ≠ false).
    const settings = await getNotificationSettings(userId);

    if (!settings.pushEnabled) return false;
    if (!settings.gameReminders) return false;

    if (isMuted(settings)) {
      logger.info(
        `[REMINDERS] Usuario ${userId} silenciado` +
        " ate " + settings.muteUntil?.toISOString()
      );
      return false;
    }

    if (isGroupMuted(settings, groupId)) {
      logger.info(
        `[REMINDERS] Usuario ${userId} silenciou` +
        ` grupo ${groupId}`
      );
      return false;
    }

    return true;
  } catch (e) {
    logger.error(
      "[REMINDERS] Erro ao verificar prefs" +
      ` de ${userId}, fail-open:`,
      e
    );
    // Fail-open: em caso de erro, enviar
    return true;
  }
}

/**
 * Envia lembrete de jogo (24h ou 2h antes) ao usuário.
 * Respeita preferências de notificação e mute_groups.
 *
 * @param {string} userId - destinatário
 * @param {GameForReminder} game - dados do jogo
 * @param {"24h" | "2h"} reminderType - janela do lembrete
 * @return {Promise<boolean>} true se push enviado com sucesso
 */
async function sendReminder(
  userId: string,
  game: GameForReminder,
  reminderType: "24h" | "2h" | "1h"
): Promise<boolean> {
  // Verificar preferencias do usuario antes de enviar
  const canSend = await canSendReminderToUser(
    userId,
    game.group_id
  );
  if (!canSend) {
    logger.info(
      "[REMINDERS] Pulando lembrete para" +
      ` ${userId} — preferencias bloqueiam envio`
    );
    return false;
  }

  const gameDateTime = getGameDateTime(game);
  const formattedDate = gameDateTime ?
    formatGameDateTime(gameDateTime) :
    "em breve";
  const locationInfo = game.location_name ?
    ` em ${game.location_name}` :
    "";

  const msg = reminderType === "24h" ?
    REMINDER_NOTIFICATIONS.GAME_24H :
    reminderType === "2h" ?
      REMINDER_NOTIFICATIONS.GAME_2H :
      REMINDER_NOTIFICATIONS.GAME_1H;

  const title = msg.title["pt-BR"]();
  const body = msg.body["pt-BR"]({
    locationInfo,
    formattedDate,
  });

  logger.info(
    "[REMINDERS] Enviando lembrete " +
    `${reminderType} para user ${userId}, ` +
    `jogo ${game.id}`
  );

  try {
    // Salvar notificacao no Firestore
    await saveNotificationToFirestore(userId, {
      userId,
      title,
      body,
      type: NotificationType.GAME_REMINDER,
      gameId: game.id,
      groupId: game.group_id || undefined,
      action: `game_detail/${game.id}`,
    });

    // Enviar push notification
    const sent = await sendNotificationToUser(
      userId,
      {
        title,
        body,
        type: NotificationType.GAME_REMINDER,
        data: {
          gameId: game.id,
          reminderType: reminderType,
          action: `game_detail/${game.id}`,
        },
      }
    );

    return sent;
  } catch (e) {
    logger.error(
      "[REMINDERS] Erro ao enviar " +
      `lembrete para ${userId}:`,
      e
    );
    return false;
  }
}

/**
 * Marca o lembrete como enviado na confirmacao
 * existente. Se a confirmacao nao existe, nao
 * cria documento PENDING (evita inflar analytics
 * com confirmacoes falsas).
 *
 * @param {string} gameId - ID do jogo.
 * @param {string} userId - ID do usuario.
 * @param {string} reminderType - Tipo (24h/2h).
 * @return {Promise<void>} Void.
 */
async function markReminderSent(
  gameId: string,
  userId: string,
  reminderType: "24h" | "2h" | "1h"
): Promise<void> {
  const confirmationId =
    `${gameId}_${userId}`;
  const REMINDER_FIELDS: Record<"24h" | "2h" | "1h", string> = {
    "24h": "reminder_24h_sent",
    "2h": "reminder_2h_sent",
    "1h": "reminder_1h_sent",
  };
  const reminderField = REMINDER_FIELDS[reminderType];

  try {
    const confirmationRef = db()
      .collection("confirmations")
      .doc(confirmationId);
    const confirmationDoc =
      await confirmationRef.get();

    if (confirmationDoc.exists) {
      const tsField =
        `${reminderField}_at`;
      await confirmationRef.update({
        [reminderField]: true,
        [tsField]:
          FieldValue
            .serverTimestamp(),
      });
    } else {
      // B2: Rastrear em collection separada
      // em vez de criar doc PENDING falso
      const trackingId =
        `${gameId}_${userId}_${reminderType}`;
      await db()
        .collection("reminder_tracking")
        .doc(trackingId)
        .set({
          game_id: gameId,
          user_id: userId,
          reminder_type: reminderType,
          sent_at:
            FieldValue
              .serverTimestamp(),
        });
    }
  } catch (e) {
    logger.error(
      "[REMINDERS] Erro ao marcar " +
      `lembrete ${reminderType} ` +
      `para ${userId}:`,
      e
    );
    throw e;
  }
}

/**
/**
 * FIX #2501: envia lembretes em PARALELO (lotes) e marca a idempotência
 * ANTES do envio (claim). Antes era sequencial (risco de timeout em jogos
 * populares) e marcava DEPOIS do envio — um crash entre envio e marcação fazia
 * o retry do scheduler reenviar (push duplicado). Semântica at-most-once:
 * se a marcação falhar, não envia; se enviar e crashar, o marcador já
 * persistiu → não reenvia (preferível perder 1 a duplicar).
 *
 * @param {string[]} userIds - Destinatários.
 * @param {Game} game - Jogo.
 * @param {string} reminderType - Tipo (24h/2h).
 * @return {Promise<number>} Quantos lembretes foram enviados.
 */
async function dispatchReminders(
  userIds: string[],
  game: GameForReminder,
  reminderType: "24h" | "2h" | "1h",
): Promise<number> {
  const BATCH = 25;
  let sent = 0;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const slice = userIds.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (userId) => {
        try {
          // Claim idempotente ANTES do envio.
          await markReminderSent(game.id, userId, reminderType);
        } catch (e) {
          logger.error(
            `[REMINDERS] Falha ao marcar ${userId}, pulando envio:`,
            e
          );
          return false;
        }
        return sendReminder(userId, game, reminderType);
      })
    );
    sent += results.filter(Boolean).length;
  }
  return sent;
}

/**
 * Processa lembretes para um tipo especifico
 * (24h ou 2h).
 *
 * @param {string} reminderType - Tipo (24h/2h).
 * @return {Promise<number>} Total de lembretes
 *   enviados.
 */
async function processReminders(
  reminderType: "24h" | "2h" | "1h"
): Promise<number> {
  const HOURS_MAP: Record<"24h" | "2h" | "1h", number> = {
    "24h": 24,
    "2h": 2,
    "1h": 1,
  };
  const hoursBeforeGame = HOURS_MAP[reminderType];
  let totalSent = 0;

  logger.info(
    "\n[REMINDERS] ==========" +
    " Processando lembretes de " +
    `${reminderType} ==========`
  );

  // Buscar jogos na janela de lembrete
  const games =
    await fetchGamesInReminderWindow(
      hoursBeforeGame
    );

  for (const game of games) {
    logger.info(
      "\n[REMINDERS] Processando jogo " +
      `${game.id} (status: ${game.status})`
    );

    // Buscar confirmacoes pendentes
    // (nao confirmadas e nao notificadas)
    const pendingConfirmations =
      await fetchPendingConfirmations(
        game.id,
        reminderType
      );
    const pendingCount =
      pendingConfirmations.length;
    logger.info(
      `  - ${pendingCount}` +
      " confirmacoes pendentes"
    );

    // Processar confirmacoes existentes
    totalSent += await dispatchReminders(
      pendingConfirmations.map((c) => c.user_id),
      game,
      reminderType
    );

    // Para jogos de grupo, tambem notificar
    // membros sem confirmacao
    if (game.group_id) {
      const membersNoConf =
        await fetchGroupMembersWithoutConfirmation(
          game.id,
          game.group_id,
          reminderType
        );
      const membersCount = membersNoConf.length;
      logger.info(
        `  - ${membersCount} membros do` +
        " grupo sem confirmacao"
      );

      totalSent += await dispatchReminders(
        membersNoConf,
        game,
        reminderType
      );
    }
  }

  logger.info(
    "[REMINDERS] Total de lembretes " +
    `${reminderType} enviados: ${totalSent}`
  );
  return totalSent;
}

// ==========================================
// CLOUD FUNCTION - SCHEDULED
// ==========================================

/**
 * Funcao agendada que roda a cada hora para
 * verificar jogos proximos e enviar lembretes
 * para jogadores que nao confirmaram presenca.
 *
 * Janelas de lembrete:
 * - 24 horas antes do jogo
 * - 2 horas antes do jogo
 *
 * Anti-spam:
 * - Cada tipo de lembrete so e enviado uma
 *   vez por usuario/jogo
 * - Marcado via campos reminder_24h_sent e
 *   reminder_2h_sent na confirmacao
 */
export const checkGameReminders = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    retryCount: 3,
    memory: "256MiB",
  },
  async () => {
    logger.info(
      "\n========================================"
    );
    logger.info(
      "[REMINDERS] Iniciando verificacao" +
      " de lembretes de jogos"
    );
    const ts = new Date().toISOString();
    logger.info(
      `[REMINDERS] Timestamp: ${ts}`
    );
    logger.info(
      "========================================\n"
    );

    try {
      // Processar lembretes de 24h
      const sent24h =
        await processReminders("24h");

      // Processar lembretes de 2h
      const sent2h =
        await processReminders("2h");

      // Processar lembretes de 1h
      const sent1h =
        await processReminders("1h");

      const total = sent24h + sent2h + sent1h;
      logger.info(
        "\n========================================"
      );
      logger.info(
        "[REMINDERS] Concluido! " +
        `Total enviados: ${total}`
      );
      logger.info(
        `  - Lembretes 24h: ${sent24h}`
      );
      logger.info(
        `  - Lembretes 2h: ${sent2h}`
      );
      logger.info(
        `  - Lembretes 1h: ${sent1h}`
      );
      logger.info(
        "========================================\n"
      );
    } catch (error) {
      logger.error(
        "[REMINDERS] Erro fatal ao " +
        "processar lembretes:",
        error
      );
      // Re-throw para acionar retry
      throw error;
    }
  }
);

/**
 * Funcao manual para testar o sistema de
 * lembretes. Pode ser chamada via console do
 * Firebase ou Cloud Functions Shell.
 */
export const testGameReminders = onSchedule(
  {
    // Nunca executa automaticamente
    // (1 de janeiro a meia-noite)
    schedule: "0 0 1 1 *",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
  },
  async () => {
    logger.info(
      "[REMINDERS TEST] Executando teste" +
      " manual de lembretes..."
    );

    // Simular verificacao com logs detalhados
    const now = new Date();
    logger.info(
      "[REMINDERS TEST] Hora atual: " +
      `${now.toISOString()}`
    );

    // Buscar proximos jogos para debug
    const upcomingGamesSnap = await db()
      .collection("games")
      .where(
        "status",
        "in",
        ["SCHEDULED", "CONFIRMED"]
      )
      .orderBy("dateTime", "asc")
      .limit(10)
      .get();

    const count = upcomingGamesSnap.size;
    logger.info(
      "[REMINDERS TEST] Proximos " +
      `${count} jogos:`
    );
    for (const doc of upcomingGamesSnap.docs) {
      const data = doc.data();
      const dateTime =
        data.dateTime?.toDate?.() || "N/A";
      logger.info(
        `  - ${doc.id}: ${data.status}` +
        ` @ ${dateTime}`
      );
    }

    // Executar processamento real
    await processReminders("24h");
    await processReminders("2h");
    await processReminders("1h");

    logger.info(
      "[REMINDERS TEST] Teste concluido!"
    );
  }
);

// ==========================================
// AUTO-CANCEL POR BAIXO QUÓRUM
// ==========================================

const AUTO_CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000;
const AUTO_CANCEL_MIN_PLAYERS = 6;

/**
 * Funcao agendada que roda a cada 30 minutos
 * para cancelar automaticamente jogos com
 * poucos jogadores confirmados dentro de 2h.
 *
 * Issue #1786: Cancelamento automático por
 * baixo quórum.
 */
export const autoCancelLowQuorum = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    retryCount: 3,
    memory: "256MiB",
  },
  async () => {
    logger.info(
      "\n====================================" +
      "===="
    );
    logger.info(
      "[AUTO_CANCEL] Verificando jogos " +
      "com baixo quórum"
    );
    const ts = new Date().toISOString();
    logger.info(
      `[AUTO_CANCEL] Timestamp: ${ts}`
    );
    logger.info(
      "====================================" +
      "====\n"
    );

    try {
      const now = new Date();
      const windowEnd = new Date(
        now.getTime() + AUTO_CANCEL_WINDOW_MS
      );

      const nowTs =
        admin.firestore.Timestamp.fromDate(now);
      const endTs =
        admin.firestore.Timestamp.fromDate(
          windowEnd
        );

      const gamesSnap = await db()
        .collection("games")
        .where("status", "==", "CONFIRMED")
        .where("dateTime", ">=", nowTs)
        .where("dateTime", "<=", endTs)
        .get();

      logger.info(
        `[AUTO_CANCEL] ${gamesSnap.size} ` +
        "jogos CONFIRMED dentro da janela de 2h"
      );

      let cancelledCount = 0;

      for (const gameDoc of gamesSnap.docs) {
        const gameData = gameDoc.data();
        const gameId = gameDoc.id;

        if (gameData.auto_cancelled === true) {
          continue;
        }

        const minPlayers =
          gameData.min_players ||
          AUTO_CANCEL_MIN_PLAYERS;

        const confirmationsSnap = await db()
          .collection("confirmations")
          .where("game_id", "==", gameId)
          .where("status", "==", "CONFIRMED")
          .get();

        const confirmedCount =
          confirmationsSnap.size;

        logger.info(
          `[AUTO_CANCEL] Jogo ${gameId}: ` +
          `${confirmedCount}/${minPlayers} ` +
          "jogadores confirmados"
        );

        if (confirmedCount < minPlayers) {
          await gameDoc.ref.update({
            status: "CANCELLED",
            auto_cancelled: true,
            cancel_reason: "Baixo quórum",
            cancelled_by: "system",
            updated_at:
              FieldValue
                .serverTimestamp(),
          });

          const confirmedUserIds =
            confirmationsSnap.docs.map((d) => {
              const data = d.data();
              return data.user_id || data.userId;
            });

          if (confirmedUserIds.length > 0) {
            const gameName =
              gameData.location_name ||
              gameData.field_name ||
              "o jogo";
            const gameDate =
              gameData.date || "";

            await sendNotificationToUsers(
              confirmedUserIds,
              {
                title: GAME_NOTIFICATIONS.GAME_CANCELLED.title["pt-BR"](),
                body:
                  `${gameName} (${gameDate}) ` +
                  "foi cancelado " +
                  "automaticamente por " +
                  "baixo quórum " +
                  `(${confirmedCount}/` +
                  `${minPlayers} jogadores).`,
                type:
                  NotificationType.GAME_CANCELLED,
                data: {
                  gameId: gameId,
                  reason: "low_quorum",
                },
              }
            );

            for (const uid of confirmedUserIds) {
              await saveNotificationToFirestore(
                uid,
                {
                  userId: uid,
                  title: GAME_NOTIFICATIONS.GAME_CANCELLED.title["pt-BR"](),
                  body:
                    `${gameName} (${gameDate}) ` +
                    "foi cancelado " +
                    "automaticamente por " +
                    "baixo quórum.",
                  type:
                    NotificationType.GAME_CANCELLED,
                  gameId: gameId,
                  action:
                    "game_detail/" + gameId,
                }
              );
            }
          }

          cancelledCount++;
          logger.info(
            `[AUTO_CANCEL] Jogo ${gameId} ` +
            "cancelado por baixo quórum"
          );
        }
      }

      logger.info(
        "\n====================================" +
        "===="
      );
      logger.info(
        "[AUTO_CANCEL] Concluído! " +
        `${cancelledCount} jogo(s) cancelado(s)`
      );
      logger.info(
        "====================================" +
        "====\n"
      );
    } catch (error) {
      logger.error(
        "[AUTO_CANCEL] Erro fatal:",
        error
      );
      throw error;
    }
  }
);

// ==========================================
// WAITLIST EXPIRED ENTRIES PROCESSING
// ==========================================

/**
 * Funcao agendada que roda a cada 5 minutos
 * para processar entradas expiradas na lista
 * de espera.
 *
 * Quando um jogador e notificado sobre uma
 * vaga, ele tem 30 minutos para responder.
 * Se nao responder, a entrada expira e o
 * proximo jogador na fila e notificado.
 *
 * Issue: Waitlist auto-promotion
 */
export const processExpiredWaitlistEntries =
  onSchedule(
    {
      schedule: "every 5 minutes",
      timeZone: "America/Sao_Paulo",
      region: FUNCTION_REGION,
      retryCount: 3,
      memory: "256MiB",
    },
    async () => {
      logger.info(
        "\n====================================" +
        "===="
      );
      logger.info(
        "[WAITLIST] Processando entradas" +
        " expiradas da lista de espera"
      );
      const ts = new Date().toISOString();
      logger.info(
        `[WAITLIST] Timestamp: ${ts}`
      );
      logger.info(
        "====================================" +
        "====\n"
      );

      try {
        const now = new Date();
        let expiredCount = 0;
        let promotedCount = 0;

        // Buscar todas as entradas de waitlist
        // com status NOTIFIED onde
        // response_deadline ja passou
        const nowTs =
          admin.firestore.Timestamp.fromDate(
            now
          );
        const waitlistQuery = await db()
          .collectionGroup("waitlist")
          .where("status", "==", "NOTIFIED")
          .where(
            "response_deadline",
            "<=",
            nowTs
          )
          .limit(500)
          .get();

        const wlSize = waitlistQuery.size;
        logger.info(
          "[WAITLIST] Encontradas " +
          `${wlSize} entradas expiradas`
        );

        for (
          const doc of waitlistQuery.docs
        ) {
          const data = doc.data();
          const gameId = data.game_id;
          const userId = data.user_id;

          logger.info(
            "[WAITLIST] Processando " +
            `entrada expirada: ${doc.id}` +
            ` (game: ${gameId},` +
            ` user: ${userId})`
          );
          try {
            let nextUserId: string | undefined;
            let nextUserName: string | undefined;
            let hasNext = false;

            await db().runTransaction(async (tx) => {
              // Re-read the entry inside the transaction (TOCTOU guard)
              const freshEntrySnap = await tx.get(doc.ref);
              if (!freshEntrySnap.exists) return;
              const freshData = freshEntrySnap.data();
              if (freshData?.status !== "NOTIFIED") return; // another worker already handled

              // 1. Mark entry as EXPIRED
              const serverTs = FieldValue.serverTimestamp();
              tx.update(doc.ref, {
                status: "EXPIRED",
                expired_at: serverTs,
              });

              // 2. Find next WAITING entry
              const nextQuery = await tx.get(
                db()
                  .collection("games")
                  .doc(gameId)
                  .collection("waitlist")
                  .where("status", "==", "WAITING")
                  .orderBy("added_at", "asc")
                  .limit(1)
              );

              if (!nextQuery.empty) {
                const nextEntry = nextQuery.docs[0];
                const nextData = nextEntry.data();

                // 3. Calculate new deadline (30 minutes from now)
                const now = new Date();
                const deadlineMs = now.getTime() + 30 * 60 * 1000;
                const newDeadline = new Date(deadlineMs);
                const deadlineTs = admin.firestore.Timestamp.fromDate(newDeadline);
                const notifTs = FieldValue.serverTimestamp();

                // 4. Update status to NOTIFIED
                tx.update(nextEntry.ref, {
                  status: "NOTIFIED",
                  notified_at: notifTs,
                  response_deadline: deadlineTs,
                });

                // Store metadata for notification (outside tx)
                nextUserId = nextData.user_id;
                nextUserName = nextData.user_name || "Jogador";
                hasNext = true;
              }
            });

            expiredCount++;

            // Send notification OUTSIDE the transaction
            if (hasNext && nextUserId) {
              const action = `game_detail/${gameId}`;
              await sendNotificationToUser(nextUserId, {
                title: REMINDER_NOTIFICATIONS.WAITLIST_SUMMON.title["pt-BR"](),
                body: REMINDER_NOTIFICATIONS.WAITLIST_SUMMON.body["pt-BR"](),
                type: NotificationType.GAME_SUMMON,
                data: {gameId, action, urgency: "high"},
              });
              await saveNotificationToFirestore(nextUserId, {
                userId: nextUserId,
                title: REMINDER_NOTIFICATIONS.WAITLIST_SUMMON_FIRESTORE.title["pt-BR"](),
                body: REMINDER_NOTIFICATIONS.WAITLIST_SUMMON_FIRESTORE.body["pt-BR"](),
                type: NotificationType.GAME_SUMMON,
                gameId,
                action,
              });
              promotedCount++;
              logger.info(
                "[WAITLIST] Proximo jogador notificado: " +
                `${nextUserId} (${nextUserName})`
              );
            } else if (!hasNext) {
              logger.info(
                "[WAITLIST] Nenhum jogador na fila para o jogo " + gameId
              );
            }
          } catch (entryError) {
            logger.error(
              "[WAITLIST] Erro ao processar entrada " + `${doc.id}:`,
              entryError
            );
          }
        }

        logger.info(
          "\n====================================" +
          "===="
        );
        logger.info(
          "[WAITLIST] Processamento concluido!"
        );
        logger.info(
          "  - Entradas expiradas: " +
          `${expiredCount}`
        );
        logger.info(
          "  - Proximos notificados: " +
          `${promotedCount}`
        );
        logger.info(
          "====================================" +
          "====\n"
        );
      } catch (error) {
        logger.error(
          "[WAITLIST] Erro fatal ao " +
          "processar lista de espera:",
          error
        );
        // Re-throw para acionar retry
        throw error;
      }
    }
  );
