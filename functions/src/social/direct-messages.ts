/* istanbul ignore file -- callable wrapper exercised through Firestore/emulator social suites. */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";

interface CreateDirectChatRequest {
  targetUid: string;
}

interface PublicUser {
  name: string;
  photo: string | null;
}

/**
 * Valida string nao vazia.
 *
 * @param {unknown} value Valor cru.
 * @return {boolean} true quando string util.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Parseia payload do callable.
 *
 * @param {unknown} data Payload cru.
 * @return {CreateDirectChatRequest} Payload normalizado.
 */
function parseCreateDirectChatRequest(
  data: unknown
): CreateDirectChatRequest {
  if (!isRecord(data) || !isNonEmptyString(data.targetUid)) {
    throw new HttpsError("invalid-argument", "targetUid obrigatório.");
  }
  return {targetUid: data.targetUid.trim()};
}

/**
 * Retorna chatId deterministico para dois UIDs.
 *
 * @param {string} uidA Primeiro UID.
 * @param {string} uidB Segundo UID.
 * @return {string} Chat ID ordenado.
 */
export function buildDirectChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

/**
 * Nome publico para metadata de participante.
 *
 * @param {string} uid UID.
 * @return {Promise<PublicUser>} Dados publicos.
 */
async function getPublicUser(uid: string): Promise<PublicUser> {
  const snap = await db().doc(`users/${uid}`).get();
  const data = snap.data() ?? {};
  const name = data.name;
  const photo = data.photo_url ?? data.photoUrl;
  return {
    name: isNonEmptyString(name) ? name : "Jogador",
    photo: isNonEmptyString(photo) ? photo : null,
  };
}

/**
 * Verifica bloqueio social entre os participantes.
 *
 * @param {string} uidA Primeiro UID.
 * @param {string} uidB Segundo UID.
 * @return {Promise<boolean>} true se algum lado bloqueou o outro.
 */
async function hasSocialBlock(uidA: string, uidB: string): Promise<boolean> {
  const [aBlocksB, bBlocksA] = await Promise.all([
    db().doc(`users/${uidA}/blocked/${uidB}`).get(),
    db().doc(`users/${uidB}/blocked/${uidA}`).get(),
  ]);
  return aBlocksB.exists || bBlocksA.exists;
}

/**
 * Verifica se usuarios compartilham algum grupo ativo.
 *
 * @param {string} uidA Primeiro UID.
 * @param {string} uidB Segundo UID.
 * @return {Promise<boolean>} true se compartilham grupo.
 */
async function shareActiveGroup(uidA: string, uidB: string): Promise<boolean> {
  const memberships = await db()
    .collectionGroup("members")
    .where("user_id", "==", uidA)
    .where("status", "==", "ACTIVE")
    .limit(20)
    .get();

  for (const member of memberships.docs) {
    const groupRef = member.ref.parent.parent;
    if (!groupRef) continue;
    const peer = await groupRef.collection("members").doc(uidB).get();
    if (peer.exists && peer.data()?.status === "ACTIVE") return true;
  }
  return false;
}

/**
 * Verifica se usuarios participaram confirmados de algum jogo comum.
 *
 * @param {string} uidA Primeiro UID.
 * @param {string} uidB Segundo UID.
 * @return {Promise<boolean>} true se compartilham jogo.
 */
async function shareConfirmedGame(uidA: string, uidB: string): Promise<boolean> {
  const confirmations = await db()
    .collection("confirmations")
    .where("user_id", "==", uidA)
    .where("status", "==", "CONFIRMED")
    .limit(50)
    .get();

  for (const confirmation of confirmations.docs) {
    const gameId = confirmation.data().game_id;
    if (!isNonEmptyString(gameId)) continue;
    const peer = await db().doc(`confirmations/${gameId}_${uidB}`).get();
    if (peer.exists && peer.data()?.status === "CONFIRMED") return true;
  }
  return false;
}

/**
 * Cria ou retorna chat direto 1:1 apos validar anti-cold-DM e bloqueio social.
 */
export const createDirectChat = onCall(
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
    const {targetUid} = parseCreateDirectChatRequest(request.data);
    if (targetUid === uid) {
      throw new HttpsError(
        "failed-precondition",
        "Você não pode iniciar conversa consigo mesmo."
      );
    }

    if (await hasSocialBlock(uid, targetUid)) {
      throw new HttpsError(
        "permission-denied",
        "Conversa indisponível por bloqueio social."
      );
    }

    const [sharedGroup, sharedGame] = await Promise.all([
      shareActiveGroup(uid, targetUid),
      shareConfirmedGame(uid, targetUid),
    ]);
    if (!sharedGroup && !sharedGame) {
      throw new HttpsError(
        "permission-denied",
        "Você só pode enviar DM para quem já jogou ou participa de grupo com você."
      );
    }

    const chatId = buildDirectChatId(uid, targetUid);
    const chatRef = db().doc(`chats/${chatId}`);
    const [currentUser, targetUser] = await Promise.all([
      getPublicUser(uid),
      getPublicUser(targetUid),
    ]);

    await db().runTransaction(async (tx) => {
      const chatSnap = await tx.get(chatRef);
      if (chatSnap.exists) return;

      tx.set(chatRef, {
        participants: [uid, targetUid].sort(),
        participant_names: {
          [uid]: currentUser.name,
          [targetUid]: targetUser.name,
        },
        participant_photos: {
          [uid]: currentUser.photo,
          [targetUid]: targetUser.photo,
        },
        created_at: FieldValue.serverTimestamp(),
        created_by: uid,
        last_message: null,
        last_message_at: null,
        last_sender_id: null,
        unread_count: {
          [uid]: 0,
          [targetUid]: 0,
        },
      });
    });

    return {chatId};
  }
);
