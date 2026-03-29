/**
 * Força update em todos season_participation para triggerar recálculo automático
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function triggerRecalc() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     TRIGGERING RATING RECALCULATION                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const parts = await db.collection('season_participation').get();

  console.log(`Updating ${parts.size} participations to trigger Cloud Function...\n`);

  const batch = db.batch();
  let count = 0;

  parts.forEach(doc => {
    // Force um update mínimo para triggerar a Cloud Function
    batch.update(doc.ref, {
      last_calculated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    count++;
  });

  await batch.commit();

  console.log(`✅ ${count} documentos atualizados!`);
  console.log('\n⏱️  Aguarde ~30s para a Cloud Function processar...\n');

  process.exit(0);
}

triggerRecalc();
