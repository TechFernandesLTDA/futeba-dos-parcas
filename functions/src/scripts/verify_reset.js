/**
 * Quick verification and XP reset fix (Phase 4 only).
 * Run after the main reset_data.js timed out.
 */

const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const USER_RESET_FIELDS = {
  experience_points: 0,
  level: 0,
  milestones_achieved: [],
  auto_striker_rating: 0,
  auto_mid_rating: 0,
  auto_defender_rating: 0,
  auto_gk_rating: 0,
  auto_rating_samples: 0,
};

const COLLECTIONS_EXPECTED_EMPTY = [
  "games", "confirmations", "teams", "live_scores", "game_events",
  "xp_logs", "user_badges", "user_streaks", "statistics",
  "season_participation", "seasons", "groups", "group_invites",
  "schedules", "invites", "notifications", "mvp_votes", "activities",
  "ranking_deltas", "app_settings", "badges", "rate_limits", "metrics",
  "error_logs", "audit_logs", "system_locks", "performance_metrics",
  "user_feedback", "monthly_stats", "fields",
];

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   VERIFICATION + XP RESET FIX                   ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ---- 1. Verify all collections are empty ----------------------------------
  console.log("🔍 1. Verifying collections are empty...\n");
  let issues = 0;

  for (const name of COLLECTIONS_EXPECTED_EMPTY) {
    try {
      const snap = await db.collection(name).count().get();
      const count = snap.data().count;
      if (count > 0) {
        console.log(`  ⚠️  ${name}: ${count} docs remaining`);
        issues++;
      } else {
        console.log(`  ✓  ${name}: empty`);
      }
    } catch (_) {
      console.log(`  -  ${name}: skipped`);
    }
  }

  // ---- 2. Verify users -----------------------------------------------------
  console.log("\n👤 2. Checking users...\n");

  const usersSnap = await db.collection("users").get();
  const totalUsers = usersSnap.docs.length;
  console.log(`  Total users: ${totalUsers}`);

  let xpNotZero = 0;
  let levelNotZero = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.experience_points && data.experience_points !== 0) xpNotZero++;
    if (data.level && data.level !== 0) levelNotZero++;
  }

  console.log(`  Users with XP > 0:  ${xpNotZero}`);
  console.log(`  Users with level > 0: ${levelNotZero}`);

  // ---- 3. Fix remaining XP if needed ---------------------------------------
  if (xpNotZero > 0 || levelNotZero > 0) {
    console.log("\n🔄 3. Fixing XP reset...\n");
    let fixed = 0;
    const batch = db.batch();

    for (const doc of usersSnap.docs) {
      // Always reset all, just in case main script left partial state
      batch.update(doc.ref, USER_RESET_FIELDS);
      fixed++;
    }

    await batch.commit();
    console.log(`  ✓ ${fixed} users reset`);
  } else {
    console.log("\n  ✅ All users already have XP=0, level=0");
  }

  // ---- 4. Verify locations preserved ---------------------------------------
  console.log("\n📍 4. Checking locations...\n");
  const locSnap = await db.collection("locations").get();
  console.log(`  Locations preserved: ${locSnap.docs.length}`);
  for (const doc of locSnap.docs) {
    const fieldsSnap = await doc.ref.collection("fields").get();
    console.log(`    ${doc.data().name || doc.id}: ${fieldsSnap.docs.length} fields`);
  }

  // ---- Summary -------------------------------------------------------------
  console.log(`\n${issues > 0 ? '⚠️' : '✅'} Verification complete. Issues found: ${issues}`);
  if (issues > 0) {
    console.log("Some collections still have data. Re-run manually if needed.");
  }
}

main().catch(console.error);
