/**
 * Phone + CPF verification (Fase 1: Foundation).
 *
 * Implementa callables:
 * - verifyCpf({ cpf }) — valida + duplicate check + users_private
 * - setUserVerified({ uid }) — custom claim verified=true
 *
 * Spec: specs/SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {hashCpf, isValidCpf, maskCpf} from "../validation/cpf";
import {checkRateLimit} from "../middleware/rate-limiter";
import {FUNCTION_REGION} from "../constants";

/**
 * CPF salt vem de Firebase Functions secrets.
 * Setup: firebase functions:secrets:set CPF_SALT
 *
 * @return {string} Salt secreto.
 * @throws {HttpsError} Se CPF_SALT não configurado.
 */
function getCpfSalt(): string {
  const salt = process.env.CPF_SALT;
  if (!salt || salt.length < 16) {
    throw new HttpsError(
      "failed-precondition",
      "CPF_SALT not configured. " +
        "Run: firebase functions:secrets:set CPF_SALT",
    );
  }
  return salt;
}

/**
 * Valida CPF do usuário autenticado e registra users_private.
 *
 * Fluxo:
 * 1. Verifica auth
 * 2. Valida formato + dígito do CPF
 * 3. Hash do CPF com salt
 * 4. Checa cpf_index/{hash} pra duplicate
 * 5. Cria users_private/{uid} + cpf_index/{hash}
 * 6. Retorna { success: true, masked: '***.123.456-**' }
 */
