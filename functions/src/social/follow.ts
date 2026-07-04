/* istanbul ignore file -- callable wrapper exercised through targeted social suites. */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";
import {isRecord} from "../validation/guards";

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
  if (!isRecord(data) || !isNonEmptyString(data.targetUserId)) {
    throw new HttpsError("invalid-argument", "targetUserId obrigatório.");
  }

  return {
    targetUserId: data.targetUserId.trim(),
    follow: data.follow !== false,
  };
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

    const currentUserRef = db().doc(`users/${uid}`);
    const targetUserRef = db().doc(`users/${targetUserId}`);
    const followingRef = currentUserRef.collection("following").doc(targetUserId);
    const followerRef = targetUserRef.collection("followers").doc(uid);

    try {
      const result = await db().runTransaction(async (tx) => {
        const [currentUserSnap, targetUserSnap, followingSnap] =
          await Promise.all([
            tx.get(currentUserRef),
            tx.get(targetUserRef),
            tx.get(followingRef),
          ]);

        if (!currentUserSnap.exists) {
          throw new HttpsError("not-found", "Usuário atual não encontrado.");
        }
        if (!targetUserSnap.exists) {
          throw new HttpsError("not-found", "Perfil não encontrado.");
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
          following_count: FieldValue.increment(decision.followingDelta),
        });
        tx.update(targetUserRef, {
          followers_count: FieldValue.increment(decision.followersDelta),
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
