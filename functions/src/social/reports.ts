/* istanbul ignore file -- callable wrapper exercised through Firestore rules. */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";
import {checkRateLimit} from "../middleware/rate-limiter";

type ReportTargetType =
  | "group_wall_post"
  | "game_chat_message"
  | "game_comment"
  | "game_photo"
  | "game_video";

interface SubmitContentReportRequest {
  targetType: ReportTargetType;
  groupId?: string;
  postId?: string;
  gameId?: string;
  targetId?: string;
  reason: string;
}

interface NormalizedReportTarget {
  targetPath: string;
  firestorePath: string;
  fields: Record<string, string>;
}

const REPORT_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: "content_report_submit",
};

const REPORT_REASONS = new Set([
  "inappropriate_content",
  "abusive_language",
  "spam",
  "harassment",
  "other",
]);

/**
 * Valida string nao vazia sem barra para IDs de documento.
 *
 * @param {unknown} value Valor cru.
 * @return {boolean} true quando ID simples.
 */
function isSafeId(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 128 &&
    !value.includes("/");
}

/**
 * Normaliza motivo de denuncia.
 *
 * @param {unknown} value Valor cru.
 * @return {string} Motivo validado.
 */
function parseReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!REPORT_REASONS.has(reason)) {
    throw new HttpsError("invalid-argument", "Motivo de denúncia inválido.");
  }
  return reason;
}

/**
 * Normaliza o alvo reportado e retorna paths canonicalizados.
 *
 * @param {unknown} data Payload cru.
 * @return {SubmitContentReportRequest} Payload validado.
 */
function parseSubmitContentReportRequest(
  data: unknown
): SubmitContentReportRequest {
  if (!isRecord(data) || typeof data.targetType !== "string") {
    throw new HttpsError("invalid-argument", "Alvo da denúncia inválido.");
  }

  const reason = parseReason(data.reason);
  switch (data.targetType) {
  case "group_wall_post":
    if (!isSafeId(data.groupId) || !isSafeId(data.postId)) {
      throw new HttpsError("invalid-argument", "Post inválido.");
    }
    return {
      targetType: data.targetType,
      groupId: data.groupId.trim(),
      postId: data.postId.trim(),
      reason,
    };
  case "game_chat_message":
  case "game_comment":
  case "game_photo":
  case "game_video":
    if (!isSafeId(data.gameId) || !isSafeId(data.targetId)) {
      throw new HttpsError("invalid-argument", "Conteúdo inválido.");
    }
    return {
      targetType: data.targetType,
      gameId: data.gameId.trim(),
      targetId: data.targetId.trim(),
      reason,
    };
  default:
    throw new HttpsError("invalid-argument", "Tipo de denúncia inválido.");
  }
}

/**
 * Mapeia alvo validado para path canonico.
 *
 * @param {SubmitContentReportRequest} request Payload validado.
 * @return {NormalizedReportTarget} Alvo normalizado.
 */
function buildReportTarget(
  request: SubmitContentReportRequest
): NormalizedReportTarget {
  if (request.targetType === "group_wall_post") {
    const targetPath =
      `groups/${request.groupId}/wall_posts/${request.postId}`;
    return {
      targetPath,
      firestorePath: targetPath,
      fields: {
        group_id: request.groupId ?? "",
        post_id: request.postId ?? "",
      },
    };
  }

  const collectionByType: Record<Exclude<
    ReportTargetType,
    "group_wall_post"
  >, string> = {
    game_chat_message: "chat",
    game_comment: "comments",
    game_photo: "photos",
    game_video: "videos",
  };
  const collection = collectionByType[request.targetType];
  const targetPath =
    `games/${request.gameId}/${collection}/${request.targetId}`;
  return {
    targetPath,
    firestorePath: targetPath,
    fields: {
      game_id: request.gameId ?? "",
      target_id: request.targetId ?? "",
    },
  };
}

/**
 * Cria denuncia de conteudo com rate limit e validacao server-side.
 */
export const submitContentReport = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório.");
    }

    const uid = request.auth.uid;
    const payload = parseSubmitContentReportRequest(request.data);
    const rateLimit = await checkRateLimit(uid, REPORT_RATE_LIMIT);
    if (!rateLimit.allowed) {
      const resetSec = Math.max(
        1,
        Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      );
      throw new HttpsError(
        "resource-exhausted",
        `Muitas denúncias. Tente novamente em ${resetSec}s.`,
        {retryAfter: resetSec}
      );
    }

    const target = buildReportTarget(payload);
    const targetSnap = await db().doc(target.firestorePath).get();
    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "Conteúdo não encontrado.");
    }

    const reportRef = db().collection("reports").doc();
    await reportRef.set({
      reporter_id: uid,
      target_type: payload.targetType,
      ...target.fields,
      target_path: target.targetPath,
      reason: payload.reason,
      status: "OPEN",
      created_at: FieldValue.serverTimestamp(),
    });

    return {reportId: reportRef.id};
  }
);
