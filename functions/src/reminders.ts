/**
 * SISTEMA DE LEMBRETES DE JOGOS
 * Futeba dos Parças
 *
 * Notifica jogadores que ainda não confirmaram presença:
 * - 24 horas antes do jogo
 * - 2 horas antes do jogo
 *
 * Recursos:
 * - Anti-spam: não envia o mesmo lembrete duas vezes
 * - Ignora jogos cancelados ou finalizados
 * - Timezone: America/Sao_Paulo
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { sendNotificationToUser, NotificationType, saveNotificationToFirestore } from "./notifications";

const db = admin.firestore();

// ==========================================
// CONSTANTES
// ==========================================

// Janelas de tempo para lembretes (em milissegundos)
const REMINDER_24H_MS = 24 * 60 * 60 * 1000; // 24 horas
const REMINDER_2H_MS = 2 * 60 * 60 * 1000;   // 2 horas

// Tolerância para a janela de busca (em minutos)
// Rodando a cada hora, precisamos de uma janela de 30 min antes/depois
const WINDOW_TOLERANCE_MS = 30 * 60 * 1000; // 30 minutos

// Status de jogos que NÃO devem receber lembretes
const EXCLUDED_GAME_STATUSES = ["CANCELLED", "FINISHED", "LIVE"];

// Status de confirmação que já está OK (não precisa lembrete)
const CONFIRMED_STATUSES = ["CONFIRMED"];

// ==========================================
// INTERFACES
// ==========================================

interface GameForReminder {
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
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Converte data do jogo para Date no timezone America/Sao_Paulo
 */
function getGameDateTime(game: GameForReminder): Date | null {
    // Prioridade 1: Campo dateTime (Timestamp)
    if (game.dateTime && typeof game.dateTime.toDate === "function") {
        return game.dateTime.toDate();
    }

    // Prioridade 2: Campos date + time separados
    if (game.date) {
        const dateStr = game.date;
        const timeStr = game.time || "20:00"; // Default 20:00 se não houver hora

        // Formato esperado: "2026-01-20" + "18:00"
        const [year, month, day] = dateStr.split("-").map(Number);
        const [hour, minute] = timeStr.split(":").map(Number);

        if (year && month && day) {
            // Criar data no timezone local (servidor Firebase geralmente está em UTC)
            // Para America/Sao_Paulo, precisamos ajustar manualmente
            // Nota: Em produção, considerar usar biblioteca como date-fns-tz
            const utcDate = new Date(Date.UTC(year, month - 1, day, hour || 20, minute || 0, 0));

            // Ajuste para America/Sao_Paulo (UTC-3)
            // Firestore armazena em UTC, então precisamos considerar que a hora informada
            // é a hora local (America/Sao_Paulo)
            utcDate.setHours(utcDate.getHours() + 3);

            return utcDate;
        }
    }

    return null;
}

/**
 * Formata a data/hora do jogo para exibição na notificação
 */
function formatGameDateTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo"
    };

    try {
        return date.toLocaleString("pt-BR", options);
    } catch {
        return date.toISOString();
    }
}

/**
 * Busca jogos que estão na janela de lembrete
 * @param hoursBeforeGame - Horas antes do jogo (24 ou 2)
 */
