#!/usr/bin/env node
/**
 * STAGE 3 CLEANUP RUNNER (#433)
 *
 * Remove PII fields (email, fcm_token, birth_date, height_cm, weight_kg, gender)
 * de users docs. PII permanece em users_private (já populada via Stage 1+2).
 *
 * USAGE:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *     node scripts/migrations/cleanup-pii-from-users.js
 *
 * SAFETY:
 * - Idempotente (skip se PII já removida)
 * - Verifica que users_private existe ANTES de deletar de users
 * - Aborta se algum user não tem users_private populado
 *
 * Pré-requisitos:
 * - PR #482 (Stage 1) deployado e migratePiiToUsersPrivate rodada
 * - PR #484 (Stage 2) deployado (Android lê users_private)
 * - users_private populado pra todos os users (verifica)
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

function initFirebase() {
  const saPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(saPath)) {
    const sa = require(saPath);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    console.log('✓ via serviceAccountKey.json');
  } else {
    admin.initializeApp({projectId: PROJECT_ID});
    console.log('✓ via ADC');
  }
}

async function verifyPrivateBackfill() {
  const db = admin.firestore();
  console.log('\n[Pre-check] Verificando users_private backfill...');

  const usersSnap = await db.collection('users').get();
  const total = usersSnap.docs.length;

  let missingPrivate = 0;
  const missing = [];

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();

    // User tem PII em users? Verifica se users_private existe
    const hasPiiInUsers = PII_FIELDS.some((f) => userData[f] != null);
    if (!hasPiiInUsers) continue;

    const privateDoc = await db.doc(`users_private/${userDoc.id}`).get();
    if (!privateDoc.exists) {
      missingPrivate++;
      if (missing.length < 5) missing.push(userDoc.id);
    }
  }

  console.log(`  Total users: ${total}, missing users_private: ${missingPrivate}`);
  if (missingPrivate > 0) {
    console.error(`❌ ABORT: ${missingPrivate} users sem users_private. Sample: ${missing.join(',')}`);
    console.error('   Run migrate-pii-and-locations.js primeiro pra backfill.');
    process.exit(1);
  }
  console.log('  ✓ All users with PII have users_private populated');
}

async function cleanupPiiFromUsers() {
  const db = admin.firestore();
  console.log('\n[Cleanup] Removing PII from users docs...');

  const usersSnap = await db.collection('users').get();
  let cleaned = 0;
  let skipped = 0;
  const errors = [];

  const CHUNK = 200;
  const docs = usersSnap.docs;

  for (let i = 0; i < docs.length; i += CHUNK) {
    const chunk = docs.slice(i, i + CHUNK);
    const batch = db.batch();
    let chunkCleans = 0;

    for (const userDoc of chunk) {
      const data = userDoc.data();
      const fieldsToDelete = {};
      let hasAny = false;

      for (const field of PII_FIELDS) {
        if (data[field] !== undefined && data[field] !== null) {
          fieldsToDelete[field] = admin.firestore.FieldValue.delete();
          hasAny = true;
        }
      }

      if (!hasAny) {
        skipped++;
        continue;
      }

      batch.update(userDoc.ref, fieldsToDelete);
      chunkCleans++;
    }

    if (chunkCleans === 0) continue;

    try {
      await batch.commit();
      cleaned += chunkCleans;
      process.stdout.write(`  ${cleaned}/${docs.length}\r`);
    } catch (err) {
      console.error(`  Batch ${i} failed:`, err.message);
      for (const userDoc of chunk) {
        errors.push({uid: userDoc.id, error: err.message});
      }
    }
  }

  console.log(`\n  Done: ${cleaned} cleaned, ${skipped} skipped, ${errors.length} errors`);
  return {cleaned, skipped, errors: errors.length, total: docs.length};
}

async function main() {
  initFirebase();
  const start = Date.now();

  await verifyPrivateBackfill();
  const result = await cleanupPiiFromUsers();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✓ Stage 3 cleanup done in ${elapsed}s`);
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
