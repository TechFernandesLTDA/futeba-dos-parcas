import {createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {HttpsError} from "firebase-functions/v2/https";
import {db} from "../_db";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {
  ACCEPTED_VIDEO_CONTENT_TYPE,
  ACTIVE_VIDEO_STATUSES,
  firebaseDownloadUrl,
  ensureStorageDownloadToken,
  firstStorageDownloadToken,
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEOS_PER_GAME,
  MAX_VIDEOS_PER_USER_PER_GAME,
  parseGameVideoPath,
} from "./game-video-policy";

const MAX_CAPTION_LENGTH = 200;
const GAME_VIDEO_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: "game_video_create",
};

interface ValidatedStoredObject {
  size: number;
  url: string;
}

export interface CreateGameVideoData {
  gameId?: unknown;
  storagePath?: unknown;
  caption?: unknown;
}

export interface CreateGameVideoResult {
  success: true;
  videoId: string;
  alreadyExists: boolean;
}

/**
 * Valida uma string obrigatoria do payload.
 * @param {unknown} value Valor recebido.
 * @param {string} field Nome do campo.
 * @param {number} maxLength Tamanho maximo.
 * @return {string} Valor normalizado.
 */
function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${field} invalido.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} invalido.`);
  }
  return normalized;
}

/**
 * Busca o primeiro valor textual de um perfil.
 * @param {FirebaseFirestore.DocumentData | undefined} data Dados do perfil.
 * @param {string[]} keys Campos candidatos.
 * @return {string} Valor encontrado ou vazio.
 */
function profileString(
  data: FirebaseFirestore.DocumentData | undefined,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Verifica a autorizacao de gestor do jogo.
 * @param {FirebaseFirestore.DocumentData} game Dados do jogo.
 * @param {string} uid UID do caller.
 * @param {boolean} isAdmin Claim administrativo.
 * @return {boolean} Se o caller pode gerenciar o jogo.
 */
function isGameManager(
  game: FirebaseFirestore.DocumentData,
  uid: string,
  isAdmin: boolean
): boolean {
  const coOrganizers = Array.isArray(game.co_organizers) ?
    game.co_organizers : [];
  return isAdmin || game.owner_id === uid || coOrganizers.includes(uid);
}

/**
 * Gera um ID deterministico para tornar a criacao idempotente.
 * @param {string} storagePath Path canonico do upload.
 * @return {string} ID hexadecimal.
 */
function deterministicVideoId(storagePath: string): string {
  return createHash("sha256").update(storagePath).digest("hex");
}

/**
 * Normaliza e valida a legenda do video.
 * @param {unknown} value Legenda recebida.
 * @return {string} Legenda normalizada.
 */
function normalizeCaption(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_CAPTION_LENGTH) {
    throw new HttpsError("invalid-argument", "Legenda invalida.");
  }
  return value.trim();
}

/**
 * Confirma existencia, tipo, tamanho e URL derivada do objeto.
 * @param {string} storagePath Path canonico.
 * @param {string} gameId ID do jogo.
 * @param {string} uid UID do uploader.
 * @return {Promise<ValidatedStoredObject>} Metadados.
 */
async function validateStoredObject(
  storagePath: string,
  gameId: string,
  uid: string
): Promise<ValidatedStoredObject> {
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError(
      "failed-precondition",
      "O upload do video ainda nao esta disponivel. Tente novamente."
    );
  }

  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType;
  const size = Number(metadata.size);
  const customMetadata = (metadata.metadata ?? {}) as Record<string, string>;
  if (contentType !== ACCEPTED_VIDEO_CONTENT_TYPE ||
      !Number.isSafeInteger(size) || size <= 0 || size > MAX_VIDEO_SIZE_BYTES) {
    throw new HttpsError(
      "invalid-argument",
      "O video precisa ser MP4 e ter no maximo 25 MB."
    );
  }
  if ((customMetadata.gameId && customMetadata.gameId !== gameId) ||
      (customMetadata.uploadedBy && customMetadata.uploadedBy !== uid)) {
    throw new HttpsError("permission-denied", "Upload de video invalido.");
  }

  const currentToken = firstStorageDownloadToken(
    customMetadata.firebaseStorageDownloadTokens
  );
  const token = ensureStorageDownloadToken(customMetadata);
  if (!currentToken) {
    await file.setMetadata({
      metadata: {
        ...customMetadata,
        firebaseStorageDownloadTokens: token,
      },
    });
  }

  return {
    size,
    url: firebaseDownloadUrl(bucket.name, storagePath, token),
  };
}

/**
 * Cria o documento autoritativo depois que o upload foi validado no Storage.
 * A transacao revalida autorizacao e limites para impedir bypass por cliente.
 */
export const createGameVideo = secureCallable<
  CreateGameVideoData,
  CreateGameVideoResult
>(
  {
    rateLimit: GAME_VIDEO_RATE_LIMIT,
    consumeAppCheckToken: true,
    auditLogContext: async (request) => ({
      gameId: request.data?.gameId,
      storagePath: request.data?.storagePath,
    }),
  },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new HttpsError("unauthenticated", "Autenticacao necessaria.");
    }
    const uid = auth.uid;

    const gameId = requireString(request.data?.gameId, "gameId", 128);
    const storagePath = requireString(request.data?.storagePath, "storagePath", 512);
    const caption = normalizeCaption(request.data?.caption);
    const parsedPath = parseGameVideoPath(storagePath);
    if (!parsedPath || parsedPath.gameId !== gameId || parsedPath.uploaderId !== uid) {
      throw new HttpsError("permission-denied", "Path de video nao pertence ao usuario.");
    }

    const storedObject = await validateStoredObject(storagePath, gameId, uid);
    const database = db();
    const videoRef = database.collection("game_videos")
      .doc(deterministicVideoId(storagePath));
    const gameRef = database.collection("games").doc(gameId);
    const confirmationRef = database.collection("confirmations")
      .doc(`${gameId}_${uid}`);
    const userRef = database.collection("users").doc(uid);
    const activeVideosQuery = database.collection("game_videos")
      .where("game_id", "==", gameId)
      .where("status", "in", ACTIVE_VIDEO_STATUSES)
      .limit(MAX_VIDEOS_PER_GAME + 1);
    const isAdmin = auth.token?.role === "ADMIN";

    return database.runTransaction(async (transaction) => {
      const [gameSnap, confirmationSnap, userSnap, existingSnap, activeSnap] =
        await Promise.all([
          transaction.get(gameRef),
          transaction.get(confirmationRef),
          transaction.get(userRef),
          transaction.get(videoRef),
          transaction.get(activeVideosQuery),
        ]);

      if (existingSnap.exists) {
        const existing = existingSnap.data() ?? {};
        if (existing.storage_path !== storagePath || existing.uploaded_by !== uid) {
          throw new HttpsError("already-exists", "Este upload ja foi utilizado.");
        }
        return {success: true, videoId: videoRef.id, alreadyExists: true};
      }

      if (!gameSnap.exists) {
        throw new HttpsError("not-found", "Jogo nao encontrado.");
      }
      const game = gameSnap.data() ?? {};
      if (game.status !== "FINISHED") {
        throw new HttpsError(
          "failed-precondition",
          "Videos so podem ser enviados apos o jogo terminar."
        );
      }

      const confirmed = confirmationSnap.exists &&
        confirmationSnap.data()?.status === "CONFIRMED";
      if (!confirmed && !isGameManager(game, uid, isAdmin)) {
        throw new HttpsError("permission-denied", "Usuario nao pode enviar video neste jogo.");
      }

      const activeDocs = activeSnap.docs.filter((doc) => doc.id !== videoRef.id);
      if (activeDocs.length >= MAX_VIDEOS_PER_GAME) {
        throw new HttpsError("resource-exhausted", "Limite de videos do jogo atingido.");
      }
      if (activeDocs.filter((doc) => doc.get("uploaded_by") === uid).length >=
          MAX_VIDEOS_PER_USER_PER_GAME) {
        throw new HttpsError("resource-exhausted", "Limite de videos do usuario atingido.");
      }

      const profile = userSnap.data();
      const uploadedByName = profileString(profile, "name", "displayName") ||
        profileString(auth.token as Record<string, unknown>, "name") || "Jogador";
      const uploadedByPhoto = profileString(profile, "photo_url", "photoUrl") ||
        profileString(auth.token as Record<string, unknown>, "picture");

      transaction.create(videoRef, {
        game_id: gameId,
        url: storedObject.url,
        storage_path: storagePath,
        thumbnail_path: null,
        uploaded_by: uid,
        uploaded_by_name: uploadedByName.slice(0, 120),
        uploaded_by_photo: uploadedByPhoto.slice(0, 2048),
        content_type: ACCEPTED_VIDEO_CONTENT_TYPE,
        size: storedObject.size,
        duration_sec: null,
        caption,
        reactions: {},
        status: "PROCESSING",
        rejection_reason: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      return {success: true, videoId: videoRef.id, alreadyExists: false};
    });
  }
);
