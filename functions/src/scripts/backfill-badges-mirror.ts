
/**
 * FIX #4138: backfill espelhando badges que as functions gravavam SOMENTE
 * em users/{uid}/badges (subcoleção sem leitor) para a coleção raiz
 * user_badges — o único lugar lido pelas telas (web/Android).
 *
 * Alvos: ambassador_* (ambassador-badge.ts), mito_rodada_* (weekly-ranking.ts),
 * mvp_liga_* (season-cycle.ts) — e qualquer outro doc de subcoleção que não
 * tenha mirror (idempotente por merge).
 *
 * Dry-run é o default.
 *
 * Usage:
 *   cd functions
 *   npx ts-node src/scripts/backfill-badges-mirror.ts
 *   npx ts-node src/scripts/backfill-badges-mirror.ts --execute
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const EXECUTE = process.argv.includes("--execute");
const PAGE_LIMIT = 500;

interface BadgeSubDoc {
  badge_id?: string;
  name?: string;
  icon?: string;
  type?: string;
  description?: string;
  earned_at?: unknown;
  expires_at?: unknown;
}

async function mirrorAll() {
  const usersSnap = await db.collection("users").limit(PAGE_LIMIT).get();
  console.log(
    `Usuários escaneados: ${usersSnap.size} ` +
    `(modo: ${EXECUTE ? "EXECUTE" : "DRY-RUN"})`
  );

  let mirrored = 0;
  let skipped = 0;

  for (const userDoc of usersSnap.docs) {
    const badgesSnap = await userDoc.ref.collection("badges").get();
    for (const badgeDoc of badgesSnap.docs) {
      const data = badgeDoc.data() as BadgeSubDoc;
      const badgeId = data.badge_id || badgeDoc.id;
      const rootRef = db.collection("user_badges")
        .doc(`${userDoc.id}_${badgeId}`);
      const existing = await rootRef.get();
      if (existing.exists) {
        skipped++;
        continue;
      }

      const payload: Record<string, unknown> = {
        user_id: userDoc.id,
        badge_id: badgeId,
        earned: true,
        count: 1,
        earned_at: data.earned_at ?? admin.firestore.FieldValue.serverTimestamp(),
      };
      if (data.name) payload.name = data.name;
      if (data.icon) payload.icon = data.icon;
      if (data.type) payload.type = data.type;
      if (data.description) payload.description = data.description;
      if (data.expires_at) payload.expires_at = data.expires_at;

      if (EXECUTE) {
        await rootRef.set(payload, {merge: true});
      }
      mirrored++;
      console.log(
        `  mirror: users/${userDoc.id}/badges/${badgeId} ` +
        `→ user_badges/${userDoc.id}_${badgeId}`
      );
    }
  }

  console.log(
    `Concluído: ${mirrored} badge(s) para espelhar, ` +
    `${skipped} já existente(s) na raiz ` +
    "(nada escrito em dry-run)"
  );
  if (!EXECUTE && mirrored > 0) {
    console.log("Rode novamente com --execute para gravar.");
  }
}

mirrorAll().catch((err) => {
  console.error("Backfill falhou:", err);
  process.exit(1);
});
