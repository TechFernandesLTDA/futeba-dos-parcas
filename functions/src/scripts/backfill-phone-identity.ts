/**
 * Backfill privado de phone_index para contas existentes.
 *
 * Uso:
 *   npm run build
 *   CPF_SALT="$(gcloud secrets versions access latest --secret=CPF_SALT)" \
 *     node lib/scripts/backfill-phone-identity.js [--execute]
 *
 * Dry-run é o padrão. Nenhum telefone, e-mail ou UID é impresso.
 */
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {hashPhoneIdentity} from "../validation/phone-identity";

const execute = process.argv.includes("--execute");
const projectId = process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "futebadosparcas";
const secret = process.env.CPF_SALT;

if (!secret || secret.length < 16) {
  throw new Error("CPF_SALT ausente ou inválido");
}
const identitySecret: string = secret;

if (admin.apps.length === 0) admin.initializeApp({projectId});

/** Executa dry-run ou backfill idempotente dos índices de telefone. */
async function run(): Promise<void> {
  const auth = admin.auth();
  const database = admin.firestore();
  let pageToken: string | undefined;
  let scanned = 0;
  let withPhone = 0;
  let indexed = 0;
  let alreadyIndexed = 0;
  let conflicts = 0;

  do {
    const page = await auth.listUsers(1000, pageToken);
    scanned += page.users.length;
    for (const user of page.users) {
      if (!user.phoneNumber) continue;
      withPhone++;
      const phoneHash = hashPhoneIdentity(user.phoneNumber, identitySecret);
      const indexRef = database.doc(`phone_index/${phoneHash}`);
      const privateRef = database.doc(`users_private/${user.uid}`);

      const outcome = await database.runTransaction(async (tx) => {
        const indexSnap = await tx.get(indexRef);
        if (indexSnap.exists && indexSnap.data()?.uid !== user.uid) {
          return "conflict" as const;
        }
        if (indexSnap.exists) return "exists" as const;
        if (execute) {
          const now = FieldValue.serverTimestamp();
          tx.set(indexRef, {
            uid: user.uid,
            createdAt: now,
            updatedAt: now,
          });
          tx.set(privateRef, {
            phoneHash,
            phoneNumber: user.phoneNumber,
            phoneVerifiedAt: now,
            updatedAt: now,
          }, {merge: true});
        }
        return "indexed" as const;
      });

      if (outcome === "conflict") conflicts++;
      if (outcome === "exists") alreadyIndexed++;
      if (outcome === "indexed") indexed++;
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    scanned,
    withPhone,
    indexed,
    alreadyIndexed,
    conflicts,
  }));

  if (conflicts > 0) process.exitCode = 2;
}

void run()
  .catch((error) => {
    console.error("Backfill falhou", {code: error?.code ?? "unknown"});
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(admin.apps.map((app) => app?.delete()));
  });
