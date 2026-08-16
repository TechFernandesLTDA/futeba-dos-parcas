import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";
import {checkRateLimit} from "../middleware/rate-limiter";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_RANGE_DAYS = 60;
const MAX_FIELD_ID_LENGTH = 128;
const DEFAULT_GAME_DURATION_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;
const BLOCKING_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "LIVE"]);
const FIELD_GAMES_QUERY_LIMIT = 500;
const FIELD_GAMES_MAX_PAGES = 10;

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
  truncated?: boolean;
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
    // FIX #4046: consome o token de App Check como as callables sensíveis,
    // e aplica o mesmo rate limit das irmãs (bucket por uid).
    consumeAppCheckToken: true,
  },
  async (request): Promise<FieldAvailabilityResponse> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticação necessária.");
    }

    // FIX #4046: era a única callable alcançável por usuário comum sem rate
    // limit. Cota compatível com a tela de disponibilidade (read-only, com
    // janela MAX_RANGE_DAYS).
    const rateLimitResult = await checkRateLimit(request.auth.uid, {
      maxRequests: 60,
      windowMs: 60 * 1000,
      keyPrefix: "field_availability",
    });
    if (!rateLimitResult.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "Muitas consultas de disponibilidade. Tente novamente em instantes."
      );
    }

    const {fieldId, startDate, endDate} = parseFieldAvailabilityRequest(
      request.data
    );

    // FIX #4016: paginar até esvaziar para evitar truncagem silenciosa.
    // Antes a query tinha .limit(500) sem cursor — uma quadra com >500
    // jogos na janela de 60 dias reportava horários ocupados como livres
    // (overbooking). Agora paginamos com startAfter até drenar ou até
    // FIELD_GAMES_MAX_PAGES (safety cap contra abuso).
    let truncated = false;
    const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (let page = 0; page < FIELD_GAMES_MAX_PAGES; page++) {
      let q: FirebaseFirestore.Query = db()
        .collection("games")
        .where("field_id", "==", fieldId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .select("date", "time", "end_time", "status", "deleted_at", "deletedAt")
        .orderBy("date", "asc")
        .limit(FIELD_GAMES_QUERY_LIMIT);

      if (cursor) {
        q = q.startAfter(cursor);
      }

      const snapshot = await q.get();
      allDocs.push(...snapshot.docs);

      if (snapshot.size < FIELD_GAMES_QUERY_LIMIT) {
        cursor = null;
        break;
      }
      cursor = snapshot.docs[snapshot.size - 1];
    }

    if (cursor) {
      truncated = true;
    }

    // FIX #4046: sinal de saturação no servidor — uma quadra que passou do teto
    // de páginas volta `truncated=true` para o cliente, mas o servidor não
    // registrava nada (mesmo princípio de sinal de saturação do #4017).
    if (truncated) {
      logger.warn(
        "[FIELD_AVAILABILITY] Query truncada para a quadra " +
        `${fieldId} — ${allDocs.length}+ jogos na janela consultada.`
      );
    }

    const slots = allDocs
      .map((doc) => projectGameToBusySlot(doc.data()))
      .filter((slot): slot is FieldBusySlot => slot !== null)
      .sort((left, right) =>
        left.date.localeCompare(right.date) ||
        left.startMinutes - right.startMinutes
      );

    return truncated ? {slots, truncated} : {slots};
  }
);
