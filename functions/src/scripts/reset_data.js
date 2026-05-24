/**
 * Data Reset Script — Launch Preparation
 *
 * KEEPS:  users (reset XP), locations + subcollections (courts/quadras)
 * DELETES: everything else (games, groups, stats, XP logs, etc.)
 *
 * Usage: node functions/src/scripts/reset_data.js
 * Requires: gcloud auth application-default login
 */

const admin = require("firebase-admin");

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BATCH_SIZE = 400; // conservative (Firestore limit is 500)

// Collections to completely delete (including subcollections)
// These will be processed with recursiveDelete or manual batch delete
const COLLECTIONS_TO_DELETE = [
  "games",              // + sub: waitlist
  "confirmations",
  "teams",
  "live_scores",
  "game_events",
  "xp_logs",
  "user_badges",
  "user_streaks",
  "statistics",
  "season_participation",
  "seasons",            // + sub: final_standings
  "groups",             // + sub: members, cashbox, cashbox_summary, join_requests
  "group_invites",
  "schedules",
  "invites",
  "notifications",
  "mvp_votes",
  "activities",
  "ranking_deltas",
  "app_settings",
  "badges",
  "rate_limits",
  "metrics",
  "error_logs",
  "audit_logs",
  "system_locks",
  "performance_metrics",
  "user_feedback",
  "monthly_stats",
  "fields",             // legacy root-level courts collection
];

// XP fields to reset on each user document
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

// User subcollections to delete
const USER_SUBCOLLECTIONS = ["groups", "rating_history"];

// Collections with known subcollections (must delete subcollections first)
const COLLECTIONS_WITH_SUBS = {
  games: ["waitlist"],
  groups: ["members", "cashbox", "cashbox_summary", "join_requests"],
  seasons: ["final_standings"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Delete all documents in a collection using batched writes.
 * Returns the number of documents deleted.
 */
async function batchDeleteCollection(collectionRef) {
  let deleted = 0;
  let snapshot = await collectionRef.limit(BATCH_SIZE).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.length;
    process.stdout.write(`\r    ${deleted} deleted...`);
    snapshot = await collectionRef.limit(BATCH_SIZE).get();
  }

  if (deleted > 0) process.stdout.write("\n");
  return deleted;
}

/**
 * Delete a subcollection across all parent documents.
 */
async function deleteSubcollection(parentCollection, subName) {
  const parentsSnap = await db.collection(parentCollection).get();
  let total = 0;

  for (const parentDoc of parentsSnap.docs) {
    const subRef = parentDoc.ref.collection(subName);
    const count = await batchDeleteCollection(subRef);
    total += count;
  }

  if (total > 0) {
    console.log(`    → ${parentCollection}/*/${subName}: ${total} documents deleted`);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   FUTEBADOSPARCAS — DATA RESET FOR LAUNCH       ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");

  // ---- PHASE 0: Pre-flight check -----------------------------------------
  console.log("🔍 Phase 0: Pre-flight check...\n");

  // Count total documents to give user an idea
  console.log("  Counting documents per collection:\n");
  let totalDocsToDelete = 0;

  for (const name of COLLECTIONS_TO_DELETE) {
    try {
      const countSnap = await db.collection(name).count().get();
      const count = countSnap.data().count;
      totalDocsToDelete += count;
      const marker = count > 0 ? `⚠️  ${count}` : "✓ 0";
      console.log(`    ${marker.padEnd(18)} ${name}`);
    } catch (_) {
      console.log(`    (skip)            ${name} — not accessible`);
    }
  }

  // Count users
  const usersCountSnap = await db.collection("users").count().get();
  const usersCount = usersCountSnap.data().count;
  console.log(`    📋 ${usersCount.toString().padEnd(17)} users (will RESET XP)`);

  // Count locations (untouched)
  const locCountSnap = await db.collection("locations").count().get();
  const locCount = locCountSnap.data().count;
  console.log(`    ✅ ${locCount.toString().padEnd(17)} locations (untouched)`);

  console.log(`\n  Total documents to delete: ${totalDocsToDelete}`);
  console.log(`  Total users to reset:      ${usersCount}`);

  // ---- PHASE 1: Delete subcollections of collections-to-delete ------------
  console.log("\n🗑️  Phase 1: Deleting subcollections...\n");

  for (const [parentName, subNames] of Object.entries(COLLECTIONS_WITH_SUBS)) {
    console.log(`  Deleting subcollections of ${parentName}:`);
    for (const subName of subNames) {
      await deleteSubcollection(parentName, subName);
    }
  }

  // ---- PHASE 2: Delete top-level collections ------------------------------
  console.log("\n🗑️  Phase 2: Deleting top-level collections...\n");

  for (const name of COLLECTIONS_TO_DELETE) {
    try {
      process.stdout.write(`  ${name}: `);
      const ref = db.collection(name);
      const deleted = await batchDeleteCollection(ref);
      if (deleted > 0) {
        console.log(`  ✓ ${name}: ${deleted} documents deleted`);
      } else {
        console.log(`  ✓ ${name}: already empty`);
      }
    } catch (err) {
      console.log(`  ✗ ${name}: ERROR — ${err.message}`);
    }
  }

  // ---- PHASE 3: Delete user subcollections --------------------------------
  console.log("\n🗑️  Phase 3: Deleting user subcollections...\n");

  for (const subName of USER_SUBCOLLECTIONS) {
    console.log(`  Deleting users/*/${subName}:`);
    await deleteSubcollection("users", subName);
  }

  // ---- PHASE 4: Reset XP on all users ------------------------------------
  console.log("\n🔄 Phase 4: Resetting XP on all users...\n");

  let userResetCount = 0;
  let userSnapshot = await db.collection("users").limit(BATCH_SIZE).get();

  while (!userSnapshot.empty) {
    const batch = db.batch();
    userSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, USER_RESET_FIELDS);
    });
    await batch.commit();
    userResetCount += userSnapshot.docs.length;
    process.stdout.write(`\r    ${userResetCount}/${usersCount} users reset...`);
    userSnapshot = await db.collection("users").limit(BATCH_SIZE).get();
  }

  if (userResetCount > 0) process.stdout.write("\n");
  console.log(`  ✓ ${userResetCount} users reset`);

  // ---- PHASE 5: Verify ----------------------------------------------------
  console.log("\n✅ Phase 5: Verification...\n");

  // Check if any game still exists
  const gameCheck = await db.collection("games").count().get();
  const remainingGames = gameCheck.data().count;
  console.log(`  games remaining: ${remainingGames}`);

  // Sample a user to verify XP reset
  const sampleUser = await db.collection("users").limit(1).get();
  if (!sampleUser.empty) {
    const data = sampleUser.docs[0].data();
    console.log(`  Sample user XP:  ${data.experience_points} (should be 0)`);
    console.log(`  Sample user lvl: ${data.level} (should be 0)`);
  }

  // ---- DONE ---------------------------------------------------------------
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Reset complete in ${elapsed}s!`);
  console.log("   Accounts (users) and courts (locations/fields) preserved.");
  console.log("   All XP, games, groups, and statistics cleared.");
}

main().catch((err) => {
  console.error("\n❌ FATAL ERROR:", err);
  process.exit(1);
});
