import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {randomInt} from "crypto";
import {
  checkRateLimit,
  checkRateLimitByIp,
} from "../middleware/rate-limiter";
import {FUNCTION_REGION} from "../constants";
import {clientIp} from "./anti-abuse";
import {getLevelForXp} from "../xp/pipeline";

const db = () => admin.firestore();
const INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const APP_INVITE_ACCEPTED_XP = 50;
const PENDING_APP_INVITE_TTL_MS = 30 * 60 * 1000;

interface InviteValidationResult {
  valid: boolean;
  inviteCode?: string;
  inviterName?: string;
  xpReward?: number;
}

interface PendingAppInvite {
  inviteCode: string;
  inviterId?: string;
  inviterName?: string;
}

/**
 * Normaliza codigo de convite para o formato canonico.
 * @param {unknown} input Valor recebido da callable ou do Firestore.
 * @return {string} Codigo em uppercase, apenas A-Z0-9.
 */
function normalizeInviteCode(input: unknown): string {
  return typeof input === "string" ?
    input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") :
    "";
}

/**
 * Converte timestamps Firestore/Date para millis sem depender do SDK em testes.
 * @param {unknown} value Timestamp, Date ou numero.
 * @return {number|null} Epoch millis, se reconhecido.
 */
function timestampLikeToMillis(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value) {
    const toMillis = (value as {toMillis?: () => number}).toMillis;
    if (typeof toMillis === "function") return toMillis.call(value);
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as {toDate?: () => Date}).toDate;
    if (typeof toDate === "function") return toDate.call(value).getTime();
  }
  return null;
}

/**
 * Registra convite pendente para fluxos Google onde o Auth user ja existe
 * antes do doc users/{uid}. O trigger de criacao usa isso como fallback caso
 * o profile seja criado por uma corrida sem invited_by_code.
 * @param {string | undefined} uid Usuario autenticado que validou o convite.
 * @param {string} inviteCode Codigo validado.
 * @param {{uid: string, name: string}} inviter Dono do codigo.
 */
async function persistPendingInviteForAuthUser(
  uid: string | undefined,
  inviteCode: string,
  inviter: {uid: string; name: string}
): Promise<void> {
  if (!uid || uid === inviter.uid) return;

  await db()
    .collection("pending_app_invites")
    .doc(uid)
    .set({
      invite_code: inviteCode,
      inviter_id: inviter.uid,
      inviter_name: inviter.name,
      source: "validateInviteCode",
      created_at: FieldValue.serverTimestamp(),
      expires_at: new Date(Date.now() + PENDING_APP_INVITE_TTL_MS),
    }, {merge: true});
}

/**
 * Busca convite pendente ainda valido para um usuario.
 * @param {string} userId Usuario recem-criado.
 * @return {Promise<PendingAppInvite|null>} Convite pendente valido, se houver.
 */
async function findPendingInviteForUser(
  userId: string
): Promise<PendingAppInvite | null> {
  const pendingDoc = await db()
    .collection("pending_app_invites")
    .doc(userId)
    .get();
  if (!pendingDoc.exists) return null;

  const pendingData = pendingDoc.data() || {};
  const expiresAt = timestampLikeToMillis(pendingData.expires_at);
  if (expiresAt !== null && expiresAt < Date.now()) {
    logger.warn("Pending app invite expired before user profile creation", {
      userId,
    });
    return null;
  }

  const inviteCode = normalizeInviteCode(pendingData.invite_code);
  if (!inviteCode) return null;

  return {
    inviteCode,
    inviterId: typeof pendingData.inviter_id === "string" ?
      pendingData.inviter_id :
      undefined,
    inviterName: typeof pendingData.inviter_name === "string" ?
      pendingData.inviter_name :
      undefined,
  };
}

/**
 * Resolve o padrinho dono de um codigo de convite.
 * @param {string} code Codigo de convite canonico.
 * @return {Promise<object|null>} Dados publicos do padrinho ou null.
 */