async function fetchGamesInReminderWindow(hoursBeforeGame: number): Promise<GameForReminder[]> {
    const now = new Date();
    const reminderTimeMs = hoursBeforeGame === 24 ? REMINDER_24H_MS : REMINDER_2H_MS;

    // Calcular janela de busca
    // Se o jogo é às 20:00 e queremos lembrar 24h antes,
    // buscamos jogos onde: (gameTime - 24h) está próximo de "agora"
    // Ou seja: gameTime está próximo de (agora + 24h)
    const targetTime = new Date(now.getTime() + reminderTimeMs);
    const windowStart = new Date(targetTime.getTime() - WINDOW_TOLERANCE_MS);
    const windowEnd = new Date(targetTime.getTime() + WINDOW_TOLERANCE_MS);

    console.log(`[REMINDERS] Buscando jogos na janela de ${hoursBeforeGame}h:`);
    console.log(`  - Agora: ${now.toISOString()}`);
    console.log(`  - Janela: ${windowStart.toISOString()} até ${windowEnd.toISOString()}`);

    // Query: jogos com dateTime na janela e status não excluído
    // Nota: Firestore não suporta NOT IN, então filtramos depois
    const gamesSnap = await db.collection("games")
        .where("dateTime", ">=", admin.firestore.Timestamp.fromDate(windowStart))
        .where("dateTime", "<=", admin.firestore.Timestamp.fromDate(windowEnd))
        .get();

    const games: GameForReminder[] = [];

    for (const doc of gamesSnap.docs) {
        const data = doc.data();
        const status = data.status || "SCHEDULED";

        // Filtrar status excluídos
        if (EXCLUDED_GAME_STATUSES.includes(status)) {
            console.log(`  - Jogo ${doc.id} ignorado (status: ${status})`);
            continue;
        }

        games.push({
            id: doc.id,
            dateTime: data.dateTime || null,
            date: data.date || null,
            time: data.time || null,
            status: status,
            group_id: data.group_id || null,
            location_name: data.location_name || data.locationName || null
        });
    }

    console.log(`[REMINDERS] Encontrados ${games.length} jogos elegíveis para lembrete de ${hoursBeforeGame}h`);
    return games;
}

/**
 * Busca confirmações de um jogo que NÃO estão confirmadas
 * e que ainda não receberam o lembrete específico
 */
async function fetchPendingConfirmations(
    gameId: string,
    reminderType: "24h" | "2h"
): Promise<ConfirmationForReminder[]> {
    const reminderField = reminderType === "24h" ? "reminder_24h_sent" : "reminder_2h_sent";

    // Buscar todas as confirmações do jogo
    const confirmationsSnap = await db.collection("confirmations")
        .where("game_id", "==", gameId)
        .get();

    const pending: ConfirmationForReminder[] = [];

    for (const doc of confirmationsSnap.docs) {
        const data = doc.data();
        const userId = data.user_id || data.userId;
        const status = data.status || "PENDING";

        // Pular se já confirmou
        if (CONFIRMED_STATUSES.includes(status)) {
            continue;
        }

        // Pular se lembrete já foi enviado
        if (data[reminderField] === true) {
            console.log(`  - User ${userId} já recebeu lembrete ${reminderType}`);
            continue;
        }

        pending.push({
            id: doc.id,
            user_id: userId,
            game_id: gameId,
            status: status,
            reminder_24h_sent: data.reminder_24h_sent || false,
            reminder_2h_sent: data.reminder_2h_sent || false
        });
    }

    return pending;
}

/**
 * Busca membros do grupo que NÃO têm confirmação no jogo
 * (Para jogos de grupo, queremos notificar todos os membros)
 */
async function fetchGroupMembersWithoutConfirmation(
    gameId: string,
    groupId: string,
    reminderType: "24h" | "2h"
): Promise<string[]> {
    // Buscar membros do grupo
    const membersSnap = await db.collection("groups")
        .doc(groupId)
        .collection("members")
        .where("role", "in", ["MEMBER", "ADMIN", "OWNER"])
        .get();

    const memberIds = membersSnap.docs.map(doc => doc.id);

    // Buscar confirmações existentes para o jogo
    const confirmationsSnap = await db.collection("confirmations")
        .where("game_id", "==", gameId)
        .get();

    const usersWithConfirmation = new Set<string>();
    const usersAlreadyNotified = new Set<string>();

    for (const doc of confirmationsSnap.docs) {
        const data = doc.data();
        const userId = data.user_id || data.userId;
        usersWithConfirmation.add(userId);

        // Verificar se já recebeu o lembrete (via campo na confirmação)
        const reminderField = reminderType === "24h" ? "reminder_24h_sent" : "reminder_2h_sent";
        if (data[reminderField] === true) {
            usersAlreadyNotified.add(userId);
        }
    }

    // Retornar membros que não têm confirmação
    // Para estes, precisamos criar um documento temporário ou enviar diretamente
    const membersWithoutConfirmation = memberIds.filter(id =>
        !usersWithConfirmation.has(id) && !usersAlreadyNotified.has(id)
    );

    return membersWithoutConfirmation;
}

