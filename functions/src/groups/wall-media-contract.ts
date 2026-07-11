import {createHash} from "crypto";

export const WALL_MEDIA_PIPELINE_VERSION = 1;
export const WALL_MEDIA_DRAFT_TTL_MS = 60 * 60 * 1000;
export const WALL_MEDIA_PROCESSING_LEASE_MS = 10 * 60 * 1000;
export const WALL_MEDIA_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const WALL_MEDIA_MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const WALL_MEDIA_MAX_VIDEO_DURATION_SEC = 30;
export const WALL_MEDIA_MAX_IMAGE_DIMENSION = 8192;
export const WALL_MEDIA_MAX_IMAGE_PIXELS = 40_000_000;

export const WALL_MEDIA_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
] as const;

export type WallMediaContentType = typeof WALL_MEDIA_CONTENT_TYPES[number];
export type WallMediaKind = "IMAGE" | "VIDEO";
export type WallMediaDraftStatus =
  | "AWAITING_UPLOAD"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "EXPIRED";

export type WallMediaErrorCode =
  | "DRAFT_NOT_FOUND"
  | "OWNERSHIP_MISMATCH"
  | "INVALID_SIZE"
  | "MIME_MISMATCH"
  | "INVALID_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "UNSUPPORTED_CONTAINER"
  | "DURATION_UNREADABLE"
  | "DURATION_TOO_LONG"
  | "VIDEO_TOO_LARGE"
  | "UNSUPPORTED_VIDEO_CODEC"
  | "UNSUPPORTED_AUDIO_CODEC"
  | "INVALID_VIDEO"
  | "WALL_ACCESS_REVOKED"
  | "RETRY_LIMIT_EXCEEDED"
  | "POST_ID_CONFLICT"
  | "PROCESSING_ERROR";

export interface WallMediaHighlightRef {
  game_id: string;
  highlight_id: string;
}

export interface WallMediaIntent {
  clientRequestId: string;
  text: string;
  declaredContentType: WallMediaContentType;
  declaredSizeBytes: number;
  highlightRef: WallMediaHighlightRef | null;
}

export interface ParsedWallMediaStagingPath {
  groupId: string;
  postId: string;
  ownerId: string;
  fileName: string;
}

export interface WallVideoProbe {
  container: string | null;
  durationSec: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
}

export interface WallMediaMetricInput {
  event:
    | "READY"
    | "REJECTED"
    | "PROCESSING_RETRY"
    | "ORPHAN_CLEANED"
    | "DRAFT_EXPIRED";
  mediaKind: WallMediaKind | null;
  latencyMs?: number | null;
  sourceBytes?: number | null;
  egressBytes?: number | null;
  durationSec?: number | null;
  attempt?: number | null;
  errorCode?: WallMediaErrorCode | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Normaliza o payload idempotente enviado por Web/Android.
 * @param {Record<string, unknown>} input Payload bruto.
 * @return {WallMediaIntent} Intenção canônica.
 */
export function normalizeWallMediaIntent(
  input: Record<string, unknown>
): WallMediaIntent {
  const clientRequestId = typeof input.clientRequestId === "string" ?
    input.clientRequestId.trim() : "";
  if (!UUID_PATTERN.test(clientRequestId)) {
    throw new Error("clientRequestId deve ser um UUID válido.");
  }
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text.length > 500) {
    throw new Error("O texto deve ter no máximo 500 caracteres.");
  }
  const declaredContentType = input.declaredContentType;
  if (!WALL_MEDIA_CONTENT_TYPES.includes(
    declaredContentType as WallMediaContentType
  )) {
    throw new Error("Tipo de mídia não suportado.");
  }
  const declaredSizeBytes = input.sizeBytes;
  if (!Number.isSafeInteger(declaredSizeBytes) ||
      (declaredSizeBytes as number) <= 0) {
    throw new Error("sizeBytes deve ser um inteiro positivo.");
  }
  const maxBytes = maxBytesForContentType(
    declaredContentType as WallMediaContentType
  );
  if ((declaredSizeBytes as number) >= maxBytes) {
    throw new Error(`A mídia excede o limite de ${maxBytes} bytes.`);
  }
  return {
    clientRequestId,
    text,
    declaredContentType: declaredContentType as WallMediaContentType,
    declaredSizeBytes: declaredSizeBytes as number,
    highlightRef: normalizeWallMediaHighlightRef(input.highlightRef),
  };
}

