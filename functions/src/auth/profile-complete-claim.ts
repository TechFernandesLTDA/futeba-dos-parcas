import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {FUNCTION_REGION} from "../constants";
import {isValidPhoneBR} from "../validation/phone-br";
import {isRecord} from "../validation/guards";
import {checkRateLimit} from "../middleware/rate-limiter";
import {
  buildRemovedReviewAccountClaims,
  buildReviewAccountClaims,
  hasReviewAccountClaims,
  hasReviewAccountMark,
  isReviewAccount,
} from "./review-accounts";

interface UserProfileData {
  cpfVerifiedAt?: unknown;
}

interface ProfileClaimResult {
  profileComplete: boolean;
  updated: boolean;
}

type AuthLookupError = {code?: string};

/**
 * Computa se o perfil tem CPF verificado e telefone valido no Firebase Auth.
 * Apenas o campo server-side cpfVerifiedAt (gravado por verifyCpf)
 * eh considerado; o campo raw cpf em users/{uid} eh client-writable
 * e nao deve ser usado para autorizacao.
 * O telefone tambem deve vir do UserRecord do Firebase Auth, nao de
 * users/{uid}, porque campos publicos do perfil podem ser editaveis/legados.
 *
 * @param {UserProfileData} data Dados publicos do usuario.
 * @param {string | undefined} authPhoneNumber Telefone do Firebase Auth.
 * @return {boolean} true se cadastro completo.
 */
export function computeProfileComplete(
  data: UserProfileData | undefined,
  authPhoneNumber?: string
): boolean {
  if (!data) return false;

  const hasCpf = data.cpfVerifiedAt != null;

  return hasCpf && isValidPhoneBR(authPhoneNumber);
}

/**
 * Grava as claims de uma conta que saiu da lista de revisão e revoga os
 * refresh tokens, para o token antigo (com verified/profileComplete da
 * designação) não ser renovado. O ID token já emitido vale até expirar (1 h).
 *
 * @param {string} uid ID do usuario.
 * @param {Record<string, unknown>} currentClaims Claims atuais.
 * @param {boolean} realProfileComplete Resultado da regra normal.
 */
async function revokeReviewAccountClaims(
  uid: string,
  currentClaims: Record<string, unknown>,
  realProfileComplete: boolean
): Promise<void> {
  await admin.auth().setCustomUserClaims(
    uid,
    buildRemovedReviewAccountClaims(currentClaims, realProfileComplete)
  );
  await admin.auth().revokeRefreshTokens(uid);
  logger.info(
    "[PROFILE_COMPLETE] Review account removed; claims back to normal rule",
    {uid, profileComplete: realProfileComplete}
  );
}

export type RemovedReviewAccountOutcome =
  | "still-listed"
  | "not-marked"
  | "user-not-found"
  | "would-revoke"
  | "revoked";

/**
 * Revoga as claims de designação de um UID que não está mais na lista.
 * Usado pelo script apply-review-account-claims, que varre o Auth atrás da
 * marca `reviewAccount`. Idempotente.
 *
 * @param {string} uid ID do usuario.
 * @param {Set<string>} listed UIDs listados hoje.
 * @param {boolean} execute false = só simula (dry-run).
 * @return {Promise<RemovedReviewAccountOutcome>} O que aconteceu.
 */
export async function revokeRemovedReviewAccount(
  uid: string,
  listed: Set<string>,
  execute: boolean
): Promise<RemovedReviewAccountOutcome> {
  if (listed.has(uid)) return "still-listed";

  const userRecord = await admin.auth().getUser(uid).catch((error) => {
    if ((error as AuthLookupError)?.code === "auth/user-not-found") {
      return null;
    }
    throw error;
  });
  if (!userRecord) return "user-not-found";

  const currentClaims = userRecord.customClaims ?? {};
  if (!hasReviewAccountMark(currentClaims)) return "not-marked";
  if (!execute) return "would-revoke";

  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  const userRaw = userSnap.exists ? userSnap.data() : undefined;
  const profileData = isRecord(userRaw) ?
    (userRaw as UserProfileData) :
    undefined;
  await revokeReviewAccountClaims(
    uid,
    currentClaims,
    computeProfileComplete(profileData, userRecord.phoneNumber)
  );
  return "revoked";
}

/**
 * Atualiza custom claim profileComplete preservando claims existentes.
 *
 * @param {string} uid ID do usuario.
 * @param {UserProfileData | undefined} profileData Dados publicos do usuario.
 * @return {Promise<ProfileClaimResult>} Resultado da atualizacao.
 */
