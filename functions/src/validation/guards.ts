/**
 * Guards de validação em runtime para dados crus do Firestore.
 *
 * FIX #2284: triggers e callables faziam `as Game` (etc.) diretamente sobre
 * `snapshot.data()`, que tem tipo `any`. Se o documento estiver malformado
 * (campo ausente ou tipo errado), o código segue com `undefined`/NaN e falha
 * silenciosamente mais adiante. Estes guards validam os campos-chave ANTES do
 * cast e permitem que o caller faça early-return (triggers) ou lance HttpsError
 * (callables) de forma explícita e logada.
 *
 * Princípio: validar apenas os campos realmente usados/required, não o shape
 * inteiro — pragmatismo sobre completude.
 */

import {logger} from "firebase-functions";
import {HttpsError} from "firebase-functions/v2/https";
import type {Game} from "../models";

/**
 * Verifica se `value` é um objeto não-nulo (registro indexável).
 * @param {unknown} value valor cru a inspecionar
 * @return {boolean} true se for objeto
 */
export function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Valida que `data` tem o shape mínimo de um Game (status + owner_id strings).
 *
 * @param {unknown} data dados crus do snapshot
 * @return {boolean} true se válido como Game
 */
export function isGameShape(data: unknown): data is Game {
  if (!isRecord(data)) return false;
  return (
    typeof data.status === "string" &&
    typeof data.owner_id === "string"
  );
}

/**
 * Valida que `data` é um documento com `status` string — útil para docs de
 * solicitação/convite que dependem da transição de status.
 *
 * @param {unknown} data dados crus do snapshot
 * @return {boolean} true se tem status string
 */
export function hasStatusString(
  data: unknown
): data is {status: string} & Record<string, unknown> {
  return isRecord(data) && typeof data.status === "string";
}

/**
 * Asserção: lança se `data` não for um Game válido. Use em callables (o
 * HttpsError vira erro tratável no cliente).
 *
 * @param {unknown} data dados crus do snapshot
 * @param {string} context rótulo para o log (ex: nome da função)
 */
export function assertGameShape(
  data: unknown,
  context: string
): asserts data is Game {
  if (!isGameShape(data)) {
    logger.error(
      `[GUARD] Documento Game malformado em ${context}`,
      {data}
    );
    throw new HttpsError(
      "failed-precondition",
      "Documento de jogo inválido ou incompleto."
    );
  }
}
