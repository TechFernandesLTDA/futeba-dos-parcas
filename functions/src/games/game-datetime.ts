/**
 * Mantém `games/{id}.dateTime` (Timestamp) coerente com `date` e `time`.
 *
 * Spec: specs/bugfix-2026-11-23-jogo-do-web-sem-datetime.md
 *
 * As listas, lembretes, fechamento automático e o chat filtram e ordenam por
 * `dateTime`, mas o web (até esta correção) e o app Android gravam só `date` e
 * `time` em texto, e a edição do Android muda `date`/`time` sem tocar em
 * `dateTime`. O trigger preenche o campo no servidor, o que vale também para as
 * versões do app já instaladas.
 *
 * A hora de parede é lida no fuso da quadra (`locations/{id}.time_zone`) e, sem
 * quadra ou fuso válido, em America/Sao_Paulo, o mesmo padrão de
 * `getGameDateTime` (reminders.ts). O script
 * scripts/migrations/backfill-game-datetime.js repete esta conta para os jogos
 * antigos; mudou aqui, mude lá.
 */

import * as admin from "firebase-admin";
// Timestamp modular: o namespaced `admin.firestore.Timestamp` não existe no
// emulador; lá o gatilho morria no meio da transação e travava o jogo.
import {Timestamp} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {FUNCTION_REGION} from "../constants";

export const DEFAULT_GAME_TIME_ZONE = "America/Sao_Paulo";

type GameData = Record<string, unknown>;

/**
 * Diz se o valor é um Timestamp (ou algo com toDate).
 * @param {unknown} value Valor lido do documento.
 * @return {boolean} true quando tem toDate().
 */
function isTimestampLike(value: unknown): value is {toDate: () => Date; toMillis?: () => number} {
  return Boolean(value) &&
    typeof value === "object" &&
    typeof (value as {toDate?: unknown}).toDate === "function";
}

/**
 * Valida um identificador de fuso IANA.
 * @param {unknown} timeZone Fuso a validar.
 * @return {boolean} true quando o Intl aceita o fuso.
 */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", {timeZone});
    return true;
  } catch {
    return false;
  }
}

/**
 * Diferença, em ms, entre a hora de parede no fuso e o UTC no instante dado.
 * @param {number} instantMs Instante em ms epoch.
 * @param {string} timeZone Fuso IANA.
 * @return {number} Deslocamento em ms.
 */
function offsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour"), get("minute"), get("second"),
  );
  return wall - instantMs;
}

/**
 * Instante da hora de parede `date` "AAAA-MM-DD" + `time` "HH:MM" no fuso.
 * @param {unknown} date Data em texto.
 * @param {unknown} time Hora em texto (vazia = meia-noite).
 * @param {string} timeZone Fuso IANA.
 * @return {Date | null} Instante, ou null se o formato não for o esperado.
 */
export function zonedDateTime(
  date: unknown,
  time: unknown,
  timeZone: string,
): Date | null {
  if (typeof date !== "string") return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!d) return null;
  const year = Number(d[1]);
  const month = Number(d[2]);
  const day = Number(d[3]);

  let hour = 0;
  let minute = 0;
  if (typeof time === "string" && time.trim()) {
    const t = /^(\d{1,2}):(\d{2})/.exec(time.trim());
    if (!t) return null;
    hour = Number(t[1]);
    minute = Number(t[2]);
    if (hour > 23 || minute > 59) return null;
  }

  const wallUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallUtc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  // Duas passadas cobrem troca de horário de verão perto do instante.
  let instant = wallUtc - offsetMs(wallUtc, timeZone);
  instant = wallUtc - offsetMs(instant, timeZone);
  return new Date(instant);
}

/**
 * Decide se esta escrita pede (re)calcular `dateTime`.
 *
 * - jogo sem `dateTime` nem `date_time` em Timestamp: preenche;
 * - `date` ou `time` mudaram e `dateTime` não mudou junto: recalcula (edição do Android);
 * - em qualquer outro caso, inclusive quando o próprio cliente gravou `dateTime`: nada.
 *
 * @param {GameData | undefined} before Documento antes da escrita.
 * @param {GameData} after Documento depois da escrita.
 * @return {boolean} true quando o trigger deve calcular o campo.
 */
export function shouldComputeDateTime(
  before: GameData | undefined,
  after: GameData,
): boolean {
  const hasDateTime = isTimestampLike(after.dateTime);
  if (!hasDateTime) return !isTimestampLike(after.date_time);
  if (!before) return false;

  const wallChanged = before.date !== after.date || before.time !== after.time;
  if (!wallChanged) return false;

  const millis = (v: unknown): number | null =>
    isTimestampLike(v) ? v.toDate().getTime() : null;
  return millis(before.dateTime) === millis(after.dateTime);
}

export const onGameWrittenFillDateTime = onDocumentWritten(
  {
    region: FUNCTION_REGION,
    document: "games/{gameId}",
  },
  async (event) => {
    const after = event.data?.after.data();
    if (!after) return;
    const before = event.data?.before.data();
    if (!shouldComputeDateTime(before, after)) return;

    const gameId = event.params.gameId;
    const db = admin.firestore();

    let timeZone = DEFAULT_GAME_TIME_ZONE;
    const locationId = after.location_id;
    if (typeof locationId === "string" && locationId && !locationId.includes("/")) {
      const location = await db.doc(`locations/${locationId}`).get();
      const tz = location.exists ? location.get("time_zone") : null;
      if (isValidTimeZone(tz)) timeZone = tz;
    }

    const computed = zonedDateTime(after.date, after.time, timeZone);
    if (!computed) {
      logger.warn(`[GAME_DATETIME] ${gameId}: data em formato inesperado, nada gravado.`);
      return;
    }

    // Proteção contra laço: a releitura descarta escrita já feita ou superada.
    const ref = db.doc(`games/${gameId}`);
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      const data = fresh.data();
      if (!data || data.date !== after.date || data.time !== after.time) return;
      if (isTimestampLike(data.dateTime) && data.dateTime.toDate().getTime() === computed.getTime()) return;
      if (!shouldComputeDateTime(before, data)) return;
      tx.update(ref, {dateTime: Timestamp.fromDate(computed)});
    });
    logger.info(`[GAME_DATETIME] ${gameId}: dateTime=${computed.toISOString()} (${timeZone})`);
  }
);
