import {randomUUID} from "node:crypto";

export const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SEC = 30;
export const MAX_VIDEOS_PER_GAME = 10;
export const MAX_VIDEOS_PER_USER_PER_GAME = 3;
export const ACCEPTED_VIDEO_CONTENT_TYPE = "video/mp4";
export const GAME_VIDEOS_QUERY_LIMIT = 50;
export const ACTIVE_VIDEO_STATUSES = ["PROCESSING", "READY"] as const;

export interface ParsedVideoPath {
  gameId: string;
  uploaderId: string;
  fileName: string;
}

/**
 * Parseia o path canonico de videos de jogos.
 * @param {string} filePath Path do objeto no bucket.
 * @return {ParsedVideoPath | null} Dados extraidos ou null.
 */
export function parseGameVideoPath(filePath: string): ParsedVideoPath | null {
  const match = filePath.match(
    /^games\/([^/]+)\/videos\/([^/]+)\/([A-Za-z0-9._-]+\.mp4)$/
  );
  if (!match) return null;
  return {
    gameId: match[1],
    uploaderId: match[2],
    fileName: match[3],
  };
}

/**
 * Retorna o primeiro token de download armazenado nos metadados.
 * @param {unknown} value Valor bruto dos metadados.
 * @return {string | null} Token ou null.
 */
export function firstStorageDownloadToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.split(",")[0]?.trim();
  return token || null;
}

/**
 * Reutiliza ou gera um token de download para o objeto.
 * @param {Record<string, unknown>} metadata Metadados customizados.
 * @return {string} Token de download.
 */
export function ensureStorageDownloadToken(
  metadata: Record<string, unknown>
): string {
  return firstStorageDownloadToken(metadata.firebaseStorageDownloadTokens) ??
    randomUUID();
}

/**
 * Monta a URL publica por token do Firebase Storage.
 * @param {string} bucket Nome do bucket.
 * @param {string} objectPath Path codificado do objeto.
 * @param {string} token Token de download.
 * @return {string} URL de download.
 */
export function firebaseDownloadUrl(
  bucket: string,
  objectPath: string,
  token: string
): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
}
