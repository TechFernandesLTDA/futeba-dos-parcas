#!/usr/bin/env node

/**
 * Backfills the canonical IANA timezone on legacy location documents.
 *
 * Dry-run is the default:
 *   node scripts/migrations/backfill-location-time-zones.js
 *
 * Apply changes explicitly:
 *   node scripts/migrations/backfill-location-time-zones.js --execute
 *
 * Application Default Credentials are required only in execute/remote runs.
 */

const DEFAULT_LOCATION_TIME_ZONE = "America/Sao_Paulo";
const MAX_BATCH_WRITES = 400;

function isValidIanaTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format(0);
    return true;
  } catch {
    return false;
  }
}

function planLocationTimeZoneBackfill(data) {
  const hasField = Object.prototype.hasOwnProperty.call(data, "time_zone");
  const value = data.time_zone;

  if (!hasField || value === null || (typeof value === "string" && !value.trim())) {
    return {
      action: "backfill",
      timeZone: DEFAULT_LOCATION_TIME_ZONE,
      reason: hasField ? "empty" : "missing",
    };
  }

  if (!isValidIanaTimeZone(value)) {
    return { action: "manual-review", reason: "invalid" };
  }

  return { action: "keep", timeZone: value.trim(), reason: "valid" };
}

function parseProjectId(argv) {
  const index = argv.indexOf("--project");
  if (index === -1) return undefined;
  const projectId = argv[index + 1];
  if (!projectId || projectId.startsWith("--")) {
    throw new Error("--project requires a Firebase project id");
  }
  return projectId;
}

async function run(argv = process.argv.slice(2)) {
  const execute = argv.includes("--execute");
  const projectId = parseProjectId(argv);
  const admin = require("firebase-admin");

  if (!admin.apps.length) {
    admin.initializeApp(projectId ? { projectId } : undefined);
  }

  const db = admin.firestore();
  const snapshot = await db.collection("locations").get();
  const stats = { scanned: snapshot.size, backfill: 0, kept: 0, manualReview: 0, written: 0 };
  let batch = db.batch();
  let pendingWrites = 0;

  const commitBatch = async () => {
    if (!execute || pendingWrites === 0) return;
    await batch.commit();
    stats.written += pendingWrites;
    batch = db.batch();
    pendingWrites = 0;
  };

  for (const document of snapshot.docs) {
    const plan = planLocationTimeZoneBackfill(document.data());
    if (plan.action === "keep") {
      stats.kept += 1;
      continue;
    }
    if (plan.action === "manual-review") {
      stats.manualReview += 1;
      console.warn(`[manual-review] locations/${document.id}: invalid time_zone`);
      continue;
    }

    stats.backfill += 1;
    console.log(`[${execute ? "write" : "dry-run"}] locations/${document.id}: ` +
      `${plan.reason} -> ${plan.timeZone}`);
    if (execute) {
      batch.update(document.ref, {
        time_zone: plan.timeZone,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      pendingWrites += 1;
      if (pendingWrites >= MAX_BATCH_WRITES) await commitBatch();
    }
  }

  await commitBatch();
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", ...stats }, null, 2));

  if (stats.manualReview > 0) process.exitCode = 2;
  return stats;
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_LOCATION_TIME_ZONE,
  isValidIanaTimeZone,
  planLocationTimeZoneBackfill,
  run,
};