/**
 * Normaliza highlight legado (snake) e atual (camel) para snake_case.
 * @param {unknown} value Referência opcional.
 * @return {WallMediaHighlightRef | null} Referência canônica.
 */
export function normalizeWallMediaHighlightRef(
  value: unknown
): WallMediaHighlightRef | null {
  if (value == null) return null;
  if (typeof value !== "object") throw new Error("highlightRef inválido.");
  const raw = value as Record<string, unknown>;
  const gameId = raw.game_id ?? raw.gameId;
  const highlightId = raw.highlight_id ?? raw.highlightId;
  if (typeof gameId !== "string" || typeof highlightId !== "string" ||
      !SAFE_ID_PATTERN.test(gameId) || !SAFE_ID_PATTERN.test(highlightId)) {
    throw new Error("highlightRef inválido.");
  }
  return {game_id: gameId, highlight_id: highlightId};
}

/**
 * Deriva postId opaco e determinístico para retries do mesmo request.
 * @param {string} groupId Grupo.
 * @param {string} ownerId Autor.
 * @param {string} clientRequestId UUID estável no cliente.
 * @return {string} ID Firestore seguro.
 */
export function wallMediaPostId(
  groupId: string,
  ownerId: string,
  clientRequestId: string
): string {
  return createHash("sha256")
    .update(`wall-media:${groupId}:${ownerId}:${clientRequestId}`)
    .digest("hex")
    .slice(0, 40);
}

/**
 * Hash da intenção impede reuso do mesmo requestId com payload diferente.
 * @param {WallMediaIntent} intent Intenção normalizada.
 * @return {string} SHA-256 hexadecimal.
 */
export function wallMediaIntentHash(intent: WallMediaIntent): string {
  return createHash("sha256").update(JSON.stringify({
    text: intent.text,
    declaredContentType: intent.declaredContentType,
    declaredSizeBytes: intent.declaredSizeBytes,
    highlightRef: intent.highlightRef,
  })).digest("hex");
}

/**
 * Path temporário determinístico, privado pelo UID e pelo draft.
 * @param {string} groupId Grupo.
 * @param {string} postId Post pré-alocado.
 * @param {string} ownerId Autor.
 * @param {WallMediaContentType} contentType Tipo declarado.
 * @return {string} Path de staging.
 */
export function wallMediaUploadPath(
  groupId: string,
  postId: string,
  ownerId: string,
  contentType: WallMediaContentType
): string {
  return `groups/${groupId}/wall_media_staging/${postId}/${ownerId}/` +
    `source.${extensionForContentType(contentType)}`;
}

/**
 * Extrai identidade do path estrito de staging.
 * @param {string} filePath Path do Storage.
 * @return {ParsedWallMediaStagingPath | null} Segmentos ou null.
 */
export function parseWallMediaStagingPath(
  filePath: string
): ParsedWallMediaStagingPath | null {
  const pattern = new RegExp(
    "^groups/([A-Za-z0-9._-]{1,128})/wall_media_staging/" +
    "([a-f0-9]{40})/([A-Za-z0-9._-]{1,128})/" +
    "(source\\.(?:jpg|png|webp|mp4))$"
  );
  const match = filePath.match(pattern);
  return match ? {
    groupId: match[1],
    postId: match[2],
    ownerId: match[3],
    fileName: match[4],
  } : null;
}

