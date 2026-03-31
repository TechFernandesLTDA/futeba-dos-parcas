/**
 * Diagnóstico do problema de loading infinito na tela Liga
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function diagnose() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     DIAGNÓSTICO: LEAGUE LOADING INFINITO                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Verificar season_participation para Janeiro 2026
    console.log('1️⃣  Verificando season_participation para Janeiro 2026...\n');
    const partsSnapshot = await db.collection('season_participation')
      .where('season_id', '==', 'monthly_2026_01')
      .orderBy('points', 'desc')
      .get();

    console.log(`   Total de participações: ${partsSnapshot.size}\n`);

    const userIdsFromParts = [];

    partsSnapshot.forEach(doc => {
      const data = doc.data();
      userIdsFromParts.push(data.user_id);
      console.log(`   📊 Participação:
      - user_id: ${data.user_id}
      - division: ${data.division} (type: ${typeof data.division})
      - league_rating: ${data.league_rating}
      - points: ${data.points}
      - games_played: ${data.games_played}\n`);
    });

    // 2. Verificar se users tem campo "id"
    console.log('\n2️⃣  Verificando se users tem campo "id"...\n');

    for (const userId of userIdsFromParts.slice(0, 4)) {
      const userDoc = await db.collection('users').doc(userId).get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`   👤 User ${userId}:
      - Doc ID: ${userDoc.id}
      - Campo "id": ${userData.id || 'NÃO EXISTE'}
      - Nome: ${userData.name}
      - Email: ${userData.email}\n`);
      }
    }

    // 3. Testar query que o app usa (whereIn com campo "id")
    console.log('\n3️⃣  Testando query do app: whereIn("id", userIds)...\n');

    const testUserIds = userIdsFromParts.slice(0, 3);
    const querySnapshot = await db.collection('users')
      .where('id', 'in', testUserIds)
      .get();

    console.log(`   Resultado: ${querySnapshot.size} users encontrados\n`);

    if (querySnapshot.empty) {
      console.log('   ❌ PROBLEMA ENCONTRADO: Query whereIn("id", ...) não retorna nada!');
      console.log('   O app não consegue buscar os dados dos usuários.\n');
    }

    // 4. Solução: Verificar se podemos usar FieldPath.documentId()
    console.log('\n4️⃣  Testando solução: usar documentId()...\n');

    const docIdSnapshot = await db.collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', testUserIds)
      .get();

    console.log(`   Resultado: ${docIdSnapshot.size} users encontrados\n`);

    docIdSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   ✅ ${data.name} - ${doc.id}`);
    });

    // 5. Verificar season
    console.log('\n\n5️⃣  Verificando season Janeiro 2026...\n');

    const seasonDoc = await db.collection('seasons').doc('monthly_2026_01').get();

    if (seasonDoc.exists) {
      const seasonData = seasonDoc.data();
      console.log(`   Season: ${seasonData.name}
      - is_active: ${seasonData.is_active}
      - start_date: ${seasonData.start_date}
      - end_date: ${seasonData.end_date}\n`);
    } else {
      console.log('   ❌ Season não encontrada!\n');
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    DIAGNÓSTICO COMPLETO                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  }

  process.exit(0);
}

diagnose();