async function setProfileCompleteClaim(
  uid: string,
  profileData: UserProfileData | undefined
): Promise<ProfileClaimResult> {
  const userRecord = await admin.auth().getUser(uid).catch((error) => {
    if ((error as AuthLookupError)?.code === "auth/user-not-found") {
      logger.warn(
        "[PROFILE_COMPLETE] Auth user not found; skipping claim update",
        {uid}
      );
      return null;
    }
    // Falhas transitórias precisam chegar ao runtime para que o trigger com
    // retry não deixe a claim permanentemente desatualizada.
    throw error;
  });

  if (!userRecord) {
    return {
      profileComplete: computeProfileComplete(profileData),
      updated: false,
    };
  }

  const currentClaims = userRecord.customClaims ?? {};

  // Conta de revisão da Play (lista server-only): verified e profileComplete
  // ficam sempre verdadeiros, sem CPF/telefone. Sem este desvio, o trigger e
  // o recompute self-service desfariam a claim aplicada pelo script.
  if (await isReviewAccount(uid)) {
    if (hasReviewAccountClaims(currentClaims)) {
      return {profileComplete: true, updated: false};
    }
    await admin.auth().setCustomUserClaims(
      uid,
      buildReviewAccountClaims(currentClaims)
    );
    logger.info(
      "[PROFILE_COMPLETE] Review account claims kept",
      {uid}
    );
    return {profileComplete: true, updated: true};
  }

  const profileComplete = computeProfileComplete(
    profileData,
    userRecord.phoneNumber
  );

  // Saiu da lista mas ainda carrega a marca: volta à regra normal e retira o
  // verified concedido só pela designação (sem privilégio residual).
  if (hasReviewAccountMark(currentClaims)) {
    await revokeReviewAccountClaims(uid, currentClaims, profileComplete);
    return {profileComplete, updated: true};
  }

  if (currentClaims.profileComplete === profileComplete) {
    return {profileComplete, updated: false};
  }

  await admin.auth().setCustomUserClaims(uid, {
    ...currentClaims,
    profileComplete,
  });

  logger.info(
    "[PROFILE_COMPLETE] Updated profileComplete claim",
    {uid, profileComplete}
  );

  return {profileComplete, updated: true};
}

/**
 * Recalcula profileComplete quando users/{uid} muda.
 */
export const onUserProfileWritten = onDocumentWritten(
  {document: "users/{uid}", region: FUNCTION_REGION, retry: true},
  async (event) => {
    // FIX #2284: valida que é um objeto antes do cast (early-return implícito
    // via undefined caso o doc esteja malformado).
    const beforeRaw = event.data?.before.exists ?
      event.data.before.data() : undefined;
    const afterRaw = event.data?.after.exists ?
      event.data.after.data() : undefined;
    const before: UserProfileData | undefined =
      isRecord(beforeRaw) ? beforeRaw : undefined;
    const after: UserProfileData | undefined =
      isRecord(afterRaw) ? afterRaw : undefined;

    if (
      (before?.cpfVerifiedAt != null) === (after?.cpfVerifiedAt != null)
    ) {
      return;
    }

    const uid = event.params.uid;

    await setProfileCompleteClaim(uid, after);
  }
);

/**
 * Callable self-service para forcar recalc da claim e permitir refresh token.
 */
export const recomputeMyProfileClaim = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "auth required"
        );
      }

      // FIX #2650: rate limit per uid — impede abuso via chamadas repetidas
      const rl = await checkRateLimit(request.auth.uid, {
        maxRequests: 10,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "recompute_profile_claim",
      });
      if (!rl.allowed) {
        const retryAfterSec = Math.ceil(
          (rl.resetAt.getTime() - Date.now()) / 1000,
        );
        throw new HttpsError(
          "resource-exhausted",
          "Muitas tentativas. Tente novamente mais tarde.",
          {retryAfter: retryAfterSec},
        );
      }

      const uid = request.auth.uid;
      const userSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .get();
      // FIX #2284: valida shape antes do cast.
      const userRaw = userSnap.exists ? userSnap.data() : undefined;
      const profileData = isRecord(userRaw) ?
        (userRaw as UserProfileData) :
        undefined;

      return {
        success: true,
        ...(await setProfileCompleteClaim(uid, profileData)),
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("recomputeMyProfileClaim failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);
