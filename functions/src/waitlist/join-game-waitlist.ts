import * as admin from "firebase-admin";
import {HttpsError, onCall, type CallableRequest} from "firebase-functions/v2/https";
import {FUNCTION_REGION} from "../constants";

export interface JoinGameWaitlistData {
  gameId?: unknown;
  position?: unknown;
}

export interface JoinGameWaitlistResult {
  success: true;
  alreadyActive: boolean;
  entryId: string;
  queuePosition: number;
}

/**
 * Retorna a instância compartilhada do Firestore Admin.
 * @return {object} instância do Firestore
 */
function getDb() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

/**
 * Executa o join idempotente e atribui a posição dentro de uma transação.
 * @param {CallableRequest<JoinGameWaitlistData>} request chamada autenticada
 * @return {Promise<JoinGameWaitlistResult>} resultado canônico do join
 */
export async function joinGameWaitlistHandler(
  request: CallableRequest<JoinGameWaitlistData>,
): Promise<JoinGameWaitlistResult> {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const gameId = request.data?.gameId;
  const position = request.data?.position;
  if (typeof gameId !== "string" || gameId.trim() === "") {
    throw new HttpsError("invalid-argument", "gameId is required");
  }
  if (typeof position !== "string" || position.trim() === "") {
    throw new HttpsError("invalid-argument", "position is required");
  }

  const db = getDb();
  const gameRef = db.collection("games").doc(gameId);
  const entryRef = gameRef.collection("waitlist").doc(uid);
  const gameSnap = await gameRef.get();
  if (!gameSnap.exists) throw new HttpsError("not-found", "Game not found");

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.data() ?? {};
  const entry = await db.runTransaction(async (tx) => {
    const [current, active] = await Promise.all([
      tx.get(entryRef),
      tx.get(gameRef.collection("waitlist")
        .where("status", "in", ["WAITING", "NOTIFIED"])),
    ]);
    const currentData = current.data();
    if (current.exists && ["WAITING", "NOTIFIED"].includes(currentData?.status)) {
      return {alreadyActive: true, queuePosition: Number(currentData?.queue_position) || 0};
    }

    const maxPosition = active.docs.reduce((max, doc) => {
      const value = Number(doc.data().queue_position);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);
    const queuePosition = maxPosition + 1;
    const token = (request.auth?.token ?? {}) as Record<string, unknown>;
    const userName = [user.display_name, user.name, token.name]
      .find((value): value is string => typeof value === "string" && value.trim() !== "") ??
      "Jogador";
    const userPhoto = [user.photo_url, user.photoURL, token.picture]
      .find((value): value is string => typeof value === "string" && value.trim() !== "") ??
      null;
    tx.set(entryRef, {
      game_id: gameId,
      user_id: uid,
      user_name: userName,
      user_photo: userPhoto,
      position,
      queue_position: queuePosition,
      status: "WAITING",
      added_at: admin.firestore.FieldValue.serverTimestamp(),
      notified_at: null,
      response_deadline: null,
    });
    return {alreadyActive: false, queuePosition};
  });

  return {
    success: true,
    alreadyActive: entry.alreadyActive,
    entryId: uid,
    queuePosition: entry.queuePosition,
  };
}

export const joinGameWaitlist = onCall(
  {region: FUNCTION_REGION},
  joinGameWaitlistHandler,
);
