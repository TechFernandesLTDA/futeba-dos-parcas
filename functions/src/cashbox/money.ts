export const CASHBOX_CENTS_MULTIPLIER = 100;
export const CASHBOX_MAX_AMOUNT_CENTS = 100000 * CASHBOX_CENTS_MULTIPLIER;

/**
 * Converte BRL numérico em centavos inteiros.
 * @param {unknown} value Valor bruto lido do cliente ou Firestore.
 * @return {number} Valor inteiro em centavos.
 */
export function cashboxAmountToCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value * CASHBOX_CENTS_MULTIPLIER);
}

/**
 * Converte centavos inteiros para BRL numérico com 2 casas.
 * @param {number} cents Valor em centavos.
 * @return {number} Valor numérico em BRL.
 */
export function centsToCashboxAmount(cents: number): number {
  return Math.round(cents) / CASHBOX_CENTS_MULTIPLIER;
}

/**
 * Normaliza valores monetários legados para o boundary de 2 casas.
 * @param {unknown} value Valor bruto legado.
 * @return {number} Valor BRL normalizado.
 */
export function normalizeCashboxAmount(value: unknown): number {
  return centsToCashboxAmount(cashboxAmountToCents(value));
}
