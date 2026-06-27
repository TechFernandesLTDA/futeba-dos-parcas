/**
 * Account claim + merge request flow.
 *
 * Modern account merge rules:
 * - phone possession is proven by Firebase Phone Auth on the target account;
 * - source account possession is proven by a valid ID token captured before
 *   switching sessions;
 * - no automatic destructive merge happens here. This callable creates an
 *   auditable request for an admin/reconciler workflow.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";
import {checkRateLimit} from "../middleware/rate-limiter";
import {getAuth} from "../utils/firebase-lazy";

type UserPrivateData = {
  cpfHash?: unknown;
};

type CpfRelation =
  | "matched"
  | "missing_source"
  | "missing_target"
  | "missing_both";

const MERGE_REQUESTS_PER_HOUR = 3;

/**
 * Compara os CPFs privados das duas contas sem expor o hash para o cliente.
 *
 * @param {UserPrivateData} sourcePrivate - Dados privados da conta origem.
 * @param {UserPrivateData} targetPrivate - Dados privados da conta destino.
 * @return {CpfRelation} Relação segura entre os CPFs.
 */
function cpfRelation(
  sourcePrivate: UserPrivateData,
  targetPrivate: UserPrivateData,
): CpfRelation {
  const sourceCpfHash = typeof sourcePrivate.cpfHash === "string" ?
    sourcePrivate.cpfHash :
    null;
  const targetCpfHash = typeof targetPrivate.cpfHash === "string" ?
    targetPrivate.cpfHash :
    null;

  if (sourceCpfHash && targetCpfHash && sourceCpfHash === targetCpfHash) {
    return "matched";
  }
  if (sourceCpfHash && targetCpfHash && sourceCpfHash !== targetCpfHash) {
    throw new HttpsError(
      "failed-precondition",
      "As contas possuem CPFs diferentes. A unificação exige revisão manual.",
    );
  }
  if (sourceCpfHash) return "missing_target";
  if (targetCpfHash) return "missing_source";
  return "missing_both";
}

/**
 * Creates an auditable account merge request after the user has proven control
 * over both sessions.
 *
 * @return {Promise<object>} request status.
 */
export const requestAccountMerge = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      const sourceIdToken: unknown = request.data?.sourceIdToken;
      if (typeof sourceIdToken !== "string" || sourceIdToken.length < 32) {
        throw new HttpsError(
          "invalid-argument",
          "sourceIdToken deve ser um token válido",
        );
      }

      const rateLimit = await checkRateLimit(request.auth.uid, {
        maxRequests: MERGE_REQUESTS_PER_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "account_merge_request",
      });
      if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil(
          (rateLimit.resetAt.getTime() - Date.now()) / 1000,
        );
        throw new HttpsError(
          "resource-exhausted",
          "Muitas solicitações. Tente novamente mais tarde.",
          {retryAfter: retryAfterSec},
        );
      }

      const auth = getAuth();
      const targetUid = request.auth.uid;
      let sourceUid: string;
      try {
        const decodedSource = await auth.verifyIdToken(sourceIdToken, true);
        sourceUid = decodedSource.uid;
      } catch (error) {
        logger.warn("[ACCOUNT_MERGE] Invalid source token", {
          error,
          targetUid,
        });
        throw new HttpsError(
          "permission-denied",
          "Não foi possível validar a conta anterior.",
        );
      }

      if (sourceUid === targetUid) {
        throw new HttpsError(
          "invalid-argument",
          "A conta de origem e destino devem ser diferentes",
        );
      }

      const [sourceAuth, targetAuth] = await Promise.all([
        auth.getUser(sourceUid),
        auth.getUser(targetUid),
      ]);

      if (sourceAuth.disabled || targetAuth.disabled) {
        throw new HttpsError(
          "failed-precondition",
          "Não é possível unificar contas desativadas.",
        );
      }
      if (!targetAuth.phoneNumber) {
        throw new HttpsError(
          "failed-precondition",
          "A conta de destino precisa ter telefone verificado.",
        );
      }

      const database = db();
      const [
        sourceUserSnap,
        targetUserSnap,
        sourcePrivateSnap,
        targetPrivateSnap,
      ] = await Promise.all([
        database.doc(`users/${sourceUid}`).get(),
        database.doc(`users/${targetUid}`).get(),
        database.doc(`users_private/${sourceUid}`).get(),
        database.doc(`users_private/${targetUid}`).get(),
      ]);

      const relation = cpfRelation(
        sourcePrivateSnap.data() ?? {},
        targetPrivateSnap.data() ?? {},
      );
      const requestId = `${sourceUid}_${targetUid}`;
      const requestRef = database.doc(`account_merge_requests/${requestId}`);
      const auditRef = database.collection("audit_logs").doc();
      const now = FieldValue.serverTimestamp();

      await database.runTransaction(async (tx) => {
        const existing = await tx.get(requestRef);
        if (existing.exists && existing.data()?.status === "completed") {
          throw new HttpsError(
            "already-exists",
            "Essa unificação já foi concluída.",
          );
        }

        tx.set(
          requestRef,
          {
            sourceUid,
            targetUid,
            requestedBy: targetUid,
            status: "pending_review",
            cpfRelation: relation,
            sourceUserExists: sourceUserSnap.exists,
            targetUserExists: targetUserSnap.exists,
            sourceHasEmail: !!sourceAuth.email,
            targetHasEmail: !!targetAuth.email,
            sourceHasPhone: !!sourceAuth.phoneNumber,
            targetHasPhone: !!targetAuth.phoneNumber,
            proofs: {
              sourceIdTokenVerified: true,
              targetPhoneAuthVerified: true,
            },
            createdAt: existing.exists ?
              existing.data()?.createdAt ?? now :
              now,
            updatedAt: now,
          },
          {merge: true},
        );

        tx.set(auditRef, {
          type: "ACCOUNT_MERGE_REQUESTED",
          source_user_id: sourceUid,
          target_user_id: targetUid,
          requested_by: targetUid,
          merge_request_id: requestId,
          cpf_relation: relation,
          timestamp: now,
        });
      });

      logger.info("[ACCOUNT_MERGE] Request created", {
        requestId,
        sourceUid,
        targetUid,
        cpfRelation: relation,
      });

      return {
        success: true,
        requestId,
        status: "pending_review",
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("requestAccountMerge failed", {
        error,
        uid: request.auth?.uid,
      });
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  },
);
