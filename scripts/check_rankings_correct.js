/**
 * Verifica as collections corretas de rankings e season
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCorrectCollections() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('VERIFICANDO COLLECTIONS CORRETAS');
  console.log('════════════════════════════════════════════════════════\n');

  // 1. ranking_deltas
  console.log('📊 RANKING_DELTAS\n');
  const rankingDeltasSnapshot = await db.collection('ranking_deltas').get();
  console.log(`Total: ${rankingDeltasSnapshot.size}\n`);

  if (rankingDeltasSnapshot.size > 0) {
    const sampleDocs = rankingDeltasSnapshot.docs.slice(0, 5);
    for (const doc of sampleDocs) {
      const data = doc.data();
      console.log(`  ${doc.id}:`);
      console.log(`    User: ${data.user_id}`);
      console.log(`    Period: ${data.period} (${data.period_key})`);
      console.log(`    Jogos: ${data.games_added || 0}, XP: ${data.xp_added || 0}`);
      console.log('');
    }
  } else {
    console.log('  ❌ Vazio!\n');
  }

  // 2. season_participation (singular)
  console.log('🏆 SEASON_PARTICIPATION\n');
  const seasonParticipationSnapshot = await db.collection('season_participation').get();
  console.log(`Total: ${seasonParticipationSnapshot.size}\n`);

  if (seasonParticipationSnapshot.size > 0) {
    seasonParticipationSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}:`);
      console.log(`    User: ${data.user_id}`);
      console.log(`    Season: ${data.season_id}`);
      console.log(`    Pontos: ${data.points || 0}`);
      console.log(`    Jogos: ${data.games_played || 0}`);
      console.log(`    Vitórias: ${data.wins || 0}`);
      console.log('');
    });
  } else {
    console.log('  ❌ Vazio!\n');
  }

  // 3. Verificar se há season ativa
  console.log('📅 SEASONS ATIVAS\n');
  const activeSeasonsSnapshot = await db.collection('seasons')
    .where('is_active', '==', true)
    .get();

  if (activeSeasonsSnapshot.empty) {
    console.log('  ⚠️  Nenhuma season ativa!\n');
  } else {
    activeSeasonsSnapshot.forEach(doc => {
      const season = doc.data();
      console.log(`  ${doc.id}: ${season.name}`);
    });
    console.log('');
  }

  // 4. Verificar users com XP
  console.log('👥 USUÁRIOS COM XP\n');
  const usersSnapshot = await db.collection('users').get();

  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    console.log(`  ${user.name}:`);
    console.log(`    XP: ${user.experience_points || 0}`);
    console.log(`    Level: ${user.level || 0}`);
  }
  console.log('');

  console.log('════════════════════════════════════════════════════════');
  console.log('DIAGNÓSTICO');
  console.log('════════════════════════════════════════════════════════\n');

  if (rankingDeltasSnapshot.size === 0) {
    console.log('❌ PROBLEMA: ranking_deltas está vazio');
    console.log('   A Cloud Function não está criando os deltas de ranking.\n');
  } else {
    console.log('✅ ranking_deltas tem dados\n');
  }

  if (seasonParticipationSnapshot.size === 0) {
    console.log('❌ PROBLEMA: season_participation está vazio');
    console.log('   A Cloud Function não está registrando participação nas seasons.\n');

    if (activeSeasonsSnapshot.empty) {
      console.log('💡 CAUSA: Nenhuma season ativa quando os jogos foram processados!');
      console.log('   A função só cria participação se houver uma season ativa.\n');
    }
  } else {
    console.log('✅ season_participation tem dados\n');
  }

  process.exit(0);
}

checkCorrectCollections();
