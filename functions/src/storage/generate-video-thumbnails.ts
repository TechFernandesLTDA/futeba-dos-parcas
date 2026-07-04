import * as functions from "firebase-functions/v2";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import {execFile} from "child_process";
import {promisify} from "util";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);
const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_DURATION_SEC = 30;
const MAX_VIDEOS_PER_GAME = 10;
const MAX_VIDEOS_PER_USER_PER_GAME = 3;
const ACCEPTED_VIDEO_CONTENT_TYPE = "video/mp4";
const DOC_LOOKUP_ATTEMPTS = 5;
const DOC_LOOKUP_DELAY_MS = 1500;

interface ParsedVideoPath {
  gameId: string;
  uploaderId: string;
  fileName: string;
}

/**
 * Aguarda por uma quantidade pequena de tempo.
 *
 * @param {number} ms Tempo em milissegundos.
 * @return {Promise<void>} Promise resolvida apos o delay.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parseia o path canonico de videos de jogos.
 *
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
 * Extrai duracao em segundos do stderr do ffmpeg.
 *
 * @param {string} stderr Saida stderr do ffmpeg.
 * @return {number | null} Duracao em segundos.
 */
export function parseFfmpegDuration(stderr: string): number | null {
  const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Executa ffmpeg apenas para obter metadata e duracao.
 *
 * @param {string} inputPath Arquivo local.
 * @return {Promise<number>} Duracao em segundos.
 */
async function readVideoDuration(inputPath: string): Promise<number> {
  try {
    await execFileAsync(ffmpeg.path, ["-hide_banner", "-i", inputPath], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const stderr = (error as {stderr?: string}).stderr || "";
    const duration = parseFfmpegDuration(stderr);
    if (duration !== null) return duration;
  }
  throw new Error("VIDEO_DURATION_UNREADABLE");
}

/**
 * Gera thumbnail JPEG em frame proximo de 1 segundo.
 *
 * @param {string} inputPath Arquivo de video local.
 * @param {string} outputPath Arquivo JPEG de saida.
 * @return {Promise<void>} Promise quando finalizar.
 */
async function generateThumbnail(inputPath: string, outputPath: string) {
  await execFileAsync(
    ffmpeg.path,
    [
      "-hide_banner",
      "-y",
      "-ss",
      "00:00:01",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=480:-1",
      outputPath,
    ],
    {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    }
  );
}

/**
 * Procura o doc game_videos correspondente ao storage_path.
 *
 * @param {string} storagePath Path do objeto no bucket.
 * @return {Promise<FirebaseFirestore.DocumentReference | null>} Doc ref.
 */
async function findVideoDocByStoragePath(
  storagePath: string
): Promise<FirebaseFirestore.DocumentReference | null> {
  for (let attempt = 0; attempt < DOC_LOOKUP_ATTEMPTS; attempt++) {
    const snapshot = await db()
      .collection("game_videos")
      .where("storage_path", "==", storagePath)
      .limit(1)
      .get();
    if (!snapshot.empty) return snapshot.docs[0].ref;
    await delay(DOC_LOOKUP_DELAY_MS);
  }
  return null;
}

/**
 * Marca um video como rejeitado e remove o objeto original.
 *
 * @param {FirebaseFirestore.DocumentReference | null} videoDoc Doc opcional.
 * @param {FirebaseFirestore.FieldValue | string} reason Motivo.
 * @param {FirebaseFirestore.Storage.File} file Arquivo original.
 * @return {Promise<void>} Promise quando finalizar.
 */
async function rejectVideo(
  videoDoc: FirebaseFirestore.DocumentReference | null,
  reason: string,
  file: ReturnType<ReturnType<typeof getStorage>["bucket"]>["file"] extends
    (name: string) => infer T ? T : never
) {
  if (videoDoc) {
    await videoDoc.set(
      {
        status: "REJECTED",
        rejection_reason: reason,
        updated_at: FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
  }
  await file.delete({ignoreNotFound: true});
}

/**
 * Aplica limites de custo/egress por jogo e por usuario antes de deixar o
 * video pronto.
 *
 * @param {ParsedVideoPath} parsedPath Dados extraidos do storage path.
 * @param {FirebaseFirestore.DocumentReference | null} videoDoc Doc atual.
 * @return {Promise<string | null>} Motivo de rejeicao ou null.
 */
async function checkVideoLimits(
  parsedPath: ParsedVideoPath,
  videoDoc: FirebaseFirestore.DocumentReference | null
): Promise<string | null> {
  const snapshot = await db()
    .collection("game_videos")
    .where("game_id", "==", parsedPath.gameId)
    .get();
  const activeDocs = snapshot.docs.filter((doc) => {
    if (videoDoc && doc.id === videoDoc.id) return false;
    return doc.get("status") !== "REJECTED";
  });

  if (activeDocs.length >= MAX_VIDEOS_PER_GAME) {
    return "GAME_VIDEO_LIMIT_REACHED";
  }

  const userDocs = activeDocs.filter((doc) =>
    doc.get("uploaded_by") === parsedPath.uploaderId
  );
  if (userDocs.length >= MAX_VIDEOS_PER_USER_PER_GAME) {
    return "USER_VIDEO_LIMIT_REACHED";
  }

  return null;
}

/**
 * Valida videos de jogo e gera thumbnail JPEG.
 *
 * @return {Promise<object|void>} Resultado do processamento.
 */
export const generateGameVideoThumbnail =
  functions.storage.onObjectFinalized(
    {
      region: FUNCTION_REGION,
      memory: "1GiB",
      timeoutSeconds: 180,
    },
    async (event) => {
      const object = event.data;
      const filePath = object.name;
      const contentType = object.contentType;

      if (!filePath) return;
      const parsedPath = parseGameVideoPath(filePath);
      if (!parsedPath) return;

      const bucket = getStorage().bucket(object.bucket);
      const file = bucket.file(filePath);
      const videoDoc = await findVideoDocByStoragePath(filePath);
      const fileSize = parseInt(String(object.size || "0"), 10);

      if (contentType !== ACCEPTED_VIDEO_CONTENT_TYPE) {
        await rejectVideo(videoDoc, "INVALID_CONTENT_TYPE", file);
        return;
      }

      if (!Number.isFinite(fileSize) || fileSize <= 0 ||
          fileSize > MAX_VIDEO_SIZE_BYTES) {
        await rejectVideo(videoDoc, "INVALID_SIZE", file);
        return;
      }

      const limitRejection = await checkVideoLimits(parsedPath, videoDoc);
      if (limitRejection) {
        await rejectVideo(videoDoc, limitRejection, file);
        return;
      }

      const localVideoPath = path.join(
        os.tmpdir(),
        `${Date.now()}_${parsedPath.fileName}`
      );
      const localThumbPath = path.join(
        os.tmpdir(),
        `${Date.now()}_${parsedPath.fileName}.jpg`
      );
      const thumbPath =
        `games/${parsedPath.gameId}/video_thumbnails/` +
        `${path.basename(parsedPath.fileName, ".mp4")}.jpg`;

      try {
        await file.download({destination: localVideoPath});
        const durationSec = await readVideoDuration(localVideoPath);
        if (durationSec > MAX_VIDEO_DURATION_SEC) {
          await rejectVideo(videoDoc, "DURATION_TOO_LONG", file);
          return;
        }

        await generateThumbnail(localVideoPath, localThumbPath);
        await bucket.upload(localThumbPath, {
          destination: thumbPath,
          metadata: {
            contentType: "image/jpeg",
            metadata: {
              originalFile: filePath,
              generatedAt: new Date().toISOString(),
            },
          },
        });

        if (videoDoc) {
          await videoDoc.update({
            thumbnail_path: thumbPath,
            duration_sec: Math.round(durationSec * 10) / 10,
            status: "READY",
            rejection_reason: null,
            updated_at: FieldValue.serverTimestamp(),
          });
        } else {
          logger.warn("[VIDEO_THUMBNAIL] Doc not found for " + filePath);
        }

        await db().collection("metrics").add({
          type: "game_video_thumbnail_generated",
          timestamp: FieldValue.serverTimestamp(),
          original_file: filePath,
          thumbnail_file: thumbPath,
          game_id: parsedPath.gameId,
          uploader_id: parsedPath.uploaderId,
          duration_sec: Math.round(durationSec * 10) / 10,
        });

        return {
          success: true,
          thumbnailPath: thumbPath,
          durationSec,
        };
      } catch (error) {
        logger.error("[VIDEO_THUMBNAIL] Error processing " + filePath, error);
        if (videoDoc) {
          await videoDoc.set(
            {
              status: "REJECTED",
              rejection_reason: "PROCESSING_ERROR",
              updated_at: FieldValue.serverTimestamp(),
            },
            {merge: true}
          );
        }
        throw error;
      } finally {
        await fs.unlink(localVideoPath).catch(() => undefined);
        await fs.unlink(localThumbPath).catch(() => undefined);
      }
    }
  );