/**
 * Detecta o tipo real usando magic bytes, nunca o header do cliente.
 * @param {Buffer} bytes Prefixo ou arquivo completo.
 * @return {WallMediaContentType | null} Tipo detectado.
 */
export function detectWallMediaContentType(
  bytes: Buffer
): WallMediaContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff &&
      bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]))) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    return "video/mp4";
  }
  return null;
}

/**
 * Parseia metadata real emitida pelo ffmpeg.
 * @param {string} stderr Saída do probe.
 * @return {WallVideoProbe} Metadata normalizada.
 */
export function parseWallVideoProbe(stderr: string): WallVideoProbe {
  const input = stderr.match(/Input #0,\s*([^,\n]+(?:,[^\n]+)?),\s*from/i);
  const duration = stderr.match(
    /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i
  );
  const video = stderr.match(/Video:\s*([A-Za-z0-9_]+)[^\n]*?(\d{2,5})x(\d{2,5})/i);
  const audio = stderr.match(/Audio:\s*([A-Za-z0-9_]+)/i);
  const durationSec = duration ?
    Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) :
    null;
  return {
    container: input?.[1]?.trim().toLowerCase() ?? null,
    durationSec: durationSec != null && Number.isFinite(durationSec) ?
      durationSec : null,
    videoCodec: video?.[1]?.toLowerCase() ?? null,
    audioCodec: audio?.[1]?.toLowerCase() ?? null,
    width: video ? Number(video[2]) : null,
    height: video ? Number(video[3]) : null,
  };
}

/**
 * Valida contrato H.264/AAC/MP4 e duração do produto.
 * @param {WallVideoProbe} probe Metadata real.
 * @return {WallMediaErrorCode | null} Rejeição ou null.
 */
export function validateWallVideoProbe(
  probe: WallVideoProbe
): WallMediaErrorCode | null {
  if (!probe.container ||
      (!probe.container.includes("mp4") && !probe.container.includes("mov"))) {
    return "UNSUPPORTED_CONTAINER";
  }
  if (probe.durationSec == null || probe.durationSec <= 0) {
    return "DURATION_UNREADABLE";
  }
  if (probe.durationSec > WALL_MEDIA_MAX_VIDEO_DURATION_SEC) {
    return "DURATION_TOO_LONG";
  }
  if (probe.videoCodec !== "h264") return "UNSUPPORTED_VIDEO_CODEC";
  if (probe.width == null || probe.height == null ||
      !Number.isSafeInteger(probe.width) ||
      !Number.isSafeInteger(probe.height) ||
      probe.width <= 0 || probe.height <= 0 ||
      probe.width > WALL_MEDIA_MAX_IMAGE_DIMENSION ||
      probe.height > WALL_MEDIA_MAX_IMAGE_DIMENSION ||
      probe.width * probe.height > WALL_MEDIA_MAX_IMAGE_PIXELS) {
    return "VIDEO_TOO_LARGE";
  }
  if (probe.audioCodec != null && probe.audioCodec !== "aac") {
    return "UNSUPPORTED_AUDIO_CODEC";
  }
  return null;
}

/**
 * Mensagem estável e acionável que clientes podem exibir.
 * @param {WallMediaErrorCode} code Código server-side.
 * @return {string} Texto PT-BR sem detalhes internos.
 */
