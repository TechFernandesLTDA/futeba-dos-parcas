/**
 * Phone + CPF verification (Fase 1: Foundation).
 *
 * Implementa callables:
 * - verifyCpf({ cpf }) — valida CPF, checa duplicate, registra users_private
 * - setUserVerified({ uid }) — seta custom claim verified=true (ADMIN-only ou self)
 *
 * Spec: specs/SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {hashCpf, isValidCpf, maskCpf} from "../validation/cpf";

// CPF salt deve estar em Firebase config:
// firebase functions:config:set cpf.salt="<random-32-byte-hex>"
// Em runtime: process.env.CPF_SALT (Firebase Functions v2)
function getCpfSalt(): string {
  const salt = process.env.CPF_SALT;
  if (!salt || salt.length < 16) {
    throw new HttpsError(
      "failed-precondition",
      "CPF_SALT not configured. Run: firebase functions:secrets:set CPF_SALT",
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
    region: "us-central1",
    enforceAppCheck: process.env.NODE_ENV === "production",
    consumeAppCheckToken: true,
  },
  async (request) => {
    const {auth, data} = request;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Login obrigatório");
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
        throw new HttpsError(
          "already-exists",
          "Este CPF já está cadastrado em outra conta",
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
        throw new HttpsError(
          "permission-denied",
          "CPF já cadastrado nesta conta. Entre em contato com suporte para alterar.",
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

      tx.set(
        indexRef,
        {
          uid,
          createdAt: now,
        },
        {merge: false},
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
    region: "us-central1",
    enforceAppCheck: process.env.NODE_ENV === "production",
    consumeAppCheckToken: true,
  },
  async (request) => {
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

    if (
      !privateData?.cpfVerifiedAt ||
      !privateData?.phoneVerifiedAt
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Verificação de telefone e CPF deve ser concluída antes",
      );
    }

    const userRecord = await admin.auth().getUser(targetUid);
    const currentClaims = userRecord.customClaims ?? {};

    await admin.auth().setCustomUserClaims(targetUid, {
      ...currentClaims,
      verified: true,
    });

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
  },
);
