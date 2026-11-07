import * as admin from "firebase-admin";
import type {GamificationSettings} from "../models";

// FIX #4150: janela de dias que mantém a sequência de participações.
// BUSINESS_RULES define streak por jogos CONSECUTIVOS — pelada semanal
// (lacuna de 7 dias) tem que MANTER. Antes o corte era gapDays <= 1, o
// que zerava toda sequência semanal (7/7 user_streaks em prod com
// longest_streak = 1). 8 = 7 + 1 de tolerância (mesma janela do
// SmartReminderHelper; decisão registrada em specs/DECISIONS.md).
const STREAK_KEEP_GAP_DAYS = 8;

/**
 * Formata a data do jogo na chave yyyy-MM-dd em America/Sao_Paulo.
 * @param {Date} date Data do jogo.
 * @return {string} Chave local BRT.
 */
export function brtDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Converte uma chave yyyy-MM-dd em Date UTC seguro para diff em dias.
 * @param {unknown} dateKey Valor bruto do campo de data.
 * @return {Date | null} Data normalizada ou null.
 */
export function parseDateKeyAsUtc(dateKey?: unknown): Date | null {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Lê o primeiro campo numérico finito de um documento.
 * @param {admin.firestore.DocumentData | undefined} data Documento bruto.
 * @param {string[]} keys Aliases aceitos.
 * @param {number} fallback Valor padrão.
 * @return {number} Número encontrado ou fallback.
 */
export function getFiniteNumber(
  data: admin.firestore.DocumentData | undefined,
  keys: string[],
  fallback = 0
): number {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

/**
 * Calcula o streak após processar o jogo atual.
 * @param {admin.firestore.DocumentData | undefined} raw Doc de streak.
 * @param {string} gameDateKey Data do jogo em yyyy-MM-dd.
 * @return {object} Streak anterior, atual, recorde e início.
 */
export function calculateNextParticipationStreak(
  raw: admin.firestore.DocumentData | undefined,
  gameDateKey: string
) {
  const previousCurrent = getFiniteNumber(
    raw,
    ["current_streak", "currentStreak"]
  );
  const previousLongest = getFiniteNumber(
    raw,
    ["longest_streak", "longestStreak"]
  );
  const lastGameDate =
    typeof raw?.last_game_date === "string" ?
      raw.last_game_date :
      typeof raw?.lastGameDate === "string" ?
        raw.lastGameDate :
        undefined;
  const lastDate = parseDateKeyAsUtc(lastGameDate);
  const currentDate = parseDateKeyAsUtc(gameDateKey);
  const gapDays = lastDate && currentDate ?
    Math.round(
      (currentDate.getTime() - lastDate.getTime()) / 86400000
    ) :
    null;
  const keepsStreak =
    previousCurrent > 0 &&
    (gapDays === null || (gapDays >= 0 && gapDays <= STREAK_KEEP_GAP_DAYS));
  // FIX #4150: mesmo dia NÃO soma (paridade com o gêmeo KMP
  // GamificationRepositoryImpl: diffInDays == 0 não incrementa) — duas
  // peladas no sábado não contam como 2 jogos seguidos.
  const sameDayAttendance = gapDays === 0;
  const currentStreak = keepsStreak ?
    (sameDayAttendance ? previousCurrent : previousCurrent + 1) :
    1;
  const previousStartedAt =
    typeof raw?.streak_started_at === "string" ?
      raw.streak_started_at :
      typeof raw?.streakStartedAt === "string" ?
        raw.streakStartedAt :
        undefined;
  if (
    lastGameDate &&
    currentDate &&
    lastDate &&
    lastDate.getTime() > currentDate.getTime()
  ) {
    return {
      previousStreak: previousCurrent,
      currentStreak: previousCurrent,
      longestStreak: Math.max(previousLongest, previousCurrent),
      streakStartedAt: previousStartedAt || lastGameDate,
    };
  }

  return {
    previousStreak: previousCurrent,
    currentStreak,
    longestStreak: Math.max(previousLongest, currentStreak),
    streakStartedAt: keepsStreak ?
      (previousStartedAt || gameDateKey) :
      gameDateKey,
  };
}

/**
 * Detecta se o doc de streak já aponta para jogo mais recente.
 * @param {admin.firestore.DocumentData | undefined} raw Doc de streak.
 * @param {string} gameDateKey Data do jogo em yyyy-MM-dd.
 * @return {boolean} true quando o marcador atual é mais novo.
 */
export function hasNewerParticipationStreakMarker(
  raw: admin.firestore.DocumentData | undefined,
  gameDateKey: string
): boolean {
  const lastGameDate =
    typeof raw?.last_game_date === "string" ?
      raw.last_game_date :
      typeof raw?.lastGameDate === "string" ?
        raw.lastGameDate :
        undefined;
  const lastDate = parseDateKeyAsUtc(lastGameDate);
  const currentDate = parseDateKeyAsUtc(gameDateKey);
  return !!(
    lastDate &&
    currentDate &&
    lastDate.getTime() > currentDate.getTime()
  );
}

/**
 * Calcula o bônus de XP pelo streak atual.
 * @param {number} streak Streak de participação atualizado.
 * @param {GamificationSettings} settings Configuração de XP.
 * @return {number} XP de streak aplicável.
 */
export function calculateStreakXp(
  streak: number,
  settings: GamificationSettings
): number {
  if (streak >= 10) return settings.xp_streak_10;
  if (streak >= 7) return settings.xp_streak_7;
  if (streak >= 5) return settings.xp_streak_5;
  if (streak >= 3) return settings.xp_streak_3;
  return 0;
}
