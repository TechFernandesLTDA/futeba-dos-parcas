/**
 * LIMITES DE RECORRÊNCIA (lógica pura, sem dependências de Firebase)
 *
 * Extraído de recurrence-engine.ts para ser testável de forma isolada,
 * sem registrar o trigger Firestore. Spec #2398 (decisão "ambos": count
 * XOR end_date, sempre sob o hard cap de 52).
 */

export type RecurrenceType = "weekly" | "biweekly" | "monthly";

/** Hard cap inviolável da série (1 ano de jogos semanais). */
export const RECURRENCE_HARD_CAP = 52;

/** Motivo pelo qual a série recorrente deve parar (null = continuar). */
export type RecurrenceStopReason = null | "hard_cap" | "count" | "end_date";

/**
 * Decide (puro, testável) se a próxima ocorrência da série deve ser criada.
 * @param {object} input - Estado atual da série.
 * @param {number} input.currentIndex - Índice 1-based da ocorrência atual.
 * @param {number} input.childCount - Quantos filhos a série já tem.
 * @param {number|null} input.recurrenceCount - Limite "N vezes" (ou null).
 * @param {string|null} input.recurrenceEndDate - Limite "até DD/MM" ISO (ou null).
 * @param {string} input.nextDate - Próxima data calculada (YYYY-MM-DD).
 * @return {RecurrenceStopReason} Motivo de parada, ou null para prosseguir.
 */
export function recurrenceStopReason(input: {
  currentIndex: number;
  childCount: number;
  recurrenceCount: number | null;
  recurrenceEndDate: string | null;
  nextDate: string;
}): RecurrenceStopReason {
  const nextIndex = input.currentIndex + 1;
  if (
    nextIndex > RECURRENCE_HARD_CAP ||
    input.childCount >= RECURRENCE_HARD_CAP
  ) {
    return "hard_cap";
  }
  if (input.recurrenceCount != null && nextIndex > input.recurrenceCount) {
    return "count";
  }
  if (
    input.recurrenceEndDate != null &&
    input.nextDate > input.recurrenceEndDate
  ) {
    return "end_date";
  }
  return null;
}

/**
 * Calcula a próxima data com base no tipo de recorrência.
 * @param {string} dateStr - Data base no formato YYYY-MM-DD
 * @param {RecurrenceType} recurrence - Tipo de recorrência
 * @return {string} Próxima data no formato YYYY-MM-DD
 */
export function getNextDate(
  dateStr: string,
  recurrence: RecurrenceType
): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  switch (recurrence) {
  case "weekly":
    date.setDate(date.getDate() + 7);
    break;
  case "biweekly":
    date.setDate(date.getDate() + 14);
    break;
  case "monthly":
    date.setMonth(date.getMonth() + 1);
    break;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