export const verifyCpf = onCall(
  {
    region: FUNCTION_REGION,
    // FIX SEC-2026-05-08: enforce App Check em prod. Antes hardcoded false
    // como "debug" temporário (web SDK não anexava token) — debug virou prod.
    // Web App Check já está configurado (reCAPTCHA Enterprise ativo).
    // FIX #1307: NODE_ENV não é garantido pelo runtime GCF v2 → usar
    // FUNCTIONS_EMULATOR (setada pelo Emulator Suite). Enforce sempre,
    // exceto no emulador local.
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
    // CRITICAL: secret precisa ser declarada em onCall pra
    // ser acessivel via process.env.CPF_SALT em runtime.
    secrets: ["CPF_SALT"],
  },
  async (request) => {
    try {
      const {auth, data, app} = request;

      // FIX 2026-05-11 (Gustavo): logar contexto detalhado de auth + App Check
      // pra diagnosticar "Sessão deslogado" no client (= functions/unauthenticated).
      // Antes: callable rejeitava silenciosamente sem dica do motivo.
      logger.info("[VERIFY_CPF] Called", {
        hasAuth: !!auth,
        uid: auth?.uid || "none",
        hasAppCheck: !!app,
        appCheckAppId: app?.appId || "none",
        appCheckToken: app?.token ? "present" : "missing",
      });

      if (!auth) {
      // Pode ser: ID token expirado, malformado, ou App Check rejected (em
      // alguns casos vira unauthenticated quando enforceAppCheck=true).
        logger.warn(
          "[VERIFY_CPF] Rejected: no auth context. " +
        "Possible causes: expired ID token, App Check rejection, or missing token."
        );
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      // FIX #1304: rate limit por uid (5/hora). Sem isto, atacante autenticado
      // pode enumerar CPFs já registrados via timing differential do duplicate
      // check (transaction com tx.get em cpf_index).
      const rl = await checkRateLimit(auth.uid, {
        maxRequests: 5,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "verify_cpf",
      });
      if (!rl.allowed) {
        const retryAfterSec = Math.ceil(
          (rl.resetAt.getTime() - Date.now()) / 1000,
        );
        logger.warn("[VERIFY_CPF] Rate limit excedido", {
          uid: auth.uid,
          retryAfterSec,
        });
        throw new HttpsError(
          "resource-exhausted",
          "Muitas tentativas. Tente novamente mais tarde.",
          {retryAfter: retryAfterSec},
        );
      }

      const cpfRaw: unknown = data?.cpf;
      if (typeof cpfRaw !== "string") {
        throw new HttpsError("invalid-argument", "CPF deve ser string");
      }

      if (!isValidCpf(cpfRaw)) {
        throw new HttpsError("invalid-argument", "CPF inválido");
      }

      const salt = getCpfSalt();
      const cpfHash = hashCpf(cpfRaw, salt);
      const cpfMasked = maskCpf(cpfRaw);
      const uid = auth.uid;

      const db = admin.firestore();
      const indexRef = db.doc(`cpf_index/${cpfHash}`);
      const privateRef = db.doc(`users_private/${uid}`);
      const userRef = db.doc(`users/${uid}`);

      // Transaction: detecta duplicate + cria index + private + atualiza user
      await db.runTransaction(async (tx) => {
        const indexSnap = await tx.get(indexRef);
        if (indexSnap.exists && indexSnap.data()?.uid !== uid) {
        // FIX #652-B2: não revelar se CPF existe para prevenir enumeration.
        // Internamente registramos o attempt, mas retornamos mensagem genérica.
          logger.warn(
            "[VERIFICATION] Duplicate CPF attempt blocked — " +
          `uid=${uid} collided with existing cpf_index`
          );
          throw new HttpsError(
            "already-exists",
            "Verification code sent if CPF is valid",
          );
        }

        const privateSnap = await tx.get(privateRef);
        const privateData = privateSnap.data() ?? {};

        // Se user já tem outro CPF registrado, bloqueia mudança via callable
        // (mudança de CPF é caso edge — exige fluxo separado de revisão).
        if (
          privateData.cpfHash &&
        privateData.cpfHash !== cpfHash
        ) {
        // FIX #652-B2: mensagem genérica para prevenir enumeration
          logger.warn(
            "[VERIFICATION] CPF change blocked — " +
          `uid=${uid} already has a different CPF registered`
          );
          throw new HttpsError(
            "permission-denied",
            "Verification code sent if CPF is valid",
          );
        }

        const now = admin.firestore.FieldValue.serverTimestamp();

        tx.set(
          privateRef,
          {
            cpfHash,
            cpfMasked,
            cpfVerifiedAt: now,
            updatedAt: now,
          },
          {merge: true},
        );

        // FIX #1310-L1: merge:true preserva createdAt original. Antes
        // (merge:false) a reverificação do MESMO uid reescrevia o doc
        // inteiro e resetava createdAt a cada chamada.
        tx.set(
          indexRef,
          {
            uid,
            createdAt: now,
          },
          {merge: true},
        );

        tx.set(
          userRef,
          {
            cpfVerifiedAt: now,
          },
          {merge: true},
        );
      });

      return {
        success: true,
        cpfMasked,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("verifyCpf failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  },
);

/**
 * Seta custom claim verified=true para o usuário.
 *
 * Pode ser chamada:
 * - Pelo próprio usuário após completar phone+CPF (self-verify)
 * - Por ADMIN para grant manual
 *
 * Pré-condição: users_private/{uid} deve ter cpfVerifiedAt + phoneVerifiedAt.
 */
export const setUserVerified = onCall(
  {
    region: FUNCTION_REGION,
    // FIX SEC-2026-05-08: enforce App Check em prod. Antes hardcoded false
    // como "debug" temporário (web SDK não anexava token) — debug virou prod.
    // Web App Check já está configurado (reCAPTCHA Enterprise ativo).
    // FIX #1307: usar FUNCTIONS_EMULATOR (NODE_ENV não confiável em GCF v2).
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    try {
      const {auth, data} = request;
      if (!auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      const targetUid: string = data?.uid ?? auth.uid;
      const isAdmin = auth.token?.role === "ADMIN";
      const isSelf = targetUid === auth.uid;

      if (!isSelf && !isAdmin) {
        throw new HttpsError(
          "permission-denied",
          "Apenas o próprio usuário ou ADMIN podem chamar setUserVerified",
        );
      }

      const db = admin.firestore();
      const privateSnap = await db.doc(`users_private/${targetUid}`).get();
      const privateData = privateSnap.data();

      // CPF verificado via verifyCpf callable (escreve cpfVerifiedAt)
      if (!privateData?.cpfVerifiedAt) {
        throw new HttpsError(
          "failed-precondition",
          "Verifique seu CPF antes de concluir o cadastro.",
        );
      }

      // Phone verificado via Firebase Auth linkWithCredential
      // (Firebase popula phone_number no UserRecord automaticamente).
      const userRecord = await admin.auth().getUser(targetUid);

      // FIX #1308: idempotência. Se o usuário JÁ está verified=true, retornar
      // cedo SEM revogar refresh tokens nem reescrever claims/mirrors. Revogar
      // tokens forçava reauth no cliente → nova chamada de setUserVerified →
      // loop self-perpetuating cross-platform (web + Android #1313).
      if (userRecord.customClaims?.verified === true) {
        logger.info("[SET_VERIFIED] No-op: usuário já verificado", {
          uid: targetUid,
        });
        return {
          success: true,
          uid: targetUid,
          alreadyVerified: true,
        };
      }

      if (!userRecord.phoneNumber) {
        throw new HttpsError(
          "failed-precondition",
          "Verifique seu telefone antes de concluir o cadastro.",
        );
      }

      // Persiste phoneVerifiedAt em users_private (para audit/historico)
      await db.doc(`users_private/${targetUid}`).set(
        {
          phoneVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          phoneNumber: userRecord.phoneNumber,
        },
        {merge: true},
      );

      const currentClaims = userRecord.customClaims ?? {};

      await admin.auth().setCustomUserClaims(targetUid, {
        ...currentClaims,
        verified: true,
      });

      await admin.auth().revokeRefreshTokens(targetUid);

      // Mirror em users/{uid} para listeners cliente (refletir verifiedAt)
      await db.doc(`users/${targetUid}`).set(
        {
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
      );

      return {
        success: true,
        uid: targetUid,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("setUserVerified failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  },
);

/**
 * Backfill operacional: define verified=true via Custom Claim para usuários
 * que já têm CPF verificado (cpfVerifiedAt em users_private) e telefone
 * registrado no Firebase Auth, mas não têm o claim ainda.
 *
 * Executar UMA VEZ após deploy via Cloud Console ou httpsCallable("bulkSetVerifiedForExistingUsers").
 *
 * Critério de elegibilidade:
 * - users_private/{uid}.cpfVerifiedAt != null
 * - userRecord.phoneNumber != null (Firebase Auth)
 * - customClaims.verified !== true (ainda não migrado)
 *
 * @param {functions.https.CallableRequest} request - Requisição callable
 * @return {Promise<{totalProcessed, totalSetVerified, errors}>}
 */
export const bulkSetVerifiedForExistingUsers = onCall(
  {
    region: FUNCTION_REGION,
    // FIX #1307: usar FUNCTIONS_EMULATOR (NODE_ENV não confiável em GCF v2).
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: process.env.FUNCTIONS_EMULATOR !== "true",
    // Timeout maior para processar muitos usuários em lote
    timeoutSeconds: 540,
  },
  async (request) => {
    try {
    // Apenas ADMIN pode disparar o backfill
      if (
        !request.auth ||
      request.auth.token.role !== "ADMIN"
      ) {
        throw new HttpsError(
          "permission-denied",
          "Apenas admin pode executar backfill de verificação."
        );
      }

      const auth = admin.auth();
      const db = admin.firestore();

      let totalProcessed = 0;
      let totalSetVerified = 0;
      const errors: Array<{uid: string; error: string}> = [];

      logger.info(
        "[BULK_VERIFY] Iniciando backfill de verified=true"
      );

      // Iterar todos os usuários via listUsers com paginação
      let pageToken: string | undefined = undefined;

      do {
      // Buscar até 1000 usuários por página (máximo da API)
        const listResult = await auth.listUsers(1000, pageToken);
        pageToken = listResult.pageToken;

        // Processar em mini-batches de 5 para evitar quota burst
        const users = listResult.users;
        for (let i = 0; i < users.length; i += 5) {
          const batch = users.slice(i, i + 5);

          await Promise.all(
            batch.map(async (userRecord) => {
              totalProcessed++;

              // Pular se já tem claim verified=true
              if (userRecord.customClaims?.verified === true) {
                return;
              }

              // Pular se não tem telefone no Firebase Auth
              if (!userRecord.phoneNumber) {
                return;
              }

              // Verificar se tem CPF verificado em users_private
              let privateData: admin.firestore.DocumentData | undefined;
              try {
                const snap = await db
                  .doc(`users_private/${userRecord.uid}`)
                  .get();
                privateData = snap.data();
              } catch (err) {
                const msg =
                err instanceof Error ? err.message : String(err);
                logger.warn(
                  `[BULK_VERIFY] Erro ao buscar users_private/${userRecord.uid}:`,
                  {error: msg}
                );
                errors.push({uid: userRecord.uid, error: msg});
                return;
              }

              // Pular se não tem cpfVerifiedAt
              if (!privateData?.cpfVerifiedAt) {
                return;
              }

              // Elegível — setar claim verified=true
              try {
                const currentClaims = userRecord.customClaims ?? {};
                await auth.setCustomUserClaims(userRecord.uid, {
                  ...currentClaims,
                  verified: true,
                });

                await auth.revokeRefreshTokens(userRecord.uid);

                // Mirror em users/{uid} para listeners cliente
                await db.doc(`users/${userRecord.uid}`).set(
                  {
                    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
                  {merge: true}
                );

                totalSetVerified++;
                logger.info(
                  `[BULK_VERIFY] verified=true setado para uid=${userRecord.uid}`
                );
              } catch (err) {
                const msg =
                err instanceof Error ? err.message : String(err);
                logger.error(
                  `[BULK_VERIFY] Erro ao setar claim para uid=${userRecord.uid}:`,
                  {error: msg}
                );
                errors.push({uid: userRecord.uid, error: msg});
              }
            })
          );
        }

        logger.info(
          `[BULK_VERIFY] Processados ${totalProcessed} usuários ` +
        `(verificados: ${totalSetVerified}, erros: ${errors.length})`
        );
      } while (pageToken);

      logger.info(
        "[BULK_VERIFY] Backfill concluído: " +
      `totalProcessed=${totalProcessed}, ` +
      `totalSetVerified=${totalSetVerified}, ` +
      `errors=${errors.length}`
      );

      return {
        totalProcessed,
        totalSetVerified,
        errors,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("bulkSetVerifiedForExistingUsers failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);
