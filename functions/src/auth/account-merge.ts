/**
 * Account claim + merge request flow.
 *
 * Modern account merge rules:
 * - phone possession is proven by Firebase Phone Auth on the target account;
 * - source account possession is proven by a valid ID token captured before
 *   switching sessions;
 * - no destructive merge happens before CPF/phone invariants are satisfied;
 * - request IDs returned to clients never expose either UID.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import * as crypto from "crypto";
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
const COMPLETE_REQUESTS_PER_HOUR = 3;
const GOOGLE_PROVIDER_ID = "google.com";
const PROOF_TTL_MS = 15 * 60 * 1000;
const PROCESSING_LEASE_MS = 2 * 60 * 1000;

type MergeStatus = "pending_cpf" | "ready";

/**
 * Deriva estado seguro do pedido pela relação dos CPFs privados.
 * @param {CpfRelation} relation Relação entre os hashes privados.
 * @return {MergeStatus} Estado do pedido.
 */
export function mergeStatus(relation: CpfRelation): MergeStatus {
  // O destino é a conta que já possui o telefone. Ela precisa ter CPF privado
  // antes de qualquer reconciliação. O CPF da origem pode estar ausente em
  // contas incompletas, desde que a posse das duas sessões tenha sido provada.
  return relation === "matched" || relation === "missing_source" ?
    "ready" :
    "pending_cpf";
}

/**
 * Gera ID determinístico sem revelar UIDs ao cliente.
 * @param {string} sourceUid UID da conta origem.
 * @param {string} targetUid UID da identidade canônica.
 * @return {string} SHA-256 hexadecimal.
 */
export function opaqueRequestId(sourceUid: string, targetUid: string): string {
  return crypto
    .createHash("sha256")
    .update(`account-merge:${sourceUid}:${targetUid}`)
    .digest("hex");
}

/**
 * Compara os CPFs privados das duas contas sem expor o hash para o cliente.
 *
 * @param {UserPrivateData} sourcePrivate - Dados privados da conta origem.
 * @param {UserPrivateData} targetPrivate - Dados privados da conta destino.
 * @return {CpfRelation} Relação segura entre os CPFs.
 */