/**
 * Envia lembrete para um usuário
 */
async function sendReminder(
    userId: string,
    game: GameForReminder,
    reminderType: "24h" | "2h"
): Promise<boolean> {
    const gameDateTime = getGameDateTime(game);
    const formattedDate = gameDateTime ? formatGameDateTime(gameDateTime) : "em breve";
    const locationInfo = game.location_name ? ` em ${game.location_name}` : "";

    const title = reminderType === "24h"
        ? "Jogo amanhã! Confirme sua presença"
        : "Jogo em 2 horas! Não esqueça de confirmar";

    const body = reminderType === "24h"
        ? `O jogo${locationInfo} acontecerá ${formattedDate}. Confirme sua presença!`
        : `O jogo${locationInfo} começa em 2 horas (${formattedDate}). Confirme agora!`;

    console.log(`[REMINDERS] Enviando lembrete ${reminderType} para user ${userId}, jogo ${game.id}`);

    try {
        // Salvar notificação no Firestore
        await saveNotificationToFirestore(userId, {
            userId,
            title,
            body,
            type: NotificationType.GAME_REMINDER,
            gameId: game.id,
            groupId: game.group_id || undefined,
            action: `game_detail/${game.id}`
        });

        // Enviar push notification
        const sent = await sendNotificationToUser(userId, {
            title,
            body,
            type: NotificationType.GAME_REMINDER,
            data: {
                gameId: game.id,
                reminderType: reminderType,
                action: `game_detail/${game.id}`
            }
        });

        return sent;
    } catch (e) {
        console.error(`[REMINDERS] Erro ao enviar lembrete para ${userId}:`, e);
        return false;
    }
}

/**
 * Marca o lembrete como enviado na confirmação
 */