async function findInviterByCode(code: string): Promise<{
  uid: string;
  name: string;
  data: FirebaseFirestore.DocumentData;
} | null> {
  if (!/^[A-Z0-9]{6,10}$/.test(code)) return null;

  const inviteCodeDoc = await db()
    .collection("invite_codes")
    .doc(code)
    .get();
  if (inviteCodeDoc.exists && inviteCodeDoc.data()?.active === false) {
    return null;
  }

  const snap = await db()
    .collection("users")
    .where("invite_code", "==", code)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  const data = doc.data();
  if (data.deleted_at) return null;

  return {
    uid: doc.id,
    name: typeof data.name === "string" && data.name.trim() ?
      data.name.trim() :
      "Membro Futeba",
    data,
  };
}

/**
 * Garante que invite_codes/{code} tenha owner para rules e cadastros.
 * @param {string} code Codigo de convite canonico.
 * @param {{uid: string, name: string}} inviter Dono do codigo.
 * @return {Promise<void>} Promise resolvida apos persistir o lock.
 */
async function syncInviteCodeOwner(
  code: string,
  inviter: {uid: string; name: string}
): Promise<void> {
  const inviteCodeRef = db()
    .collection("invite_codes")
    .doc(code);
  const inviteCodeDoc = await inviteCodeRef.get();

  const payload: Record<string, unknown> = {
    user_id: inviter.uid,
    inviter_name: inviter.name,
    updated_at: FieldValue.serverTimestamp(),
  };

  if (!inviteCodeDoc.exists) {
    payload.active = true;
    payload.created_at = FieldValue.serverTimestamp();
  }

  await inviteCodeRef.set(payload, {merge: true});
}

/**
 * Gera um codigo alfanumerico aleatorio usando crypto.randomInt.
 * @param {number} length - Comprimento do codigo (default 6)
 * @return {string} Codigo gerado
 */
function generateInviteCode(length = 6): string {
  // FIX #2650: substitui Math.random() por crypto.randomInt para
  // aleatoriedade criptograficamente segura.
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Reserva um invite_code atomicamente via colecao invite_codes.
 * FIX #2650: o padrao anterior (check-then-write em users) tinha
 * race condition entre usuarios criados simultaneamente — ambos
 * podiam receber o mesmo codigo. Agora usamos invite_codes/{code}
 * como lock atomico: Firestore garante que dois docs com o mesmo ID
 * nunca sao criados concorrentemente.
 * @param {{uid: string, name: string}|undefined} owner Dono opcional.
 * @return {Promise<string>} Codigo unico reservado.
 */
async function generateUniqueCode(owner?: {
  uid: string;
  name?: string;
}): Promise<string> {
  const inviteCodesRef = db().collection("invite_codes");
  for (const length of [6, 8]) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode(length);
      try {
        await inviteCodesRef.doc(code).create({
          ...(owner ? {
            user_id: owner.uid,
            inviter_name: owner.name || "Membro Futeba",
            active: true,
          } : {}),
          created_at: FieldValue.serverTimestamp(),
        });
        return code;
      } catch (e: unknown) {
        if ((e as {code?: number}).code === 6) continue; // ALREADY_EXISTS
        throw e;
      }
    }
  }

  while (true) {
    const code = generateInviteCode(10);
    try {
      await inviteCodesRef.doc(code).create({
        ...(owner ? {
          user_id: owner.uid,
          inviter_name: owner.name || "Membro Futeba",
          active: true,
        } : {}),
        created_at: FieldValue.serverTimestamp(),
      });
      return code;
    } catch (e: unknown) {
      if ((e as {code?: number}).code === 6) continue; // ALREADY_EXISTS
      throw e;
    }
  }
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

    const displayName = typeof data.name === "string" ?
      data.name :
      "Membro Futeba";
    const inviteCode = await generateUniqueCode({
      uid: userId,
      name: displayName,
    });
    const userRef = db().collection("users").doc(userId);

    try {
      await userRef.update({
        invite_code: inviteCode,
        invite_count: 0,
      });
    } catch (e: unknown) {
      // #2782: o doc users/{uid} pode ter sido deletado entre o evento
      // CREATE e a execução (assíncrona) deste trigger — comum no test
      // harness do emulador, onde o cleanup deleta os users de teste antes
      // dos triggers drenarem. update() lança 5 NOT_FOUND → função morta →
      // "socket hang up". No emulador tratamos como no-op (retry é inútil:
      // o doc não vai voltar). Produção mantém o re-throw original.
      if (
        process.env.FUNCTIONS_EMULATOR === "true" &&
        (e as {code?: number} | null)?.code === 5
      ) {
        logger.warn(
          "onUserCreatedGenerateInviteCode: user doc removido antes do " +
          "update no emulador; ignorando",
          {userId}
        );
        return;
      }
      throw e;
    }

    logger.info("Generated invite code for user", {userId});
  }
);