export function wallMediaErrorMessage(code: WallMediaErrorCode): string {
  const messages: Record<WallMediaErrorCode, string> = {
    DRAFT_NOT_FOUND: "O envio expirou. Selecione a mídia novamente.",
    OWNERSHIP_MISMATCH: "Este envio não pertence à sua conta.",
    INVALID_SIZE: "O arquivo está vazio ou excede o limite permitido.",
    MIME_MISMATCH: "O conteúdo do arquivo não corresponde ao formato informado.",
    INVALID_IMAGE: "Não foi possível ler esta imagem.",
    IMAGE_TOO_LARGE: "A resolução da imagem excede o limite permitido.",
    UNSUPPORTED_CONTAINER: "Envie um vídeo MP4 compatível.",
    DURATION_UNREADABLE: "Não foi possível identificar a duração do vídeo.",
    DURATION_TOO_LONG: "O vídeo deve ter no máximo 30 segundos.",
    VIDEO_TOO_LARGE: "A resolução do vídeo excede o limite permitido.",
    UNSUPPORTED_VIDEO_CODEC: "Converta o vídeo para H.264 e tente novamente.",
    UNSUPPORTED_AUDIO_CODEC: "Converta o áudio do vídeo para AAC e tente novamente.",
    INVALID_VIDEO: "Não foi possível ler este vídeo com segurança.",
    WALL_ACCESS_REVOKED: "O grupo não aceita mais publicações deste usuário.",
    RETRY_LIMIT_EXCEEDED: "Não foi possível processar a mídia após várias tentativas.",
    POST_ID_CONFLICT: "Este envio entrou em conflito. Selecione a mídia novamente.",
    PROCESSING_ERROR: "Não foi possível preparar a mídia. Tente novamente.",
  };
  return messages[code];
}

/**
 * Evento de métrica sem IDs, paths, nomes, emails ou URLs.
 * @param {WallMediaMetricInput} input Medidas operacionais.
 * @return {Record<string, unknown>} Payload de baixa cardinalidade.
 */
export function buildWallMediaMetric(
  input: WallMediaMetricInput
): Record<string, unknown> {
  return {
    type: "group_wall_media_pipeline",
    pipeline_version: WALL_MEDIA_PIPELINE_VERSION,
    event: input.event,
    media_kind: input.mediaKind,
    latency_bucket: bucketLatency(input.latencyMs),
    size_bucket: bucketBytes(input.sourceBytes),
    duration_bucket: bucketDuration(input.durationSec),
    source_bytes: normalizeMetricNumber(input.sourceBytes),
    egress_bytes: normalizeMetricNumber(input.egressBytes),
    attempt: normalizeMetricNumber(input.attempt),
    error_code: input.errorCode ?? null,
  };
}

/**
 * Retorna limite por tipo declarado.
 * @param {WallMediaContentType} type Tipo aceito.
 * @return {number} Limite em bytes.
 */
export function maxBytesForContentType(type: WallMediaContentType): number {
  return type === "video/mp4" ?
    WALL_MEDIA_MAX_VIDEO_BYTES : WALL_MEDIA_MAX_IMAGE_BYTES;
}

/**
 * Retorna kind estável para UI/métricas.
 * @param {WallMediaContentType} type Tipo aceito.
 * @return {WallMediaKind} IMAGE ou VIDEO.
 */
export function mediaKindForContentType(type: WallMediaContentType): WallMediaKind {
  return type === "video/mp4" ? "VIDEO" : "IMAGE";
}

/**
 * Extensão segura derivada do tipo, não do nome recebido.
 * @param {WallMediaContentType} type Tipo aceito.
 * @return {string} Extensão sem ponto.
 */
export function extensionForContentType(type: WallMediaContentType): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "mp4";
}

/* eslint-disable require-jsdoc -- helpers privados de bucket são autoexplicativos. */
function normalizeMetricNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ?
    Math.round(value) : null;
}

function bucketLatency(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 1_000) return "LT_1S";
  if (value < 5_000) return "1_5S";
  if (value < 15_000) return "5_15S";
  if (value < 60_000) return "15_60S";
  return "GTE_60S";
}

function bucketBytes(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 1024 * 1024) return "LT_1MB";
  if (value < 5 * 1024 * 1024) return "1_5MB";
  if (value < 10 * 1024 * 1024) return "5_10MB";
  if (value < 25 * 1024 * 1024) return "10_25MB";
  return "GTE_25MB";
}

function bucketDuration(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 5) return "LT_5S";
  if (value < 15) return "5_15S";
  if (value <= 30) return "15_30S";
  return "GT_30S";
}
/* eslint-enable require-jsdoc */