async function markReminderSent(
    gameId: string,
    userId: string,
    reminderType: "24h" | "2h"
): Promise<void> {
    const confirmationId = `${gameId}_${userId}`;
    const reminderField = reminderType === "24h" ? "reminder_24h_sent" : "reminder_2h_sent";

    try {
        const confirmationRef = db.collection("confirmations").doc(confirmationId);
        const confirmationDoc = await confirmationRef.get();

        if (confirmationDoc.exists) {
            // Atualizar documento existente
            await confirmationRef.update({
                [reminderField]: true,
                [`${reminderField}_at`]: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Criar documento com status PENDING para rastrear o lembrete
            await confirmationRef.set({
                game_id: gameId,
                user_id: userId,
                status: "PENDING",
                [reminderField]: true,
                [`${reminderField}_at`]: admin.firestore.FieldValue.serverTimestamp(),
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (e) {
        console.error(`[REMINDERS] Erro ao marcar lembrete ${reminderType} para ${userId}:`, e);
    }
}

/**
 * Processa lembretes para um tipo específico (24h ou 2h)
 */
async function processReminders(reminderType: "24h" | "2h"): Promise<number> {
    const hoursBeforeGame = reminderType === "24h" ? 24 : 2;
    let totalSent = 0;

    console.log(`\n[REMINDERS] ========== Processando lembretes de ${reminderType} ==========`);

    // Buscar jogos na janela de lembrete
    const games = await fetchGamesInReminderWindow(hoursBeforeGame);

    for (const game of games) {
        console.log(`\n[REMINDERS] Processando jogo ${game.id} (status: ${game.status})`);

        // Buscar confirmações pendentes (não confirmadas e não notificadas)
        const pendingConfirmations = await fetchPendingConfirmations(game.id, reminderType);
        console.log(`  - ${pendingConfirmations.length} confirmações pendentes`);

        // Processar confirmações existentes
        for (const conf of pendingConfirmations) {
            const sent = await sendReminder(conf.user_id, game, reminderType);
            if (sent) {
                await markReminderSent(game.id, conf.user_id, reminderType);
                totalSent++;
            }
        }

        // Para jogos de grupo, também notificar membros sem confirmação
        if (game.group_id) {
            const membersWithoutConfirmation = await fetchGroupMembersWithoutConfirmation(
                game.id,
                game.group_id,
                reminderType
            );
            console.log(`  - ${membersWithoutConfirmation.length} membros do grupo sem confirmação`);

            for (const memberId of membersWithoutConfirmation) {
                const sent = await sendReminder(memberId, game, reminderType);
                if (sent) {
                    await markReminderSent(game.id, memberId, reminderType);
                    totalSent++;
                }
            }
        }
    }

    console.log(`[REMINDERS] Total de lembretes ${reminderType} enviados: ${totalSent}`);
    return totalSent;
}

// ==========================================
// CLOUD FUNCTION - SCHEDULED
// ==========================================

/**
 * Função agendada que roda a cada hora para verificar jogos próximos
 * e enviar lembretes para jogadores que não confirmaram presença.
 *
 * Janelas de lembrete:
 * - 24 horas antes do jogo
 * - 2 horas antes do jogo
 *
 * Anti-spam:
 * - Cada tipo de lembrete só é enviado uma vez por usuário/jogo
 * - Marcado via campos reminder_24h_sent e reminder_2h_sent na confirmação
 */
export const checkGameReminders = onSchedule(
    {
        schedule: "every 1 hours",
        timeZone: "America/Sao_Paulo",
        retryCount: 3,
        memory: "256MiB"
    },
    async (event) => {
        console.log("\n========================================");
        console.log("[REMINDERS] Iniciando verificação de lembretes de jogos");
        console.log(`[REMINDERS] Timestamp: ${new Date().toISOString()}`);
        console.log("========================================\n");

        try {
            // Processar lembretes de 24h
            const sent24h = await processReminders("24h");

            // Processar lembretes de 2h
            const sent2h = await processReminders("2h");

            const total = sent24h + sent2h;
            console.log(`\n========================================`);
            console.log(`[REMINDERS] Concluído! Total enviados: ${total}`);
            console.log(`  - Lembretes 24h: ${sent24h}`);
            console.log(`  - Lembretes 2h: ${sent2h}`);
            console.log("========================================\n");
        } catch (error) {
            console.error("[REMINDERS] Erro fatal ao processar lembretes:", error);
            throw error; // Re-throw para acionar retry
        }
    }
);

/**
 * Função manual para testar o sistema de lembretes
 * Pode ser chamada via console do Firebase ou Cloud Functions Shell
 */
export const testGameReminders = onSchedule(
    {
        schedule: "0 0 1 1 *", // Nunca executa automaticamente (1 de janeiro à meia-noite)
        timeZone: "America/Sao_Paulo"
    },
    async (event) => {
        console.log("[REMINDERS TEST] Executando teste manual de lembretes...");

        // Simular verificação com logs detalhados
        const now = new Date();
        console.log(`[REMINDERS TEST] Hora atual: ${now.toISOString()}`);

        // Buscar próximos jogos para debug
        const upcomingGamesSnap = await db.collection("games")
            .where("status", "in", ["SCHEDULED", "CONFIRMED"])
            .orderBy("dateTime", "asc")
            .limit(10)
            .get();

        console.log(`[REMINDERS TEST] Próximos ${upcomingGamesSnap.size} jogos:`);
        for (const doc of upcomingGamesSnap.docs) {
            const data = doc.data();
            const dateTime = data.dateTime?.toDate?.() || "N/A";
            console.log(`  - ${doc.id}: ${data.status} @ ${dateTime}`);
        }

        // Executar processamento real
        await processReminders("24h");
        await processReminders("2h");

        console.log("[REMINDERS TEST] Teste concluído!");
    }
);
