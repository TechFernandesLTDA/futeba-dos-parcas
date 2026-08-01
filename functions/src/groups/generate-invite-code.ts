/**
 * Callable: gera codigo de convite de GRUPO no servidor (#3937).
 *
 * Antes, o web gerava o codigo com Math.random() no cliente
 * (useGroups.ts), o que e previsivel (xorshift128+) e pode gerar
 * codigos com <6 chars. Agora a geracao e server-side, reusando
 * crypto.randomInt + INVITE_CODE_ALPHABET (mesma rotina do
 * invite-code de apadrinhamento, #2650). O doc invites/{code} e
 * criado aqui via Admin SDK (bypassa rules), e a rule de create em
 * invites/ e negada para clientes.
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {checkRateLimit} from "../middleware/rate-limiter";
import {db} from "../_db";
import {generateInviteCode} from "../auth/invite-code";

const GROUP_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_GROUP_INVITE_ATTEMPTS = 8;

export const generateGroupInviteCode = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  },
  async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "Você precisa estar logado.");
      }

      const input = request.data as {groupId?: unknown; groupName?: unknown};
      const groupId =
        typeof input.groupId === "string" ? input.groupId.trim() : "";
      const groupName =
        typeof input.groupName === "string" ? input.groupName.trim() : "";
      if (!groupId || groupName.length === 0) {
        throw new HttpsError("invalid-argument", "Dados do grupo inválidos.");
      }

      const rl = await checkRateLimit(uid, {
        maxRequests: 20,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "generate_group_invite",
      });
      if (!rl.allowed) {
        throw new HttpsError(
          "resource-exhausted",
          "Muitas tentativas. Tente novamente mais tarde.",
        );
      }

      const memberSnap = await db()
        .doc(`groups/${groupId}/members/${uid}`)
        .get();
      const memberData = memberSnap.data() as Record<string, unknown> | undefined;
      if (
        !memberSnap.exists ||
        memberData?.user_id !== uid ||
        (memberData?.role !== "OWNER" && memberData?.role !== "ADMIN") ||
        memberData?.status !== "ACTIVE"
      ) {
        throw new HttpsError(
          "permission-denied",
          "Sem permissão para gerar convites.",
        );
      }

      const displayName =
        (typeof request.auth?.token?.name === "string" &&
          request.auth.token.name) ||
        "Organizador";
      const expiresAt = Timestamp.fromMillis(
        Date.now() + GROUP_INVITE_TTL_MS,
      );

      for (let attempt = 0; attempt < MAX_GROUP_INVITE_ATTEMPTS; attempt += 1) {
        const code = generateInviteCode(6);
        const inviteRef = db().doc(`invites/${code}`);
        try {
          await inviteRef.create({
            code,
            group_id: groupId,
            group_name: groupName,
            inviter_id: uid,
            inviter_name: displayName,
            created_at: FieldValue.serverTimestamp(),
            expires_at: expiresAt,
            used: false,
          });
          logger.info("Generated group invite code", {groupId, uid});
          return {code};
        } catch (e) {
          const err = e as Error & {code?: number};
          if (err.code === 6) continue;
          throw e;
        }
      }

      throw new HttpsError(
        "resource-exhausted",
        "Não foi possível gerar um código único. Tente novamente.",
      );
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("generateGroupInviteCode failed", {
        error,
        uid: request.auth?.uid,
      });
      throw new HttpsError("internal", "Erro ao gerar convite.");
    }
  },
);