export function cpfRelation(
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
      let sourceTokenIssuedAt: number;
      try {
        const decodedSource = await auth.verifyIdToken(sourceIdToken, true);
        sourceUid = decodedSource.uid;
        sourceTokenIssuedAt = Number(decodedSource.iat ?? 0);
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

      const nowSeconds = Math.floor(Date.now() / 1000);
      const targetTokenIssuedAt = Number(request.auth.token.iat ?? 0);
      if (
        sourceTokenIssuedAt <= 0 ||
        targetTokenIssuedAt <= 0 ||
        nowSeconds - sourceTokenIssuedAt > PROOF_TTL_MS / 1000 ||
        nowSeconds - targetTokenIssuedAt > PROOF_TTL_MS / 1000
      ) {
        throw new HttpsError(
          "permission-denied",
          "Confirme novamente o acesso às duas contas.",
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
      const requestId = opaqueRequestId(sourceUid, targetUid);
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
            status: mergeStatus(relation),
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
              sourceTokenIssuedAt,
              targetTokenIssuedAt,
            },
            proofExpiresAt: Timestamp.fromMillis(Date.now() + PROOF_TTL_MS),
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
        status: mergeStatus(relation),
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

/**
 * Conclui uma união já autorizada pelas duas sessões.
 *
 * A conta do telefone é canônica. Dados históricos da origem não são
 * apagados; um alias privado preserva resolução e memberships ativos são
 * copiados. Provedores OAuth são desvinculados da origem para o cliente poder
 * vinculá-los à conta canônica com consentimento explícito.
 */
export const completeAccountMerge = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
    timeoutSeconds: 120,
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      const requestId: unknown = request.data?.requestId;
      if (typeof requestId !== "string" || !/^[a-f0-9]{64}$/.test(requestId)) {
        throw new HttpsError("invalid-argument", "Pedido de união inválido");
      }

      const rateLimit = await checkRateLimit(request.auth.uid, {
        maxRequests: COMPLETE_REQUESTS_PER_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "account_merge_complete",
      });
      if (!rateLimit.allowed) {
        throw new HttpsError(
          "resource-exhausted",
          "Muitas tentativas. Tente novamente mais tarde.",
        );
      }

      const database = db();
      const requestRef = database.doc(`account_merge_requests/${requestId}`);
      const requestSnap = await requestRef.get();
      const mergeData = requestSnap.data();
      if (!requestSnap.exists || !mergeData) {
        throw new HttpsError("not-found", "Pedido de união não encontrado");
      }

      const sourceUid = mergeData.sourceUid;
      const targetUid = mergeData.targetUid;
      if (
        typeof sourceUid !== "string" ||
        typeof targetUid !== "string" ||
        targetUid !== request.auth.uid
      ) {
        throw new HttpsError(
          "permission-denied",
          "Este pedido não pertence à sessão atual.",
        );
      }
      if (mergeData.status === "completed") {
        return {
          success: true,
          status: "completed",
          alreadyCompleted: true,
          providersToRelink: mergeData.providersToRelink ?? [],
        };
      }
      const proofExpiresAt = mergeData.proofExpiresAt;
      if (
        !(proofExpiresAt instanceof Timestamp) ||
        proofExpiresAt.toMillis() < Date.now()
      ) {
        throw new HttpsError(
          "permission-denied",
          "A confirmação das contas expirou. Reinicie a união.",
        );
      }

      const auth = getAuth();
      const [sourceAuth, targetAuth, sourcePrivate, targetPrivate] =
        await Promise.all([
          auth.getUser(sourceUid),
          auth.getUser(targetUid),
          database.doc(`users_private/${sourceUid}`).get(),
          database.doc(`users_private/${targetUid}`).get(),
        ]);

      if (
        targetAuth.disabled ||
        !targetAuth.phoneNumber ||
        (sourceAuth.disabled && mergeData.status !== "processing")
      ) {
        throw new HttpsError(
          "failed-precondition",
          "A conta canônica precisa estar ativa e com telefone verificado.",
        );
      }

      const relation = cpfRelation(
        sourcePrivate.data() ?? {},
        targetPrivate.data() ?? {},
      );
      if (mergeStatus(relation) !== "ready") {
        await requestRef.set({
          status: "pending_cpf",
          cpfRelation: relation,
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        throw new HttpsError(
          "failed-precondition",
          "Verifique o CPF da conta atual antes de concluir a união.",
        );
      }

      const providersToRelink = Array.isArray(mergeData.providersToRelink) ?
        mergeData.providersToRelink.filter(
          (providerId: unknown): providerId is string =>
            providerId === GOOGLE_PROVIDER_ID,
        ) :
        sourceAuth.providerData
          .map(({providerId}) => providerId)
          .filter((providerId) =>
            providerId === GOOGLE_PROVIDER_ID &&
            !targetAuth.providerData.some((provider) =>
              provider.providerId === providerId
            )
          );

      const sourceUserRef = database.doc(`users/${sourceUid}`);
      const targetUserRef = database.doc(`users/${targetUid}`);
      const aliasRef = database.doc(`account_aliases/${sourceUid}`);
      const [sourceUser, targetUser, sourceGroupLinks] = await Promise.all([
        sourceUserRef.get(),
        targetUserRef.get(),
        sourceUserRef.collection("groups").get(),
      ]);

      const sourceProfile = sourceUser.data() ?? {};
      const targetProfile = targetUser.data() ?? {};
      const fallbackProfile: Record<string, unknown> = {};
      for (const field of [
        "display_name", "name", "username", "photo_url", "position", "bio",
      ]) {
        if (!targetProfile[field] && sourceProfile[field]) {
          fallbackProfile[field] = sourceProfile[field];
        }
      }

      // Lease transacional evita duas conclusões concorrentes. Repetições após
      // expiração continuam seguras porque os destinos têm IDs determinísticos.
      const leaseId = crypto.randomUUID();
      const leaseExpiresAt = Timestamp.fromMillis(
        Date.now() + PROCESSING_LEASE_MS,
      );
      const leaseAcquired = await database.runTransaction(async (tx) => {
        const fresh = await tx.get(requestRef);
        const freshData = fresh.data();
        if (freshData?.status === "completed") {
          return false;
        }
        const activeLease = freshData?.processingLeaseExpiresAt;
        if (
          freshData?.status === "processing" &&
          activeLease instanceof Timestamp &&
          activeLease.toMillis() > Date.now()
        ) {
          throw new HttpsError(
            "aborted",
            "A união já está sendo processada.",
          );
        }
        tx.set(requestRef, {
          status: "processing",
          cpfRelation: relation,
          providersToRelink,
          processingLeaseId: leaseId,
          processingLeaseExpiresAt: leaseExpiresAt,
          updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        return true;
      });
      if (!leaseAcquired) {
        const completed = (await requestRef.get()).data();
        return {
          success: true,
          status: "completed",
          alreadyCompleted: true,
          providersToRelink: completed?.providersToRelink ?? [],
        };
      }

      const writer = database.bulkWriter();
      writer.set(targetUserRef, {
        ...fallbackProfile,
        updated_at: FieldValue.serverTimestamp(),
      }, {merge: true});
      writer.set(database.doc(`users_private/${targetUid}`), {
        ...(sourceAuth.email ? {
          alternateEmails: FieldValue.arrayUnion(sourceAuth.email),
        } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      writer.set(aliasRef, {
        canonicalUid: targetUid,
        mergeRequestId: requestId,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      writer.set(sourceUserRef, {
        account_status: "merged",
        updated_at: FieldValue.serverTimestamp(),
      }, {merge: true});

      let membershipsCopied = 0;
      for (const link of sourceGroupLinks.docs) {
        const targetLink = targetUserRef.collection("groups").doc(link.id);
        writer.set(targetLink, {
          ...link.data(),
          user_id: targetUid,
          merged_from_alias: true,
          updated_at: FieldValue.serverTimestamp(),
        }, {merge: true});

        const sourceMember = await database
          .doc(`groups/${link.id}/members/${sourceUid}`)
          .get();
        if (sourceMember.exists) {
          writer.set(database.doc(`groups/${link.id}/members/${targetUid}`), {
            ...sourceMember.data(),
            user_id: targetUid,
            userId: targetUid,
            merged_from_alias: true,
            updated_at: FieldValue.serverTimestamp(),
          }, {merge: true});
          membershipsCopied++;
        }
      }
      await writer.close();

      // Libera somente provedores OAuth que podem ser vinculados novamente
      // pelo próprio usuário no cliente. Senhas nunca são manipuladas aqui.
      await auth.updateUser(sourceUid, {
        disabled: true,
        ...(providersToRelink.length > 0 ? {providersToUnlink: providersToRelink} : {}),
      });

      const completedAt = FieldValue.serverTimestamp();
      await database.runTransaction(async (tx) => {
        const fresh = await tx.get(requestRef);
        if (fresh.data()?.processingLeaseId !== leaseId) {
          throw new HttpsError(
            "aborted",
            "A união foi retomada por outro processo.",
          );
        }
        tx.set(requestRef, {
          status: "completed",
          cpfRelation: relation,
          providersToRelink,
          manifest: {
            groupLinksCopied: sourceGroupLinks.size,
            membershipsCopied,
            sourceProfilePreserved: sourceUser.exists,
          },
          completedAt,
          updatedAt: completedAt,
          processingLeaseId: FieldValue.delete(),
          processingLeaseExpiresAt: FieldValue.delete(),
        }, {merge: true});
        tx.set(database.collection("audit_logs").doc(), {
          type: "ACCOUNT_MERGE_COMPLETED",
          source_user_id: sourceUid,
          target_user_id: targetUid,
          requested_by: targetUid,
          merge_request_id: requestId,
          cpf_relation: relation,
          providers_to_relink: providersToRelink,
          timestamp: completedAt,
        });
      });

      logger.info("[ACCOUNT_MERGE] Completed", {
        requestId,
        sourceUid,
        targetUid,
        membershipsCopied,
        providersToRelink,
      });
      return {
        success: true,
        status: "completed",
        alreadyCompleted: false,
        providersToRelink,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("completeAccountMerge failed", {
        error,
        uid: request.auth?.uid,
      });
      throw new HttpsError("internal", "Não foi possível concluir a união");
    }
  },
);
