/**
 * Remove valores undefined de payloads antes de gravar no Firestore,
 * preservando as classes do SDK que não são mapas plain.
 *
 * BUG #4147: a implementação anterior tratava qualquer `typeof === "object"`
 * como mapa plano via Object.entries. Isso destrói as sentinelas do SDK:
 * - FieldValue.serverTimestamp() virava {} (carimbo corrompido);
 * - Timestamp virava mapa {_seconds, _nanoseconds};
 * - GeoPoint virava mapa {_latitude, _longitude}.
 */

import {
  FieldValue,
  GeoPoint,
  Timestamp,
} from "firebase-admin/firestore";

/**
 * Indica se o valor é uma instância do SDK que deve seguir intacta.
 * O typeof guarda contra mocks de teste que expõem esses símbolos sem
 * construtor.
 *
 * @param {unknown} candidate - Valor candidato.
 * @return {boolean} true quando FieldValue/Timestamp/GeoPoint.
 */
function isSdkInstance(candidate: unknown): boolean {
  return (typeof FieldValue === "function" &&
    candidate instanceof FieldValue) ||
    (typeof Timestamp === "function" &&
      candidate instanceof Timestamp) ||
    (typeof GeoPoint === "function" &&
      candidate instanceof GeoPoint);
}

/**
 * Remove valores undefined de objetos e arrays, recursivamente.
 *
 * @template T
 * @param {T} value - Valor original.
 * @return {T} Valor sem campos undefined, com sentinelas preservadas.
 */
export function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedValues(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  // Preserva FieldValue (serverTimestamp/increment/etc), Timestamp e
  // GeoPoint: não são mapas plain e devem seguir intactos ao Firestore.
  if (isSdkInstance(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)])
  ) as T;
}
