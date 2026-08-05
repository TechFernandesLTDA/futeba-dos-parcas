import {onCall, HttpsError} from "firebase-functions/v2/https";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_RANGE_DAYS = 60;
const MAX_FIELD_ID_LENGTH = 128;
const DEFAULT_GAME_DURATION_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;
const BLOCKING_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "LIVE"]);
const FIELD_GAMES_QUERY_LIMIT = 500;

interface FieldAvailabilityRequest {
  fieldId: string;
  startDate: string;
  endDate: string;
}

export interface FieldBusySlot {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

interface FieldAvailabilityResponse {
  slots: FieldBusySlot[];
}

/**
 * Valida e converte uma chave yyyy-MM-dd para meia-noite UTC.
 * @param {unknown} value Valor de data recebido.
 * @return {number | null} Epoch em milissegundos ou null.
 */
function dateKeyToMillis(value: unknown): number | null {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? parsed.getTime() : null;
}

/**
 * Converte HH:mm estrito em minutos desde meia-noite.
 * @param {unknown} value Horário recebido.
 * @return {number | null} Minutos desde meia-noite ou null.
 */
function timeToMinutes(value: unknown): number | null {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Normaliza e valida o payload público do callable.
 * @param {unknown} data Payload recebido.
 * @return {FieldAvailabilityRequest} Intervalo validado.
 */
export function parseFieldAvailabilityRequest(
  data: unknown
): FieldAvailabilityRequest {
  if (!isRecord(data)) {
    throw new HttpsError("invalid-argument", "Payload inválido.");
  }

  const fieldId = typeof data.fieldId === "string" ? data.fieldId.trim() : "";
  const startDate = typeof data.startDate === "string" ? data.startDate : "";
  const endDate = typeof data.endDate === "string" ? data.endDate : "";
  const startMillis = dateKeyToMillis(startDate);
  const endMillis = dateKeyToMillis(endDate);

  if (
    !fieldId ||
    fieldId.length > MAX_FIELD_ID_LENGTH ||
    fieldId.includes("/") ||
    startMillis === null ||
    endMillis === null
  ) {
    throw new HttpsError("invalid-argument", "Quadra ou intervalo inválido.");
  }

  const rangeDays = (endMillis - startMillis) / (24 * 60 * 60 * 1000);
  if (rangeDays < 0 || rangeDays > MAX_RANGE_DAYS) {
    throw new HttpsError(
      "invalid-argument",
      `O intervalo deve ter no máximo ${MAX_RANGE_DAYS} dias.`
    );
  }

  return {fieldId, startDate, endDate};
}

/**
 * Projeta um documento de jogo em um slot sem metadados identificáveis.
 * Retorna null para jogo inválido, não bloqueante ou removido.
 * @param {Record<string, unknown>} game Documento de jogo selecionado.
 * @return {FieldBusySlot | null} Slot sanitizado ou null.
 */
export function projectGameToBusySlot(
  game: Record<string, unknown>
): FieldBusySlot | null {
  if (
    game.deleted_at != null ||
    game.deletedAt != null ||
    !BLOCKING_STATUSES.has(String(game.status || ""))
  ) {
    return null;
  }

  const date = typeof game.date === "string" ? game.date : "";
  if (dateKeyToMillis(date) === null) return null;

  const startMinutes = timeToMinutes(game.time);
  if (startMinutes === null) return null;

  const parsedEnd = timeToMinutes(game.end_time);
  const rawEnd = parsedEnd ?? startMinutes + DEFAULT_GAME_DURATION_MINUTES;
  const endMinutes = rawEnd <= startMinutes ? rawEnd + MINUTES_PER_DAY : rawEnd;

  return {date, startMinutes, endMinutes};
}

export const getFieldAvailability = onCall<FieldAvailabilityRequest>(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: false,
  },
  async (request): Promise<FieldAvailabilityResponse> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticação necessária.");
    }

    const {fieldId, startDate, endDate} = parseFieldAvailabilityRequest(
      request.data
    );

    const snapshot = await db()
      .collection("games")
      .where("field_id", "==", fieldId)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .select("date", "time", "end_time", "status", "deleted_at", "deletedAt")
      .limit(FIELD_GAMES_QUERY_LIMIT)
      .get();

    const slots = snapshot.docs
      .map((doc) => projectGameToBusySlot(doc.data()))
      .filter((slot): slot is FieldBusySlot => slot !== null)
      .sort((left, right) =>
        left.date.localeCompare(right.date) ||
        left.startMinutes - right.startMinutes
      );

    return {slots};
  }
);
