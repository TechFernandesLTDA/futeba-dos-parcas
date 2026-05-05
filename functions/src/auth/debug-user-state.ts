/**
 * TEMP debug callable — retorna estado de verificação do user logado.
 * Remover após resolver onboarding bug.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {db} from "../_db";

export const debugMyState = onCall(
  {region: "us-central1", enforceAppCheck: false},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login obrigatorio");
    }
    const uid = request.auth.uid;
    const userRecord = await admin.auth().getUser(uid);
    const privateSnap = await db().doc(`users_private/${uid}`).get();
    const userSnap = await db().doc(`users/${uid}`).get();
    return {
      uid,
      email: userRecord.email ?? null,
      phoneNumber: userRecord.phoneNumber ?? null,
      providers: userRecord.providerData.map((p) => p.providerId),
      customClaims: userRecord.customClaims ?? null,
      tokenClaims: request.auth.token,
      usersPrivateExists: privateSnap.exists,
      usersPrivate: privateSnap.exists ? privateSnap.data() : null,
      usersDoc: userSnap.exists ? userSnap.data() : null,
    };
  },
);
