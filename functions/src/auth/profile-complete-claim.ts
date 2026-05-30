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

interface UserProfileData {
  cpfVerifiedAt?: unknown;
  phone?: unknown;
}

interface ProfileClaimResult {
  profileComplete: boolean;
  updated: boolean;
}

/**
 * Computa se o perfil tem CPF verificado e telefone valido.
 * Apenas o campo server-side cpfVerifiedAt (gravado por verifyCpf)
 * eh considerado; o campo raw cpf em users/{uid} eh client-writable
 * e nao deve ser usado para autorizacao.
 *
 * @param {UserProfileData} data Dados publicos do usuario.
 * @return {boolean} true se cadastro completo.
 */
export function computeProfileComplete(
  data: UserProfileData | undefined
): boolean {
  if (!data) return false;

  const phone = typeof data.phone === "string" ? data.phone : undefined;
  const hasCpf = data.cpfVerifiedAt != null;

  return hasCpf && isValidPhoneBR(phone);
}

/**
 * Atualiza custom claim profileComplete preservando claims existentes.
 *
 * @param {string} uid ID do usuario.
 * @param {boolean} profileComplete Novo valor da claim.
 * @return {Promise<ProfileClaimResult>} Resultado da atualizacao.
 */
async function setProfileCompleteClaim(
  uid: string,
  profileComplete: boolean
): Promise<ProfileClaimResult> {
  const userRecord = await admin.auth().getUser(uid).catch((error) => {
    logger.warn(
      "[PROFILE_COMPLETE] Auth user not found; skipping claim update",
      {uid, error}
    );
    return null;
  });

  if (!userRecord) {
    return {profileComplete, updated: false};
  }

  const currentClaims = userRecord.customClaims ?? {};
  if (currentClaims.profileComplete === profileComplete) {
    return {profileComplete, updated: false};
  }

  await admin.auth().setCustomUserClaims(uid, {
    ...currentClaims,
    profileComplete,
  });

  await admin.auth().revokeRefreshTokens(uid);

  logger.info(
    "[PROFILE_COMPLETE] Updated profileComplete claim (refresh tokens revoked)",
    {uid, profileComplete}
  );

  return {profileComplete, updated: true};
}

/**
 * Recalcula profileComplete quando users/{uid} muda.
 */
export const onUserProfileWritten = onDocumentWritten(
  {document: "users/{uid}", region: FUNCTION_REGION},
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
      before?.phone === after?.phone &&
      (before?.cpfVerifiedAt != null) === (after?.cpfVerifiedAt != null)
    ) {
      return;
    }

    const uid = event.params.uid;
    const profileComplete = computeProfileComplete(after);

    await setProfileCompleteClaim(uid, profileComplete);
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

      const uid = request.auth.uid;
      const userSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .get();
      // FIX #2284: valida shape antes do cast.
      const userRaw = userSnap.exists ? userSnap.data() : undefined;
      const profileComplete = computeProfileComplete(
        isRecord(userRaw) ? (userRaw as UserProfileData) : undefined
      );

      return {
        success: true,
        ...(await setProfileCompleteClaim(uid, profileComplete)),
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("recomputeMyProfileClaim failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);
