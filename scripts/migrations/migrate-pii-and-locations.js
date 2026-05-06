#!/usr/bin/env node
/**
 * MIGRATION RUNNER: PII + Game Locations
 *
 * Roda as callables one-shot do PR #482 (#433 + #442):
 * - migratePiiToUsersPrivate: copia PII de users → users_private
 * - denormalizeGameLocations: calcula location_lat/lng_approx em games
 *
 * USAGE:
 *   node scripts/migrations/migrate-pii-and-locations.js
 *
 * Requer scripts/serviceAccountKey.json OU ADC (gcloud auth application-default).
 *
 * Idempotente — pode rodar múltiplas vezes sem efeito colateral.
 *
 * Spec: SECFIX #433 STAGE 1, SECFIX #442 STAGE 1
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const PROJECT_ID = 'futebadosparcas';
const PII_FIELDS = [
  'email',
  'fcm_token',
  'birth_date',
  'height_cm',
  'weight_kg',
  'gender',
];

// ==========================================
// SETUP
// ==========================================

function initFirebase() {
  const saPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(saPath)) {
    const sa = require(saPath);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    console.log('✓ Firebase admin via serviceAccountKey.json');
  } else {
    admin.initializeApp({projectId: PROJECT_ID});
    console.log('✓ Firebase admin via ADC (gcloud auth)');
  }
}

// ==========================================
// MIGRATION 1: PII → users_private
// ==========================================

async function migratePii() {
  const db = admin.firestore();
  console.log('\n[1/2] Migrating PII users → users_private...');

  const usersSnap = await db.collection('users').get();
  let migrated = 0;
  let skipped = 0;
  const errors = [];

  const CHUNK = 100;
  const docs = usersSnap.docs;

  for (let i = 0; i < docs.length; i += CHUNK) {
    const chunk = docs.slice(i, i + CHUNK);
    const batch = db.batch();
    let chunkMigrated = 0;

    for (const doc of chunk) {
      const data = doc.data();
      const pii = {};
      for (const field of PII_FIELDS) {
        if (data[field] !== undefined) pii[field] = data[field];
      }

      if (Object.keys(pii).length === 0) {
        skipped++;
        continue;
      }

      try {
        const ref = db.doc(`users_private/${doc.id}`);
        batch.set(
          ref,
          {
            ...pii,
            piiSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
        chunkMigrated++;
      } catch (err) {
        errors.push({uid: doc.id, error: err.message});
      }
    }

    if (chunkMigrated === 0) continue;

    try {
      await batch.commit();
      migrated += chunkMigrated;
      process.stdout.write(`  ${migrated}/${docs.length}\r`);
    } catch (err) {
      console.error(`  Batch ${i} commit failed:`, err.message);
      for (const doc of chunk) {
        errors.push({uid: doc.id, error: err.message});
      }
    }
  }

  console.log(
    `\n  Done: ${migrated} migrated, ${skipped} skipped, ${errors.length} errors`
  );
  if (errors.length > 0 && errors.length < 10) {
    console.error('  Errors:', errors);
  }

  return {migrated, skipped, errors: errors.length, total: docs.length};
}

// ==========================================
// MIGRATION 2: location_*_approx em games
// ==========================================

function roundCoord(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function denormalizeGameLocations() {
  const db = admin.firestore();
  console.log('\n[2/2] Denormalizing game locations...');

  const gamesSnap = await db.collection('games').get();
  let updated = 0;
  let skipped = 0;
  const errors = [];

  const CHUNK = 200;
  const docs = gamesSnap.docs;

  for (let i = 0; i < docs.length; i += CHUNK) {
    const chunk = docs.slice(i, i + CHUNK);
    const batch = db.batch();
    let chunkUpdates = 0;

    for (const doc of chunk) {
      const data = doc.data();

      if (
        typeof data.location_lat !== 'number' ||
        typeof data.location_lng !== 'number'
      ) {
        skipped++;
        continue;
      }

      const latApprox = roundCoord(data.location_lat);
      const lngApprox = roundCoord(data.location_lng);

      if (
        data.location_lat_approx === latApprox &&
        data.location_lng_approx === lngApprox
      ) {
        skipped++;
        continue;
      }

      batch.update(doc.ref, {
        location_lat_approx: latApprox,
        location_lng_approx: lngApprox,
      });
      chunkUpdates++;
    }

    if (chunkUpdates === 0) continue;

    try {
      await batch.commit();
      updated += chunkUpdates;
      process.stdout.write(`  ${updated}/${docs.length}\r`);
    } catch (err) {
      console.error(`  Batch ${i} commit failed:`, err.message);
      for (const doc of chunk) {
        errors.push({gameId: doc.id, error: err.message});
      }
    }
  }

  console.log(
    `\n  Done: ${updated} updated, ${skipped} skipped, ${errors.length} errors`
  );

  return {updated, skipped, errors: errors.length, total: docs.length};
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  initFirebase();

  const start = Date.now();
  const piiResult = await migratePii();
  const locResult = await denormalizeGameLocations();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n✓ Migration complete in ${elapsed}s`);
  console.log('Summary:', JSON.stringify({piiResult, locResult}, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
