/* istanbul ignore file -- callable wrapper exercised through targeted social suites. */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";
import {checkRateLimit} from "../middleware/rate-limiter";

export const TOGGLE_FOLLOW_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000,
  keyPrefix: "toggle_follow",
};

interface ToggleFollowRequest {
  targetUserId: string;
  follow: boolean;
}

/** Resultado calculado para mutacao transacional de follow. */
export interface FollowMutationDecision {
  changed: boolean;
  followingDelta: number;
  followersDelta: number;
}

/**
 * Valida string nao vazia.
 *
 * @param {unknown} value Valor bruto.
 * @return {boolean} True quando e string com conteudo.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Faz parse do payload de follow/unfollow.
 *
 * @param {unknown} data Payload bruto.
 * @return {ToggleFollowRequest} Payload validado.
 */
function parseToggleFollowRequest(data: unknown): ToggleFollowRequest {
  if (
    !isRecord(data) ||
    !isNonEmptyString(data.targetUserId) ||
    data.targetUserId.trim().length > 128 ||
    data.targetUserId.includes("/")
  ) {
    throw new HttpsError("invalid-argument", "targetUserId obrigatório.");
  }
  if (typeof data.follow !== "boolean") {
    throw new HttpsError("invalid-argument", "follow deve ser booleano.");
  }

  return {
    targetUserId: data.targetUserId.trim(),
    follow: data.follow,
  };
}

/**
 * Aplica um delta preservando o invariante de contador não negativo.
 * @param {unknown} value Contador armazenado.
 * @param {number} delta Variacao desejada.
 * @return {number} Novo contador nao negativo.
 */
export function nonNegativeCounterAfterDelta(
  value: unknown,
  delta: number
): number {
  const current = typeof value === "number" && Number.isFinite(value) ?
    Math.max(0, Math.floor(value)) :
    0;
  return Math.max(0, current + delta);
}

/**
 * Detecta perfis indisponíveis que não podem participar da relação social.
 * @param {Record<string, unknown>} data Perfil armazenado.
 * @return {boolean} Se o perfil esta indisponivel.
 */
function isDeletedUser(data: Record<string, unknown>): boolean {
  return data.deleted_at != null ||
    data.deletedAt != null ||
    data.status === "DELETED" ||
    data.is_active === false;
}

/**
 * Aplica rate limit ao endpoint de follow antes da transacao.
 *
 * @param {string} uid Usuario autenticado.
 */
async function assertToggleFollowRateLimit(uid: string): Promise<void> {
  const rateLimit = await checkRateLimit(uid, TOGGLE_FOLLOW_RATE_LIMIT);
  if (rateLimit.allowed) return;

  const retryAfter = Math.max(
    1,
    Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)
  );
  throw new HttpsError(
    "resource-exhausted",
    `Muitas tentativas. Tente novamente em ${retryAfter} segundos.`,
    {retryAfter}
  );
}

/**
 * Decide deltas de contadores para follow/unfollow idempotente.
 *
 * @param {boolean} currentlyFollowing Estado atual.
 * @param {boolean} shouldFollow Estado desejado.
 * @return {FollowMutationDecision} Deltas a aplicar.
 */
export function decideFollowMutation(
  currentlyFollowing: boolean,
  shouldFollow: boolean
): FollowMutationDecision {
  if (currentlyFollowing === shouldFollow) {
    return {
      changed: false,
      followingDelta: 0,
      followersDelta: 0,
    };
  }

  const delta = shouldFollow ? 1 : -1;
  return {
    changed: true,
    followingDelta: delta,
    followersDelta: delta,
  };
}

export const toggleFollowUser = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório.");
    }

    const payload = parseToggleFollowRequest(request.data);
    const uid = request.auth.uid;
    const targetUserId = payload.targetUserId;

    if (targetUserId === uid) {
      throw new HttpsError(
        "invalid-argument",
        "Você não pode seguir seu próprio perfil."
      );
    }

    await assertToggleFollowRateLimit(uid);

    const currentUserRef = db().doc(`users/${uid}`);
    const targetUserRef = db().doc(`users/${targetUserId}`);
    const followingRef = currentUserRef.collection("following").doc(targetUserId);
    const followerRef = targetUserRef.collection("followers").doc(uid);
    const currentBlocksTargetRef = currentUserRef
      .collection("blocked").doc(targetUserId);
    const targetBlocksCurrentRef = targetUserRef
      .collection("blocked").doc(uid);

    try {
      const result = await db().runTransaction(async (tx) => {
        const [
          currentUserSnap,
          targetUserSnap,
          followingSnap,
          currentBlocksTargetSnap,
          targetBlocksCurrentSnap,
        ] =
          await Promise.all([
            tx.get(currentUserRef),
            tx.get(targetUserRef),
            tx.get(followingRef),
            tx.get(currentBlocksTargetRef),
            tx.get(targetBlocksCurrentRef),
          ]);

        if (!currentUserSnap.exists) {
          throw new HttpsError("not-found", "Usuário atual não encontrado.");
        }
        if (!targetUserSnap.exists) {
          throw new HttpsError("not-found", "Perfil não encontrado.");
        }
        const currentUser = currentUserSnap.data() ?? {};
        const targetUser = targetUserSnap.data() ?? {};
        if (isDeletedUser(currentUser) || isDeletedUser(targetUser)) {
          throw new HttpsError("not-found", "Perfil não encontrado.");
        }
        if (
          payload.follow &&
          (currentBlocksTargetSnap.exists || targetBlocksCurrentSnap.exists)
        ) {
          throw new HttpsError(
            "permission-denied",
            "Follow indisponível por bloqueio social."
          );
        }

        const decision = decideFollowMutation(
          followingSnap.exists,
          payload.follow
        );

        if (!decision.changed) {
          return {
            following: payload.follow,
            changed: false,
          };
        }

        if (payload.follow) {
          const since = FieldValue.serverTimestamp();
          tx.set(followingRef, {
            target_user_id: targetUserId,
            since,
          });
          tx.set(followerRef, {
            follower_user_id: uid,
            since,
          });
        } else {
          tx.delete(followingRef);
          tx.delete(followerRef);
        }

        tx.update(currentUserRef, {
          following_count: nonNegativeCounterAfterDelta(
            currentUser.following_count,
            decision.followingDelta
          ),
        });
        tx.update(targetUserRef, {
          followers_count: nonNegativeCounterAfterDelta(
            targetUser.followers_count,
            decision.followersDelta
          ),
        });

        return {
          following: payload.follow,
          changed: true,
        };
      });

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Erro ao alternar follow", {
        uid,
        targetUserId,
        follow: payload.follow,
        error,
      });
      throw new HttpsError("internal", "Não foi possível atualizar o follow.");
    }
  }
);
