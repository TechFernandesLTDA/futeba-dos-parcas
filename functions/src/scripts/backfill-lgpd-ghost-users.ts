/* eslint-disable require-jsdoc */
/**
 * FIX #4139 + #4124: backfill LGPD.
 *
 * 1. Pais fantasmas users/{uid} (perfil apagado com subcoleções vivas —
 *    delete() não apaga subcoleções). Filtra refs sem doc E sem conta no
 *    Auth e aplica recursiveDelete.
 * 2. user_locations/{uid} sem perfil (coordenadas GPS precisas que
 *    sobreviveram ao direito de exclusão).
 *
 * Dry-run é o default.
 *
 * Usage:
 *   cd functions
 *   npx ts-node src/scripts/backfill-lgpd-ghost-users.ts
 *   npx ts-node src/scripts/backfill-lgpd-ghost-users.ts --execute
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const EXECUTE = process.argv.includes("--execute");

async function backfill() {
  const refs = await db.collection("users").listDocuments();
  console.log(
    `users.listDocuments(): ${refs.length} ref(s) ` +
    `(modo: ${EXECUTE ? "EXECUTE" : "DRY-RUN"})`
  );

  let ghostFixed = 0;
  let locationPurged = 0;

  for (const userRef of refs) {
    const uid = userRef.id;
    const profileSnap = await userRef.get();
    let authUser: admin.auth.UserRecord | null = null;
    try {
      authUser = await admin.auth().getUser(uid);
    } catch {
      authUser = null;
    }

    if (!profileSnap.exists && authUser === null) {
      const subcollections = await userRef.listCollections();
      if (subcollections.length > 0) {
        console.log(
          `  ghost: users/${uid} sem perfil e sem conta — ` +
          `subcoleções: ${subcollections.map((c) => c.id).join(", ")}`
        );
        if (EXECUTE) {
          await db.recursiveDelete(userRef);
        }
        ghostFixed++;
      }
    }

    // FIX #4124: user_locations de uids sem conta/perfil.
    if (authUser === null) {
      const locationRef = db.collection("user_locations").doc(uid);
      const locationSnap = await locationRef.get();
      if (locationSnap.exists) {
        console.log(`  gps: user_locations/${uid} sem conta — apagando`);
        if (EXECUTE) {
          await locationRef.delete();
        }
        locationPurged++;
      }
    }
  }

  console.log(
    `Concluído: ${ghostFixed} ghost(s) users/{uid}, ` +
    `${locationPurged} user_locations purgado(s) ` +
    "(nada escrito em dry-run)"
  );
  if (!EXECUTE && (ghostFixed > 0 || locationPurged > 0)) {
    console.log("Rode novamente com --execute para gravar.");
  }
}

backfill().catch((err) => {
  console.error("Backfill falhou:", err);
  process.exit(1);
});
