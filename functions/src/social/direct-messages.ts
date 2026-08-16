/* istanbul ignore file -- callable wrapper exercised through Firestore/emulator social suites. */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";
import {checkRateLimit} from "../middleware/rate-limiter";

interface CreateDirectChatRequest {
  targetUid: string;
}

interface SubmitDirectMessageRequest {
  chatId: string;
  text: string;
}

interface PublicUser {
  name: string;
  photo: string | null;
}

/**
 * Retorna true para perfil ausente logicamente/inativo.
 * @param {Record<string, unknown>} data Perfil público persistido.
 * @return {boolean} Se o perfil não pode participar de conversas.
 */
function isUnavailableUser(data: Record<string, unknown>): boolean {
  return data.deleted_at != null ||
    data.deletedAt != null ||
    data.status === "DELETED" ||
    data.is_active === false;
}

const DIRECT_MESSAGE_MAX_LENGTH = 1000;
const DIRECT_MESSAGE_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 1000,
  keyPrefix: "direct_message_send",
};
const DIRECT_CHAT_CREATE_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: "direct_chat_create",
};
const DIRECT_CHAT_MEMBERSHIP_PAGE_SIZE = 20;
const DIRECT_CHAT_CONFIRMATION_PAGE_SIZE = 100;
const FIRESTORE_WHERE_IN_MAX = 10;

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
 * Valida um ID simples antes de interpolá-lo em um caminho Firestore.
 * @param {unknown} value ID recebido.
 * @param {number} maxLength Limite de caracteres.
 * @return {boolean} Se o valor e um segmento seguro.
 */
function isSafeDocumentId(value: unknown, maxLength = 128): value is string {
  return isNonEmptyString(value) &&
    value.trim().length <= maxLength &&
    !value.includes("/");
}

/**
 * Divide IDs em lotes compatíveis com whereIn do Firestore.
 *
 * @param {string[]} values IDs a consultar.
 * @param {number} size Tamanho máximo por lote.
 * @return {Array<string[]>} Lotes preservando a ordem de entrada.
 */
function chunkStrings(values: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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
  if (!isRecord(data) || !isSafeDocumentId(data.targetUid)) {
    throw new HttpsError("invalid-argument", "targetUid obrigatório.");
  }
  return {targetUid: data.targetUid.trim()};
}

/**
 * Parseia payload de envio de mensagem direta.
 *
 * @param {unknown} data Payload cru.
 * @return {SubmitDirectMessageRequest} Payload normalizado.
 */