/**
 * Firestore trigger: ao criar um novo usuario, valida o codigo de
 * apadrinhamento, registra aceite auditavel e credita XP ao padrinho.
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

    let inviteCode = normalizeInviteCode(data.invited_by_code);
    const pendingInvite = inviteCode ?
      null :
      await findPendingInviteForUser(userId);
    if (!inviteCode && pendingInvite?.inviteCode) {
      inviteCode = pendingInvite.inviteCode;
      logger.info("Recovered app invite code from pending validation", {
        userId,
        inviteCode,
      });
    }

    if (!inviteCode) {
      logger.warn("User created without app invite code", {userId});
      return;
    }

    const inviter = await findInviterByCode(inviteCode);
    if (!inviter) {
      // #3187: antes era um no-op silencioso — contas criadas com codigo
      // desconhecido ficavam invisiveis. Marca o doc com invite_status pra
      // ficar queryavel em auditoria. NAO deleta a conta server-side
      // (blocking functions fora de escopo — tracked #940).
      logger.warn("Invalid app invite code on user creation", {
        userId,
        inviteCode,
      });
      try {
        await db()
          .collection("users")
          .doc(userId)
          .set({invite_status: "INVALID_CODE"}, {merge: true});
      } catch (markErr) {
        logger.error("Failed to mark user with INVALID_CODE invite status", {
          userId,
          markErr,
        });
      }
      return;
    }

    const invitedByUid = inviter.uid;
    if (pendingInvite?.inviterId && pendingInvite.inviterId !== invitedByUid) {
      logger.warn("Pending app invite owner mismatch", {
        userId,
        inviteCode,
        pendingInviterId: pendingInvite.inviterId,
        resolvedInviterId: invitedByUid,
      });
      return;
    }

    // FIX #2650: validate that the invite code is NOT triggered by
    // an invite code field from the requesting user itself (self-referral).
    if (invitedByUid === userId) {
      logger.warn("Self-referral blocked", {userId});
      return;
    }

    try {
      await syncInviteCodeOwner(inviteCode, {
        uid: invitedByUid,
        name: inviter.name,
      });

      const inviterRef = db().collection("users").doc(invitedByUid);
      const invitedUserRef = db().collection("users").doc(userId);
      const redemptionRef = db()
        .collection("app_invite_redemptions")
        .doc(userId);
      const xpLogRef = db()
        .collection("xp_logs")
        .doc(`app_invite_${invitedByUid}_${userId}`);

      const processed = await db().runTransaction(async (tx) => {
        const [inviterDoc, redemptionDoc] = await Promise.all([
          tx.get(inviterRef),
          tx.get(redemptionRef),
        ]);

        if (redemptionDoc.exists) {
          logger.info("App invite already redeemed, skipping", {
            invitedByUid,
            invitedUser: userId,
          });
          return false;
        }

        if (!inviterDoc.exists) {
          logger.warn("Inviter not found", {invitedByUid});
          return false;
        }

        const inviterData = inviterDoc.data();
        if (inviterData?.invite_code !== inviteCode) {
          logger.warn("Invite code owner mismatch", {
            invitedByUid,
            invitedUser: userId,
            inviteCode,
          });
          return false;
        }

        const xpBefore =
          (inviterData?.experience_points as number | undefined) || 0;
        const levelBefore =
          (inviterData?.level as number | undefined) ||
          getLevelForXp(xpBefore);
        const xpAfter = xpBefore + APP_INVITE_ACCEPTED_XP;
        const levelAfter = getLevelForXp(xpAfter);
        const now = FieldValue.serverTimestamp();

        tx.update(inviterRef, {
          invite_count: FieldValue.increment(1),
          experience_points: FieldValue.increment(APP_INVITE_ACCEPTED_XP),
          level: levelAfter,
        });

        tx.update(invitedUserRef, {
          invited_by: invitedByUid,
          invited_by_code: inviteCode,
          invite_accepted_at: now,
          invite_source: data.invite_source ||
            (pendingInvite ? "pending_validation" : "profile_create"),
        });

        tx.set(redemptionRef, {
          invite_code: inviteCode,
          inviter_id: invitedByUid,
          inviter_name: inviter.name,
          invited_user_id: userId,
          invited_user_email:
            typeof data.email === "string" ? data.email : null,
          accepted_at: now,
          xp_awarded: APP_INVITE_ACCEPTED_XP,
          xp_log_id: xpLogRef.id,
          source: "first_access",
        });

        tx.set(xpLogRef, {
          user_id: invitedByUid,
          game_id: `app_invite:${userId}`,
          transaction_id: xpLogRef.id,
          source: "app_invite_accepted",
          source_collection: "app_invite_redemptions",
          source_event_id: userId,
          source_confirmation_id: userId,
          xp_earned: APP_INVITE_ACCEPTED_XP,
          xp_before: xpBefore,
          xp_after: xpAfter,
          level_before: levelBefore,
          level_after: levelAfter,
          xp_participation: 0,
          xp_goals: 0,
          xp_assists: 0,
          xp_saves: 0,
          xp_result: 0,
          xp_mvp: 0,
          xp_clean_sheet: 0,
          xp_milestones: APP_INVITE_ACCEPTED_XP,
          xp_streak: 0,
          xp_penalty: 0,
          goals: 0,
          assists: 0,
          saves: 0,
          was_mvp: false,
          was_clean_sheet: false,
          was_worst_player: false,
          game_result: "APP_INVITE",
          game_status: "FINISHED",
          my_team_score: 0,
          opponent_score: 0,
          milestones_unlocked: ["APP_INVITE_ACCEPTED"],
          created_at: now,
        });
        return true;
      });

      if (processed) {
        logger.info("Processed app invite for inviter", {
          inviterUid: invitedByUid,
          invitedUser: userId,
          xpAwarded: APP_INVITE_ACCEPTED_XP,
        });
      }
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
      if (existingCode) {
        await syncInviteCodeOwner(existingCode, {
          uid,
          name: (userDoc.data()?.name as string | undefined) ||
            request.auth?.token?.name as string | undefined ||
            "Membro Futeba",
        });
        return {inviteCode: existingCode};
      }

      const inviteCode = await generateUniqueCode({
        uid,
        name: (userDoc.data()?.name as string | undefined) ||
          request.auth?.token?.name as string | undefined ||
          "Membro Futeba",
      });

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

/**
 * Callable publico: valida um codigo de apadrinhamento antes do cadastro.
 * Tambem repara o lock invite_codes/{code} para codigos legados que ainda
 * existiam apenas em users/{uid}.invite_code.
 */
export const validateInviteCode = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  },
  async (request): Promise<InviteValidationResult> => {
    const ip = clientIp(request);
    const rl = await checkRateLimitByIp(ip, {
      maxRequests: 30,
      windowMs: 60 * 1000,
      keyPrefix: "validate_invite_code",
    });
    if (!rl.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "Muitas tentativas. Tente novamente mais tarde."
      );
    }

    const inviteCode = normalizeInviteCode(
      (request.data as {inviteCode?: unknown} | undefined)?.inviteCode
    );
    const inviter = await findInviterByCode(inviteCode);
    if (!inviter) {
      return {valid: false};
    }

    if (request.auth?.uid && request.auth.uid === inviter.uid) {
      return {valid: false};
    }

    await syncInviteCodeOwner(inviteCode, {
      uid: inviter.uid,
      name: inviter.name,
    });

    await persistPendingInviteForAuthUser(
      request.auth?.uid,
      inviteCode,
      {
        uid: inviter.uid,
        name: inviter.name,
      }
    );

    return {
      valid: true,
      inviteCode,
      inviterName: inviter.name,
      xpReward: APP_INVITE_ACCEPTED_XP,
    };
  }
);
