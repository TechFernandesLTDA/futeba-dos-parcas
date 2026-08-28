import * as admin from "firebase-admin";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {secureCallable} from "../middleware/secure-callable-wrapper";

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

// FIX #4081: teto de fila por jogo, aplicado na transação. Sem este teto um
// caller autenticado criava entradas de waitlist em loop (escrita não-medida
// em coleção sem TTL + um trigger onGameVacancy por entrada).
export const MAX_WAITLIST_PER_GAME = 200;

const POSITION_FIELD = "FIELD";
const POSITION_GOALKEEPER = "GOALKEEPER";

/**
 * Retorna a instância compartilhada do Firestore Admin.
 * @return {object} instância do Firestore
 */
function getDb() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

/**
 * Normaliza a posição do jogador contra o enum do domínio.
 * Qualquer valor diferente de `GOALKEEPER` (inclusive ausente/inválido)
 * colapsa para `FIELD`, o default do DTO.
 * @param {unknown} value Posição crua recebida.
 * @return {string} Posição normalizada.
 */
function normalizePosition(value: unknown): string {
  return value === POSITION_GOALKEEPER ? POSITION_GOALKEEPER : POSITION_FIELD;
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
 * Reconhece somente os contratos públicos suportados pelo produto.
 * @param {FirebaseFirestore.DocumentData} game Documento atual do jogo.
 * @return {boolean} Se o jogo aceita participantes externos ao grupo.
 */
function isOpenToPublic(game: FirebaseFirestore.DocumentData): boolean {
  return game.visibility === "PUBLIC_OPEN" ||
    (game.is_public === true && !game.visibility);
}

/**
 * Executa o join idempotente e atribui a posição dentro de uma transação.
 * A transação revalida estado do jogo e autorização do caller para impedir
 * bypass por cliente (o write roda via Admin SDK e ignora as firestore.rules).
 * @param {CallableRequest<JoinGameWaitlistData>} request chamada autenticada
 * @return {Promise<JoinGameWaitlistResult>} resultado canônico do join
 */
export async function joinGameWaitlistHandler(
  request: CallableRequest<JoinGameWaitlistData>,
): Promise<JoinGameWaitlistResult> {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const gameId = request.data?.gameId;
  if (typeof gameId !== "string" || gameId.trim() === "") {
    throw new HttpsError("invalid-argument", "gameId is required");
  }
  const position = normalizePosition(request.data?.position);

  const db = getDb();
  const gameRef = db.collection("games").doc(gameId);
  const entryRef = gameRef.collection("waitlist").doc(uid);
  const confirmationRef = db.collection("confirmations").doc(`${gameId}_${uid}`);
  const isAdmin = ((request.auth?.token ?? {}) as Record<string, unknown>)
    .role === "ADMIN";

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.data() ?? {};
  const entry = await db.runTransaction(async (tx) => {
    const gameSnap = await tx.get(gameRef);
    if (!gameSnap.exists) throw new HttpsError("not-found", "Game not found");
    const game = gameSnap.data() ?? {};

    const status = game.status;
    if (status !== "SCHEDULED" && status !== "CONFIRMED") {
      throw new HttpsError(
        "permission-denied",
        "Este jogo não aceita novas entradas na fila de espera."
      );
    }

    const rawGroupId = game.group_id ?? game.groupId;
    const groupId = typeof rawGroupId === "string" ? rawGroupId.trim() : "";
    let isActiveMember = false;
    if (groupId) {
      const memberSnap = await tx.get(
        db.collection("groups").doc(groupId).collection("members").doc(uid)
      );
      if (memberSnap.exists) {
        const membership = memberSnap.data() ?? {};
        isActiveMember =
          membership.user_id === uid && membership.status === "ACTIVE";
      }
    }
    if (!isGameManager(game, uid, isAdmin) &&
        !isActiveMember &&
        !isOpenToPublic(game)) {
      throw new HttpsError(
        "permission-denied",
        "Você precisa pertencer ao grupo deste jogo para entrar na fila."
      );
    }

    const confirmationSnap = await tx.get(confirmationRef);
    const alreadyConfirmed = confirmationSnap.exists &&
      confirmationSnap.data()?.status === "CONFIRMED";
    if (alreadyConfirmed) {
      throw new HttpsError(
        "permission-denied",
        "Você já está confirmado neste jogo."
      );
    }

    const [current, active] = await Promise.all([
      tx.get(entryRef),
      tx.get(gameRef.collection("waitlist")
        .where("status", "in", ["WAITING", "NOTIFIED"])),
    ]);
    const currentData = current.data();
    if (current.exists && ["WAITING", "NOTIFIED"].includes(currentData?.status)) {
      return {alreadyActive: true, queuePosition: Number(currentData?.queue_position) || 0};
    }

    if (active.docs.length >= MAX_WAITLIST_PER_GAME) {
      throw new HttpsError(
        "resource-exhausted",
        "A fila de espera deste jogo está cheia."
      );
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

export const joinGameWaitlist = secureCallable<
  JoinGameWaitlistData,
  JoinGameWaitlistResult
>(
  {
    rateLimit: {
      maxRequests: 10,
      windowMs: 60_000,
      keyPrefix: "waitlist_join",
    },
    consumeAppCheckToken: true,
    auditLogContext: async (r) => ({gameId: r.data?.gameId}),
  },
  joinGameWaitlistHandler,
);