function parseSubmitDirectMessageRequest(
  data: unknown
): SubmitDirectMessageRequest {
  if (
    !isRecord(data) ||
    !isSafeDocumentId(data.chatId, 300) ||
    !isNonEmptyString(data.text)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "chatId e text são obrigatórios."
    );
  }

  const text = data.text.trim();
  if (text.length > DIRECT_MESSAGE_MAX_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Mensagem deve ter até ${DIRECT_MESSAGE_MAX_LENGTH} caracteres.`
    );
  }

  return {
    chatId: data.chatId.trim(),
    text,
  };
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
  if (
    !snap.exists ||
    isUnavailableUser(data)
  ) {
    throw new HttpsError("not-found", "Perfil não encontrado.");
  }
  return resolvePublicUser(data);
}

/**
 * Normaliza snapshot publico de usuario para metadata do chat.
 *
 * @param {Record<string, unknown>} data Dados crus do usuario.
 * @return {PublicUser} Nome e avatar publicos.
 */
function resolvePublicUser(
  data: Record<string, unknown>
): PublicUser {
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
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let membershipsQuery = db()
      .collectionGroup("members")
      .where("user_id", "==", uidA)
      .where("status", "==", "ACTIVE")
      .limit(DIRECT_CHAT_MEMBERSHIP_PAGE_SIZE)
      // PERF: projection — o doc do membro não é lido, só a ref do grupo.
      .select("user_id");
    if (lastDoc) {
      membershipsQuery = membershipsQuery.startAfter(lastDoc);
    }

    const memberships = await membershipsQuery.get();
    if (memberships.empty) {
      return false;
    }

    const checks = await Promise.all(memberships.docs.map(async (member) => {
      const groupRef = member.ref.parent.parent;
      if (!groupRef) return false;
      const peer = await groupRef.collection("members").doc(uidB).get();
      return peer.exists && peer.data()?.status === "ACTIVE";
    }));
    if (checks.some(Boolean)) {
      return true;
    }

    lastDoc = memberships.docs[memberships.docs.length - 1];
    if (memberships.size < DIRECT_CHAT_MEMBERSHIP_PAGE_SIZE) {
      return false;
    }
  }
}

/**
 * Verifica se usuarios participaram confirmados de algum jogo comum.
 *
 * @param {string} uidA Primeiro UID.
 * @param {string} uidB Segundo UID.
 * @return {Promise<boolean>} true se compartilham jogo.
 */
async function shareConfirmedGame(uidA: string, uidB: string): Promise<boolean> {
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let confirmationsQuery = db()
      .collection("confirmations")
      .where("user_id", "==", uidA)
      .where("status", "==", "CONFIRMED")
      .limit(DIRECT_CHAT_CONFIRMATION_PAGE_SIZE)
      // PERF: projection — só game_id é usado para cruzar com o peer.
      .select("game_id");
    if (lastDoc) {
      confirmationsQuery = confirmationsQuery.startAfter(lastDoc);
    }

    const aConfirmations = await confirmationsQuery.get();
    if (aConfirmations.empty) {
      return false;
    }

    const aGameIds = Array.from(new Set(
      aConfirmations.docs
        .map((confirmation) => confirmation.data().game_id)
        .filter(isNonEmptyString)
    ));

    for (const gameIdChunk of chunkStrings(aGameIds, FIRESTORE_WHERE_IN_MAX)) {
      const bConfirmations = await db()
        .collection("confirmations")
        .where("user_id", "==", uidB)
        .where("game_id", "in", gameIdChunk)
        // PERF: projection — só status é checado.
        .select("status")
        .get();

      if (bConfirmations.docs.some((confirmation) =>
        confirmation.data().status === "CONFIRMED"
      )) {
        return true;
      }
    }

    lastDoc = aConfirmations.docs[aConfirmations.docs.length - 1];
    if (aConfirmations.size < DIRECT_CHAT_CONFIRMATION_PAGE_SIZE) {
      return false;
    }
  }
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
    const rateLimit = await checkRateLimit(uid, DIRECT_CHAT_CREATE_RATE_LIMIT);
    if (!rateLimit.allowed) {
      const resetSec = Math.max(
        1,
        Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      );
      throw new HttpsError(
        "resource-exhausted",
        `Muitas conversas iniciadas. Tente novamente em ${resetSec}s.`,
        {retryAfter: resetSec}
      );
    }

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

    const sharedGroup = await shareActiveGroup(uid, targetUid);
    const sharedGame = sharedGroup ?
      false :
      await shareConfirmedGame(uid, targetUid);
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
      if (chatSnap.exists) {
        const existingParticipants = chatSnap.data()?.participants;
        const expectedParticipants = [uid, targetUid].sort();
        if (
          !Array.isArray(existingParticipants) ||
          existingParticipants.length !== 2 ||
          !expectedParticipants.every(
            (participant, index) =>
              existingParticipants[index] === participant
          )
        ) {
          throw new HttpsError(
            "already-exists",
            "Identificador de conversa em conflito."
          );
        }
        return;
      }

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

/**
 * Envia mensagem direta com rate limit server-side e update atomico
 * do preview/unread_count do chat.
 */
export const submitDirectMessage = onCall(
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
    const {chatId, text} =
      parseSubmitDirectMessageRequest(request.data);

    const rateLimit = await checkRateLimit(uid, DIRECT_MESSAGE_RATE_LIMIT);
    if (!rateLimit.allowed) {
      const resetSec = Math.max(
        1,
        Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
      );
      throw new HttpsError(
        "resource-exhausted",
        `Muitas mensagens. Tente novamente em ${resetSec}s.`,
        {retryAfter: resetSec}
      );
    }

    const chatRef = db().doc(`chats/${chatId}`);
    const messageRef = chatRef.collection("messages").doc();
    const currentUser = await getPublicUser(uid);

    await db().runTransaction(async (tx) => {
      const chatSnap = await tx.get(chatRef);
      if (!chatSnap.exists) {
        throw new HttpsError("not-found", "Conversa não encontrada.");
      }

      const chat = chatSnap.data() ?? {};
      const participants = Array.isArray(chat.participants) ?
        chat.participants.filter((item): item is string =>
          typeof item === "string") :
        [];
      if (
        participants.length !== 2 ||
        new Set(participants).size !== 2 ||
        participants.some((participant) => !isSafeDocumentId(participant)) ||
        buildDirectChatId(participants[0], participants[1]) !== chatId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Conversa possui participantes inválidos."
        );
      }
      if (!participants.includes(uid)) {
        throw new HttpsError(
          "permission-denied",
          "Você não participa desta conversa."
        );
      }

      const recipients = participants.filter((participant) =>
        participant !== uid);
      const participantUserRefs = participants.map((participant) =>
        db().doc(`users/${participant}`)
      );
      const blockRefs = recipients.flatMap((recipient) => [
        db().doc(`users/${uid}/blocked/${recipient}`),
        db().doc(`users/${recipient}/blocked/${uid}`),
      ]);
      const [
        participantUserSnaps,
        blockSnaps,
      ] = await Promise.all([
        Promise.all(
          participantUserRefs.map((userRef) => tx.get(userRef))
        ),
        Promise.all(
          blockRefs.map((blockRef) => tx.get(blockRef))
        ),
      ]);
      if (blockSnaps.some((blockSnap) => blockSnap.exists)) {
        throw new HttpsError(
          "permission-denied",
          "Conversa indisponível por bloqueio social."
        );
      }

      const participantNames: Record<string, string> = {};
      const participantPhotos: Record<string, string | null> = {};
      participantUserSnaps.forEach((participantSnap, index) => {
        const participantId = participants[index];
        const participantData = participantSnap.data() ?? {};
        if (
          !participantSnap.exists ||
          isUnavailableUser(participantData)
        ) {
          throw new HttpsError("not-found", "Perfil não encontrado.");
        }
        const publicUser = resolvePublicUser(
          participantData as Record<string, unknown>
        );
        participantNames[participantId] = publicUser.name;
        participantPhotos[participantId] = publicUser.photo;
      });

      tx.set(messageRef, {
        sender_id: uid,
        sender_name: currentUser.name,
        sender_photo_url: currentUser.photo,
        text,
        created_at: FieldValue.serverTimestamp(),
        deleted_by: null,
        deleted_at: null,
      });

      const unreadUpdates = recipients.reduce<Record<string, unknown>>(
        (acc, participant) => {
          acc[`unread_count.${participant}`] = FieldValue.increment(1);
          return acc;
        },
        {}
      );

      tx.update(chatRef, {
        participant_names: participantNames,
        participant_photos: participantPhotos,
        last_message: text,
        last_message_at: FieldValue.serverTimestamp(),
        last_sender_id: uid,
        [`unread_count.${uid}`]: 0,
        ...unreadUpdates,
      });
    });

    return {messageId: messageRef.id};
  }
);
