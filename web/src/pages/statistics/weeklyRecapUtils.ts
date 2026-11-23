import { gameDateTimeFromLocal } from '../../utils/gameDateTime';

type TimestampLike = { toDate?: () => Date };

/**
 * Data do jogo para o resumo da semana. Usa `dateTime` (Timestamp gravado
 * pelos apps e pelo servidor) e, sem ele, `date` + `time` no horário local.
 * `new Date('2026-11-25')` seria meia-noite UTC, ou seja, o dia anterior no
 * Brasil; por isso a string passa por `gameDateTimeFromLocal`.
 */
export function resolveWeeklyGameDate(raw: {
  dateTime?: TimestampLike | null;
  date?: TimestampLike | string | null;
  time?: string | null;
}): Date | null {
  if (raw.dateTime && typeof raw.dateTime.toDate === 'function') {
    return raw.dateTime.toDate();
  }
  const dateField = raw.date;
  if (dateField && typeof dateField === 'object' && typeof dateField.toDate === 'function') {
    return dateField.toDate();
  }
  if (typeof dateField === 'string') {
    return gameDateTimeFromLocal(dateField, raw.time ?? '00:00');
  }
  return null;
}

/** Jogo entra no resumo só se aconteceu nos últimos 7 dias (até agora). */
export function isInLastWeek(date: Date | null, now: Date = new Date()): boolean {
  if (!date || !Number.isFinite(date.getTime())) return false;
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return date.getTime() >= oneWeekAgo.getTime() && date.getTime() <= now.getTime();
}
