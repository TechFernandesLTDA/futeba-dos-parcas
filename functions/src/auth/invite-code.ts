import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {randomBytes} from "crypto";
import {checkRateLimit} from "../middleware/rate-limiter";
import {FUNCTION_REGION} from "../constants";

const db = () => admin.firestore();

/**
 * Gera um codigo alfanumerico aleatorio usando crypto.randomBytes.
 * @param {number} length - Comprimento do codigo (default 6)
 * @return {string} Codigo gerado
 */
function generateInviteCode(length = 6): string {
  // FIX #2650: substitui Math.random() por crypto.randomBytes para
  // aleatoriedade criptograficamente segura.
  return randomBytes(length)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .substring(0, length)
    .toUpperCase();
}

/**
 * Gera um invite_code unico consultando se ja existe no Firestore.
 */
async function generateUniqueCode(): Promise<string> {
  const usersRef = db().collection("users");
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const snap = await usersRef.where("invite_code", "==", code).limit(1).get();
    if (snap.empty) return code;
  }
  return generateInviteCode(8);
}

/**
 * Firestore trigger: ao criar um novo usuario, gera um invite_code
 * unico de 6 caracteres se ainda nao existir.
 */
export const onUserCreatedGenerateInviteCode = onDocumentCreated(
  {
    document: "users/{userId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const userId = event.params.userId;
    const data = event.data?.data();
    if (!data) {
      logger.warn("onUserCreatedGenerateInviteCode: null data for", userId);
      return;
    }

    // Se já tem invite_code, não sobrescreve
    if (data.invite_code) {
      logger.info("User already has invite_code, skipping", userId);
      return;
    }

    const inviteCode = await generateUniqueCode();
    const userRef = db().collection("users").doc(userId);

    await userRef.update({
      invite_code: inviteCode,
      invite_count: 0,
    });

    logger.info("Generated invite code for user", {userId});
  }
);

/**
 * Firestore trigger: ao criar um novo usuario, se houver invited_by,
 * incrementa o invite_count do inviter.
 */
export const onUserCreatedProcessInvite = onDocumentCreated(
  {
    document: "users/{userId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const userId = event.params.userId;
    const data = event.data?.data();
    if (!data) return;

    const invitedByUid = data.invited_by as string | undefined;
    if (!invitedByUid) return;

    // FIX #2650: validate that the invite code is NOT triggered by
    // an invite code field from the requesting user itself (self-referral).
    if (invitedByUid === userId) {
      logger.warn("Self-referral blocked", {userId});
      return;
    }

    try {
      const inviterRef = db().collection("users").doc(invitedByUid);
      const inviterDoc = await inviterRef.get();

      if (!inviterDoc.exists) {
        logger.warn("Inviter not found", {invitedByUid});
        return;
      }

      // FIX #2650: validate that the inviter actually has an invite_code.
      // invited_by is a client-writable field — must be verified server-side.
      const inviterData = inviterDoc.data();
      if (!inviterData?.invite_code || typeof inviterData.invite_code !== "string") {
        logger.warn("Inviter has no invite_code — possible client forgery", {
          invitedByUid,
          newUser: userId,
        });
        return;
      }

      // FIX #2650: use FieldValue.increment(1) instead of read-then-update
      // to avoid race conditions on concurrent invites.
      await inviterRef.update({
        invite_count: FieldValue.increment(1),
      });

      logger.info("Incremented invite count for inviter", {
        inviterUid: invitedByUid,
        invitedUser: userId,
      });
    } catch (err) {
      logger.error("Failed to process invite for user", {userId, err});
    }
  }
);

/**
 * Callable: gera um invite_code para o usuario autenticado
 * se ele ainda nao tiver um. Usuarios existentes podem chamar
 * essa funcao para obter seu codigo de convite.
 */
export const generateMyInviteCode = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  },
  async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "Voce precisa estar logado.");
      }

      // #2283: rate limiting — 3 geracoes por hora
      const rl = await checkRateLimit(uid, {
        maxRequests: 3,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "generate_invite_code",
      });
      if (!rl.allowed) {
        throw new HttpsError("resource-exhausted", "Muitas tentativas. Tente novamente mais tarde.");
      }

      const userRef = db().collection("users").doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "Usuário não encontrado.");
      }

      const existingCode = userDoc.data()?.invite_code as string | undefined;
      if (existingCode) return {inviteCode: existingCode};

      const inviteCode = await generateUniqueCode();

      await userRef.update({
        invite_code: inviteCode,
        invite_count: userDoc.data()?.invite_count || 0,
      });

      logger.info("Generated invite code on demand", {uid});

      return {inviteCode};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("generateMyInviteCode failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);
