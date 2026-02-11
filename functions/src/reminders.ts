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

import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {
  sendNotificationToUser,
  NotificationType,
  saveNotificationToFirestore,
} from "./notifications";

// Lazy initialization para evitar erro
// de initializeApp
const getDb = () => admin.firestore();

// ==========================================
// CONSTANTES
// ==========================================

// Janelas de tempo para lembretes (ms)
const REMINDER_24H_MS = 24 * 60 * 60 * 1000;
const REMINDER_2H_MS = 2 * 60 * 60 * 1000;

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
}

// ==========================================
// FUNCOES AUXILIARES
// ==========================================

/**
 * Converte data do jogo para Date no
 * timezone America/Sao_Paulo.
 *
 * @param {GameForReminder} game - Jogo.
 * @return {Date | null} Data convertida.
 */
export function getGameDateTime(
  game: GameForReminder
): Date | null {
  // Prioridade 1: Campo dateTime (Timestamp)
  if (
    game.dateTime &&
    typeof game.dateTime.toDate === "function"
  ) {
    return game.dateTime.toDate();
  }

  // Prioridade 2: Campos date + time separados
  if (game.date) {
    const dateStr = game.date;
    // Default 20:00 se nao houver hora
    const timeStr = game.time || "20:00";

    // Formato esperado: "2026-01-20" + "18:00"
    const [year, month, day] =
      dateStr.split("-").map(Number);
    const [hour, minute] =
      timeStr.split(":").map(Number);

    if (year && month && day) {
      // Criar data no timezone local
      // (servidor Firebase geralmente em UTC)
      // Para America/Sao_Paulo, precisamos
      // ajustar manualmente
      // Nota: Em producao, considerar usar
      // biblioteca como date-fns-tz
      const utcDate = new Date(
        Date.UTC(
          year,
          month - 1,
          day,
          hour || 20,
          minute || 0,
          0
        )
      );

      // LIMITACAO: Offset fixo para
      // America/Sao_Paulo (UTC-3).
      // Nao leva em conta horario de verao
      // (que foi abolido no Brasil em 2019,
      // mas se fosse reintroduzido, este valor
      // precisaria ser dinamico).
      // Para suporte completo de timezone,
      // considerar usar date-fns-tz ou luxon.
      const BRAZIL_UTC_OFFSET = -3;
      // A hora informada pelo usuario e hora
      // local (BRT). Para converter para UTC,
      // subtraimos o offset (que e negativo,
      // entao somamos o valor absoluto).
      utcDate.setHours(
        utcDate.getHours() - BRAZIL_UTC_OFFSET
      );

      return utcDate;
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
 *   do jogo (24 ou 2).
 * @return {Promise<GameForReminder[]>} Jogos
 *   na janela.
 */
async function fetchGamesInReminderWindow(
  hoursBeforeGame: number
): Promise<GameForReminder[]> {
  const now = new Date();
  const reminderTimeMs =
    hoursBeforeGame === 24 ?
      REMINDER_24H_MS :
      REMINDER_2H_MS;

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
  console.log(
    "[REMINDERS] Buscando jogos na " +
    `janela de ${hoursLabel}h:`
  );
  console.log(
    `  - Agora: ${now.toISOString()}`
  );
  console.log(
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
  const gamesSnap = await getDb()
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
      console.log(
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

  console.log(
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
  reminderType: "24h" | "2h"
): Promise<ConfirmationForReminder[]> {
  const reminderField =
    reminderType === "24h" ?
      "reminder_24h_sent" :
      "reminder_2h_sent";

  // Buscar todas as confirmacoes do jogo
  const confirmationsSnap = await getDb()
    .collection("confirmations")
    .where("game_id", "==", gameId)
    .get();

  const pending: ConfirmationForReminder[] = [];

  for (const doc of confirmationsSnap.docs) {
    const data = doc.data();
    const userId = data.user_id || data.userId;
    const status = data.status || "PENDING";

    // Pular se ja confirmou
    if (CONFIRMED_STATUSES.includes(status)) {
      continue;
    }

    // Pular se lembrete ja foi enviado
    if (data[reminderField] === true) {
      console.log(
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
  reminderType: "24h" | "2h"
): Promise<string[]> {
  // Buscar membros do grupo
  const membersSnap = await getDb()
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

  // Buscar confirmacoes existentes para o jogo
  const confirmationsSnap = await getDb()
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

    // Verificar se ja recebeu o lembrete
    // (via campo na confirmacao)
    const reminderField =
      reminderType === "24h" ?
        "reminder_24h_sent" :
        "reminder_2h_sent";
    if (data[reminderField] === true) {
      usersAlreadyNotified.add(userId);
    }
  }

  // Retornar membros que nao tem confirmacao
  // Para estes, precisamos criar um documento
  // temporario ou enviar diretamente
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
async function sendReminder(
  userId: string,
  game: GameForReminder,
  reminderType: "24h" | "2h"
): Promise<boolean> {
  const gameDateTime = getGameDateTime(game);
  const formattedDate = gameDateTime ?
    formatGameDateTime(gameDateTime) :
    "em breve";
  const locationInfo = game.location_name ?
    ` em ${game.location_name}` :
    "";

  const title = reminderType === "24h" ?
    "Jogo amanha! Confirme sua presenca" :
    "Jogo em 2 horas! Nao esqueca";

  const body = reminderType === "24h" ?
    `O jogo${locationInfo} acontecera ` +
    `${formattedDate}. Confirme!` :
    `O jogo${locationInfo} comeca em ` +
    `2 horas (${formattedDate}). Confirme!`;

  console.log(
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
    console.error(
      "[REMINDERS] Erro ao enviar " +
      `lembrete para ${userId}:`,
      e
    );
    return false;
  }
}

/**
 * Marca o lembrete como enviado na confirmacao.
 *
 * @param {string} gameId - ID do jogo.
 * @param {string} userId - ID do usuario.
 * @param {string} reminderType - Tipo (24h/2h).
 * @return {Promise<void>} Void.
 */
async function markReminderSent(
  gameId: string,
  userId: string,
  reminderType: "24h" | "2h"
): Promise<void> {
  const confirmationId =
    `${gameId}_${userId}`;
  const reminderField =
    reminderType === "24h" ?
      "reminder_24h_sent" :
      "reminder_2h_sent";

  try {
    const confirmationRef = getDb()
      .collection("confirmations")
      .doc(confirmationId);
    const confirmationDoc =
      await confirmationRef.get();

    if (confirmationDoc.exists) {
      // Atualizar documento existente
      const tsField =
        `${reminderField}_at`;
      await confirmationRef.update({
        [reminderField]: true,
        [tsField]:
          admin.firestore.FieldValue
            .serverTimestamp(),
      });
    } else {
      // Criar documento com status PENDING
      // para rastrear o lembrete
      const tsField =
        `${reminderField}_at`;
      const serverTs =
        admin.firestore.FieldValue
          .serverTimestamp();
      await confirmationRef.set({
        game_id: gameId,
        user_id: userId,
        status: "PENDING",
        [reminderField]: true,
        [tsField]: serverTs,
        created_at: serverTs,
      });
    }
  } catch (e) {
    console.error(
      "[REMINDERS] Erro ao marcar " +
      `lembrete ${reminderType} ` +
      `para ${userId}:`,
      e
    );
  }
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
  reminderType: "24h" | "2h"
): Promise<number> {
  const hoursBeforeGame =
    reminderType === "24h" ? 24 : 2;
  let totalSent = 0;

  console.log(
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
    console.log(
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
    console.log(
      `  - ${pendingCount}` +
      " confirmacoes pendentes"
    );

    // Processar confirmacoes existentes
    for (const conf of pendingConfirmations) {
      const sent = await sendReminder(
        conf.user_id,
        game,
        reminderType
      );
      if (sent) {
        await markReminderSent(
          game.id,
          conf.user_id,
          reminderType
        );
        totalSent++;
      }
    }

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
      console.log(
        `  - ${membersCount} membros do` +
        " grupo sem confirmacao"
      );

      for (const memberId of membersNoConf) {
        const sent = await sendReminder(
          memberId,
          game,
          reminderType
        );
        if (sent) {
          await markReminderSent(
            game.id,
            memberId,
            reminderType
          );
          totalSent++;
        }
      }
    }
  }

  console.log(
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
    retryCount: 3,
    memory: "256MiB",
  },
  async () => {
    console.log(
      "\n========================================"
    );
    console.log(
      "[REMINDERS] Iniciando verificacao" +
      " de lembretes de jogos"
    );
    const ts = new Date().toISOString();
    console.log(
      `[REMINDERS] Timestamp: ${ts}`
    );
    console.log(
      "========================================\n"
    );

    try {
      // Processar lembretes de 24h
      const sent24h =
        await processReminders("24h");

      // Processar lembretes de 2h
      const sent2h =
        await processReminders("2h");

      const total = sent24h + sent2h;
      console.log(
        "\n========================================"
      );
      console.log(
        "[REMINDERS] Concluido! " +
        `Total enviados: ${total}`
      );
      console.log(
        `  - Lembretes 24h: ${sent24h}`
      );
      console.log(
        `  - Lembretes 2h: ${sent2h}`
      );
      console.log(
        "========================================\n"
      );
    } catch (error) {
      console.error(
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
  },
  async () => {
    console.log(
      "[REMINDERS TEST] Executando teste" +
      " manual de lembretes..."
    );

    // Simular verificacao com logs detalhados
    const now = new Date();
    console.log(
      "[REMINDERS TEST] Hora atual: " +
      `${now.toISOString()}`
    );

    // Buscar proximos jogos para debug
    const upcomingGamesSnap = await getDb()
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
    console.log(
      "[REMINDERS TEST] Proximos " +
      `${count} jogos:`
    );
    for (const doc of upcomingGamesSnap.docs) {
      const data = doc.data();
      const dateTime =
        data.dateTime?.toDate?.() || "N/A";
      console.log(
        `  - ${doc.id}: ${data.status}` +
        ` @ ${dateTime}`
      );
    }

    // Executar processamento real
    await processReminders("24h");
    await processReminders("2h");

    console.log(
      "[REMINDERS TEST] Teste concluido!"
    );
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
      retryCount: 3,
      memory: "256MiB",
    },
    async () => {
      console.log(
        "\n====================================" +
        "===="
      );
      console.log(
        "[WAITLIST] Processando entradas" +
        " expiradas da lista de espera"
      );
      const ts = new Date().toISOString();
      console.log(
        `[WAITLIST] Timestamp: ${ts}`
      );
      console.log(
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
        const waitlistQuery = await getDb()
          .collectionGroup("waitlist")
          .where("status", "==", "NOTIFIED")
          .where(
            "response_deadline",
            "<=",
            nowTs
          )
          .get();

        const wlSize = waitlistQuery.size;
        console.log(
          "[WAITLIST] Encontradas " +
          `${wlSize} entradas expiradas`
        );

        for (
          const doc of waitlistQuery.docs
        ) {
          const data = doc.data();
          const gameId = data.game_id;
          const userId = data.user_id;

          console.log(
            "[WAITLIST] Processando " +
            `entrada expirada: ${doc.id}` +
            ` (game: ${gameId},` +
            ` user: ${userId})`
          );

          try {
            // 1. Marcar entrada como EXPIRED
            const serverTs =
              admin.firestore.FieldValue
                .serverTimestamp();
            await doc.ref.update({
              status: "EXPIRED",
              expired_at: serverTs,
            });
            expiredCount++;

            // 2. Buscar proximo na fila
            // com status WAITING
            const nextQuery = await getDb()
              .collection("games")
              .doc(gameId)
              .collection("waitlist")
              .where(
                "status",
                "==",
                "WAITING"
              )
              .orderBy("added_at", "asc")
              .limit(1)
              .get();

            if (!nextQuery.empty) {
              const nextEntry =
                nextQuery.docs[0];
              const nextData =
                nextEntry.data();
              const nextUserId =
                nextData.user_id;
              const nextUserName =
                nextData.user_name ||
                "Jogador";

              // 3. Calcular novo deadline
              // (30 minutos)
              const deadlineMs =
                now.getTime() +
                30 * 60 * 1000;
              const newDeadline =
                new Date(deadlineMs);

              // 4. Atualizar status
              // para NOTIFIED
              const deadlineTs =
                admin.firestore.Timestamp
                  .fromDate(newDeadline);
              const notifTs =
                admin.firestore.FieldValue
                  .serverTimestamp();
              await nextEntry.ref.update({
                status: "NOTIFIED",
                notified_at: notifTs,
                response_deadline: deadlineTs,
              });

              // 5. Enviar notificacao
              const action =
                `game_detail/${gameId}`;
              await sendNotificationToUser(
                nextUserId,
                {
                  title:
                    "Vaga Disponivel!",
                  body:
                    "Uma vaga abriu para " +
                    "o jogo. Voce tem 30 " +
                    "minutos para confirmar!",
                  type:
                    NotificationType
                      .GAME_SUMMON,
                  data: {
                    gameId: gameId,
                    action: action,
                    urgency: "high",
                  },
                }
              );

              // 6. Salvar notificacao
              // no Firestore
              await saveNotificationToFirestore(
                nextUserId,
                {
                  userId: nextUserId,
                  title:
                    "Vaga Disponivel!",
                  body:
                    "Uma vaga abriu! " +
                    "Confirme sua " +
                    "presenca em ate " +
                    "30 minutos.",
                  type:
                    NotificationType
                      .GAME_SUMMON,
                  gameId: gameId,
                  action: action,
                }
              );

              promotedCount++;
              console.log(
                "[WAITLIST] Proximo " +
                "jogador notificado: " +
                `${nextUserId}` +
                ` (${nextUserName})`
              );
            } else {
              console.log(
                "[WAITLIST] Nenhum " +
                "jogador na fila para " +
                `o jogo ${gameId}`
              );
            }
          } catch (entryError) {
            console.error(
              "[WAITLIST] Erro ao " +
              "processar entrada " +
              `${doc.id}:`,
              entryError
            );
          }
        }

        console.log(
          "\n====================================" +
          "===="
        );
        console.log(
          "[WAITLIST] Processamento concluido!"
        );
        console.log(
          "  - Entradas expiradas: " +
          `${expiredCount}`
        );
        console.log(
          "  - Proximos notificados: " +
          `${promotedCount}`
        );
        console.log(
          "====================================" +
          "====\n"
        );
      } catch (error) {
        console.error(
          "[WAITLIST] Erro fatal ao " +
          "processar lista de espera:",
          error
        );
        // Re-throw para acionar retry
        throw error;
      }
    }
  );
