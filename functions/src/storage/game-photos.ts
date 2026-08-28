import {createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {HttpsError} from "firebase-functions/v2/https";
import {db} from "../_db";
import {secureCallable} from "../middleware/secure-callable-wrapper";
import {
  firebaseDownloadUrl,
  firstStorageDownloadToken,
  ensureStorageDownloadToken,
} from "./game-video-policy";

// FIX #4049: game_photos não tinha NENHUM teto server-side (o irmão game_videos
// recebeu o tratamento completo no #4024). Aqui espelhamos o teto por jogo e por
// usuário, aplicado numa transação, com a criação migrada para callable (o doc
// autoritativo deixa de ser criado pelo cliente).
export const MAX_PHOTOS_PER_GAME = 50;
export const MAX_PHOTOS_PER_USER_PER_GAME = 20;
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
const MAX_CAPTION_LENGTH = 160;
const GAME_PHOTO_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 1000,
  keyPrefix: "game_photo_create",
};

interface ValidatedStoredObject {
  size: number;
  url: string;
  contentType: string;
}

export interface CreateGamePhotoData {
  gameId?: unknown;
  storagePath?: unknown;
  caption?: unknown;
}

export interface CreateGamePhotoResult {
  success: true;
  photoId: string;
  alreadyExists: boolean;
}

/**
 * Parseia o path canônico de fotos de jogos.
 * @param {string} filePath Path do objeto no bucket.
 * @return {Object|null} Dados extraídos (gameId/uploaderId/fileName) ou null.
 */
export function parseGamePhotoPath(
  filePath: string
): {gameId: string; uploaderId: string; fileName: string} | null {
  const match = filePath.match(
    /^games\/([^/]+)\/photos\/([^/]+)\/([^/]+)$/
  );
  if (!match) return null;
  return {
    gameId: match[1],
    uploaderId: match[2],
    fileName: match[3],
  };
}

/**
 * Valida uma string obrigatória do payload.
 * @param {unknown} value Valor recebido.
 * @param {string} field Nome do campo.
 * @param {number} maxLength Tamanho máximo.
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
 * @param {FirebaseFirestore.DocumentData|undefined} data Dados do perfil.
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
 * Verifica a autorização de gestor do jogo.
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
 * Gera um ID determinístico para tornar a criação idempotente.
 * @param {string} storagePath Path canônico do upload.
 * @return {string} ID hexadecimal.
 */
function deterministicPhotoId(storagePath: string): string {
  return createHash("sha256").update(storagePath).digest("hex");
}

/**
 * Confirma existência, tipo e tamanho do objeto no Storage.
 * @param {string} storagePath Path canônico.
 * @return {Promise<Object>} Metadados validados (size, url, contentType).
 */
async function validateStoredObject(
  storagePath: string
): Promise<ValidatedStoredObject> {
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError(
      "failed-precondition",
      "O upload da foto ainda nao esta disponivel. Tente novamente."
    );
  }

  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "");
  const size = Number(metadata.size);
  if (
    !(ACCEPTED_PHOTO_CONTENT_TYPES as readonly string[]).includes(contentType) ||
    !Number.isSafeInteger(size) || size <= 0 || size > MAX_PHOTO_SIZE_BYTES
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A foto precisa ser JPEG/PNG/WebP/GIF e ter no maximo 10 MB."
    );
  }

  // FIX #4083: substitui getSignedUrl (5 anos, irrevogavel, dependente de
  // signBlob) pelo download token rotacionavel do Firebase — mesmo fluxo do
  // irmao game_videos. Trocar o token no metadata derruba toda URL antiga.
  const customMetadata = (metadata.metadata ?? {}) as Record<string, string>;
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
    contentType,
  };
}

/**
 * Cria o documento autoritativo da foto depois que o upload foi validado no
 * Storage. A transação revalida autorização e limites para impedir bypass.
 */
export const createGamePhoto = secureCallable<
  CreateGamePhotoData,
  CreateGamePhotoResult
