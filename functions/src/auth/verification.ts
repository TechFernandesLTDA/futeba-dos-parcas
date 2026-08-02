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
import {FieldValue} from "firebase-admin/firestore";
import {hashCpf, isValidCpf, maskCpf} from "../validation/cpf";
import {hashPhoneIdentity} from "../validation/phone-identity";
import {checkRateLimit} from "../middleware/rate-limiter";
import {FUNCTION_REGION} from "../constants";
import {computeProfileComplete} from "./profile-complete-claim";
import {
  acquireOperationLease,
  completeOperationLease,
  failOperationLease,
  OperationLease,
} from "../middleware/operation-lock";
import {resolveLegacyIdentityHash} from "./identity-index";

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
 * Reconcilia phone_index legado e materializa a identidade verificada.
 *
 * @param {admin.firestore.Firestore} database Firestore.
 * @param {string} uid Identidade canônica.
 * @param {string} phoneNumber Telefone atual do Firebase Auth.
 * @param {admin.firestore.DocumentData} privateData Dados privados atuais.
 * @return {Promise<void>} Conclusão da reconciliação atômica.
 */
async function reconcilePhoneIdentity(
  database: admin.firestore.Firestore,
  uid: string,
  phoneNumber: string,
  privateData: admin.firestore.DocumentData,
): Promise<void> {
  const phoneHash = hashPhoneIdentity(phoneNumber, getCpfSalt());
  const phoneIndexRef = database.doc(`phone_index/${phoneHash}`);
  const privateRef = database.doc(`users_private/${uid}`);
  const userRef = database.doc(`users/${uid}`);
  const ownedPhoneQuery = database.collection("phone_index")
    .where("uid", "==", uid)
    .limit(2);

  await database.runTransaction(async (tx) => {
    const [phoneIndexSnap, ownedPhoneIndexes] = await Promise.all([
      tx.get(phoneIndexRef),
      tx.get(ownedPhoneQuery),
    ]);
    const previousPhoneHash = resolveLegacyIdentityHash(
      privateData.phoneHash,
      ownedPhoneIndexes.docs.map((doc) => doc.id),
      "telefone",
    );
    const previousPhoneIndexRef = previousPhoneHash &&
      previousPhoneHash !== phoneHash ?
      database.doc(`phone_index/${previousPhoneHash}`) :
      null;
    const previousPhoneIndexSnap = previousPhoneIndexRef ?
      await tx.get(previousPhoneIndexRef) :
      null;

    const indexedUid = phoneIndexSnap.data()?.uid;
    if (phoneIndexSnap.exists && indexedUid !== uid) {
      logger.warn("[SET_VERIFIED] Phone identity collision blocked", {uid});
      throw new HttpsError(
        "already-exists",
        "Este telefone já pertence a outra identidade.",
      );
    }
    if (
      previousPhoneIndexSnap?.exists &&
      previousPhoneIndexSnap.data()?.uid !== uid
    ) {
      throw new HttpsError(
        "failed-precondition",
        "O índice anterior de telefone está inconsistente.",
      );
    }

    const now = FieldValue.serverTimestamp();
    tx.set(phoneIndexRef, {
      uid,
      createdAt: phoneIndexSnap.data()?.createdAt ?? now,
      updatedAt: now,
    }, {merge: true});
    tx.set(privateRef, {
      phoneVerifiedAt: now,
      phoneNumber,
      phoneHash,
      updatedAt: now,
    }, {merge: true});
    tx.set(userRef, {
      // #3935: NÃO gravar `phone` (E.164 em plaintext) em users/{uid}. O guard
      // público de leitura (firestore.rules) nega o get quando `phone` está
      // presente e não-vazio — o que tornava TODO usuário verificado ilegível
      // para os pares (escalção, ranking, perfil). O telefone canônico já vive
      // em users_private.phoneNumber (acima) e no Firebase Auth.
      // `phone_verified` é mantido: é booleano (não PII) e o guard
      // correspondente foi removido das rules.
      phone_verified: true,
      verifiedAt: now,
    }, {merge: true});
    if (previousPhoneIndexRef && previousPhoneIndexSnap?.data()?.uid === uid) {
      tx.delete(previousPhoneIndexRef);
    }
  });
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
      const ownedCpfQuery = db.collection("cpf_index")
        .where("uid", "==", uid)
        .limit(2);

      // Transaction: detecta duplicate + cria index + private + atualiza user
      await db.runTransaction(async (tx) => {
        const [indexSnap, privateSnap, ownedCpfIndexes] = await Promise.all([
          tx.get(indexRef),
          tx.get(privateRef),
          tx.get(ownedCpfQuery),
        ]);
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

        const privateData = privateSnap.data() ?? {};
        const registeredCpfHash = resolveLegacyIdentityHash(
          privateData.cpfHash,
          ownedCpfIndexes.docs.map((doc) => doc.id),
          "CPF",
        );

        // Se user já tem outro CPF registrado, bloqueia mudança via callable
        // (mudança de CPF é caso edge — exige fluxo separado de revisão).
        if (
          registeredCpfHash &&
          registeredCpfHash !== cpfHash
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

        const now = FieldValue.serverTimestamp();

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
    secrets: ["CPF_SALT"],
  },
  async (request) => {
    try {
      const {auth, data} = request;
      if (!auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      const targetUid: unknown = data?.uid ?? auth.uid;
      if (typeof targetUid !== "string" || targetUid.length === 0) {
        throw new HttpsError("invalid-argument", "uid must be a non-empty string");
      }
      const isAdmin = auth.token?.role === "ADMIN";
      const isSelf = targetUid === auth.uid;

      if (!isSelf && !isAdmin) {
        throw new HttpsError(
          "permission-denied",
          "Apenas o próprio usuário ou ADMIN podem chamar setUserVerified",
        );
      }
      if (!isSelf) {
        // O ID token pode conservar ADMIN até o próximo refresh. Autorizações
        // privilegiadas consultam a claim atual para não aceitar downgrade stale.
        const freshCaller = await admin.auth().getUser(auth.uid);
        if (freshCaller.customClaims?.role !== "ADMIN") {
          throw new HttpsError(
            "permission-denied",
            "Apenas ADMIN pode verificar outro usuário.",
          );
        }
      }

      // FIX #2650: rate limit per target uid — impede abuso via chamadas repetidas
      const rl = await checkRateLimit(auth.uid, {
        maxRequests: 5,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "set_verified",
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
      if (!userRecord.phoneNumber) {
        throw new HttpsError(
          "failed-precondition",
          "Verifique seu telefone antes de concluir o cadastro.",
        );
      }

      // A unicidade do Firebase Auth é reforçada por um índice privado e
      // transacional que também permite reconciliar contas legadas.
      await reconcilePhoneIdentity(
        db,
        targetUid,
        userRecord.phoneNumber,
        privateData,
      );

      // Releitura tardia evita lost update de role/claims alteradas durante a
      // reconciliação Firestore. Também detecta troca concorrente de telefone.
      const freshUserRecord = await admin.auth().getUser(targetUid);
      if (freshUserRecord.phoneNumber !== userRecord.phoneNumber) {
        throw new HttpsError(
          "aborted",
          "O telefone mudou durante a verificação. Tente novamente.",
        );
      }
      const currentClaims = freshUserRecord.customClaims ?? {};
      const profileComplete = computeProfileComplete(
        {cpfVerifiedAt: privateData.cpfVerifiedAt},
        freshUserRecord.phoneNumber,
      );
      const nextClaims = {
        ...currentClaims,
        verified: true,
        profileComplete,
      };
      const claimsAlreadyCurrent =
        currentClaims.verified === true &&
        currentClaims.profileComplete === profileComplete;

      // Idempotência: o índice acima é sempre validado, inclusive para claims
      // antigos. Assim um legado não contorna a unicidade pelo early return.
      if (claimsAlreadyCurrent) {
        logger.info("[SET_VERIFIED] No-op: usuário já verificado", {
          uid: targetUid,
        });
        return {
          success: true,
          uid: targetUid,
          alreadyVerified: true,
        };
      }

      await admin.auth().setCustomUserClaims(targetUid, nextClaims);

      // Não revogar refresh tokens aqui. O cliente força getIdTokenResult(true)
      // após a callable para buscar o claim novo; revogar no mesmo fluxo invalida
      // a sessão recém-verificada e, em web mobile, pode derrubar para /login.

      return {
        success: true,
        uid: targetUid,
        alreadyVerified: currentClaims.verified === true,
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
    secrets: ["CPF_SALT"],
  },
  async (request) => {
    let operationLease: OperationLease | undefined;
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

      const db = admin.firestore();
      const freshCaller = await admin.auth().getUser(request.auth.uid);
      if (freshCaller.customClaims?.role !== "ADMIN") {
        throw new HttpsError(
          "permission-denied",
          "Apenas admin pode executar backfill de verificação.",
        );
      }

      // FIX #2641: system_lock + rate limit — impede execuções concorrentes
      // e reexecução em intervalo curto (padrão de custom-claims.ts:464-507).
      operationLease = await acquireOperationLease(
        db,
        "bulk_verify_migration",
        request.auth.uid,
        {cooldownMs: 60 * 60 * 1000, leaseMs: 10 * 60 * 1000},
      );

      const auth = admin.auth();

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

              // Elegivel — setar claim verified=true
              try {
                const userRef = db.doc(`users/${userRecord.uid}`);
                await reconcilePhoneIdentity(
                  db,
                  userRecord.uid,
                  userRecord.phoneNumber,
                  privateData,
                );

                const freshUser = await auth.getUser(userRecord.uid);
                if (freshUser.phoneNumber !== userRecord.phoneNumber) {
                  throw new HttpsError(
                    "aborted",
                    "Telefone alterado durante o backfill.",
                  );
                }
                const currentClaims = freshUser.customClaims ?? {};
                const profileComplete = computeProfileComplete(
                  {cpfVerifiedAt: privateData.cpfVerifiedAt},
                  freshUser.phoneNumber,
                );
                if (
                  currentClaims.verified === true &&
                  currentClaims.profileComplete === profileComplete
                ) {
                  return;
                }
                await auth.setCustomUserClaims(userRecord.uid, {
                  ...currentClaims,
                  verified: true,
                  profileComplete,
                });

                // FIX #2641: only revoke when claim actually changed
                // (defense against concurrent runs that already set the claim)
                if (currentClaims.verified !== true) {
                  await auth.revokeRefreshTokens(userRecord.uid);
                }

                // Mirror em users/{uid} para listeners cliente
                await userRef.set(
                  {
                    verifiedAt: FieldValue.serverTimestamp(),
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

      await completeOperationLease(db, operationLease, {
        total_processed: totalProcessed,
        total_set_verified: totalSetVerified,
        errors_count: errors.length,
      });

      return {
        totalProcessed,
        totalSetVerified,
        errors,
      };
    } catch (error) {
      if (operationLease) {
        try {
          await failOperationLease(admin.firestore(), operationLease, error);
        } catch {
          // O erro original tem prioridade; falha de telemetria não o mascara.
        }
      }

      if (error instanceof HttpsError) throw error;
      logger.error("bulkSetVerifiedForExistingUsers failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  }
);