>(
  {
    rateLimit: GAME_PHOTO_RATE_LIMIT,
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
    const storagePath = requireString(
      request.data?.storagePath, "storagePath", 512
    );
    const caption = normalizeCaption(request.data?.caption);
    const parsedPath = parseGamePhotoPath(storagePath);
    if (!parsedPath || parsedPath.gameId !== gameId || parsedPath.uploaderId !== uid) {
      throw new HttpsError(
        "permission-denied", "Path de foto nao pertence ao usuario."
      );
    }

    const storedObject = await validateStoredObject(storagePath);
    const database = db();
    const photoRef = database.collection("game_photos")
      .doc(deterministicPhotoId(storagePath));
    const gameRef = database.collection("games").doc(gameId);
    const confirmationRef = database.collection("confirmations")
      .doc(`${gameId}_${uid}`);
    const userRef = database.collection("users").doc(uid);
    const activePhotosQuery = database.collection("game_photos")
      .where("game_id", "==", gameId)
      .where("status", "==", "ACTIVE")
      .limit(MAX_PHOTOS_PER_GAME + 1);
    const isAdmin = auth.token?.role === "ADMIN";

    return database.runTransaction(async (transaction) => {
      const [gameSnap, confirmationSnap, userSnap, existingSnap, activeSnap] =
        await Promise.all([
          transaction.get(gameRef),
          transaction.get(confirmationRef),
          transaction.get(userRef),
          transaction.get(photoRef),
          transaction.get(activePhotosQuery),
        ]);

      if (existingSnap.exists) {
        const existing = existingSnap.data() ?? {};
        if (existing.storage_path !== storagePath || existing.uploaded_by !== uid) {
          throw new HttpsError("already-exists", "Este upload ja foi utilizado.");
        }
        return {success: true, photoId: photoRef.id, alreadyExists: true};
      }

      if (!gameSnap.exists) {
        throw new HttpsError("not-found", "Jogo nao encontrado.");
      }
      const game = gameSnap.data() ?? {};
      if (game.status !== "FINISHED") {
        throw new HttpsError(
          "failed-precondition",
          "Fotos so podem ser enviadas apos o jogo terminar."
        );
      }

      const confirmed = confirmationSnap.exists &&
        confirmationSnap.data()?.status === "CONFIRMED";
      if (!confirmed && !isGameManager(game, uid, isAdmin)) {
        throw new HttpsError(
          "permission-denied", "Usuario nao pode enviar foto neste jogo."
        );
      }

      const activeDocs = activeSnap.docs.filter((doc) => doc.id !== photoRef.id);
      if (activeDocs.length >= MAX_PHOTOS_PER_GAME) {
        throw new HttpsError(
          "resource-exhausted", "Limite de fotos do jogo atingido."
        );
      }
      if (activeDocs.filter((doc) => doc.get("uploaded_by") === uid).length >=
          MAX_PHOTOS_PER_USER_PER_GAME) {
        throw new HttpsError(
          "resource-exhausted", "Limite de fotos do usuario atingido."
        );
      }

      const profile = userSnap.data();
      const uploadedByName = profileString(profile, "name", "displayName") ||
        profileString(auth.token as Record<string, unknown>, "name") || "Jogador";
      const uploadedByPhoto = profileString(profile, "photo_url", "photoUrl") ||
        profileString(auth.token as Record<string, unknown>, "picture");

      transaction.create(photoRef, {
        game_id: gameId,
        url: storedObject.url,
        storage_path: storagePath,
        uploaded_by: uid,
        uploaded_by_name: uploadedByName.slice(0, 120),
        uploaded_by_photo: uploadedByPhoto.slice(0, 2048),
        content_type: storedObject.contentType,
        size: storedObject.size,
        caption,
        reactions: {},
        status: "ACTIVE",
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      return {success: true, photoId: photoRef.id, alreadyExists: false};
    });
  }
);

/**
 * Normaliza e valida a legenda da foto.
 * @param {unknown} value Legenda recebida.
 * @return {string} Legenda normalizada.
 */
function normalizeCaption(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_CAPTION_LENGTH) {
    throw new HttpsError("invalid-argument", "Legenda invalida.");
  }
  return value.trim();
}
