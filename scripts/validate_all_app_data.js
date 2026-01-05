/**
 * Validação completa de todos os dados críticos do app
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function validateAll() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     VALIDAÇÃO COMPLETA DO APP                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let errors = [];
  let warnings = [];

  try {
    // 1. Validar Users
    console.log('1️⃣  Validando Users...\n');
    const usersSnapshot = await db.collection('users').limit(5).get();

    if (usersSnapshot.empty) {
      errors.push('❌ Nenhum user encontrado!');
    } else {
      console.log(`   ✅ ${usersSnapshot.size} users encontrados`);

      // Verificar estrutura
      const firstUser = usersSnapshot.docs[0];
      const userData = firstUser.data();

      console.log(`   📊 User de exemplo (${firstUser.id}):`);
      console.log(`      - name: ${userData.name || 'MISSING'}`);
      console.log(`      - email: ${userData.email || 'MISSING'}`);
      console.log(`      - Campo 'id': ${userData.id !== undefined ? 'EXISTE (PROBLEMA!)' : 'NÃO EXISTE (OK)'}`);
      console.log(`      - level: ${userData.level || 'MISSING'}`);
      console.log(`      - experience_points: ${userData.experience_points || 0}\n`);

      if (userData.id !== undefined) {
        warnings.push('⚠️  Users têm campo "id" - conflito com @DocumentId');
      }
    }

    // 2. Validar Seasons
    console.log('2️⃣  Validando Seasons...\n');
    const seasonsSnapshot = await db.collection('seasons').get();

    if (seasonsSnapshot.empty) {
      errors.push('❌ Nenhuma season encontrada!');
    } else {
      const activeSeasons = seasonsSnapshot.docs.filter(doc =>
        doc.data().is_active === true || doc.data().isActive === true
      );

      console.log(`   ✅ ${seasonsSnapshot.size} seasons total`);
      console.log(`   ✅ ${activeSeasons.length} seasons ativas\n`);

      activeSeasons.forEach(doc => {
        const data = doc.data();
        console.log(`   📅 ${data.name} (${doc.id})`);
      });
      console.log();
    }

    // 3. Validar Season Participation
    console.log('3️⃣  Validando Season Participation...\n');
    const partsSnapshot = await db.collection('season_participation')
      .where('season_id', '==', 'monthly_2026_01')
      .get();

    if (partsSnapshot.empty) {
      warnings.push('⚠️  Nenhuma participação em Janeiro 2026');
    } else {
      console.log(`   ✅ ${partsSnapshot.size} participações em Janeiro 2026\n`);

      partsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   📊 user_id: ${data.user_id.substring(0, 10)}...`);
        console.log(`      - division: ${data.division} (type: ${typeof data.division})`);
        console.log(`      - league_rating: ${data.league_rating}`);
        console.log(`      - points: ${data.points}`);
        console.log(`      - games_played: ${data.games_played}\n`);
      });
    }

    // 4. Validar Games
    console.log('4️⃣  Validando Games...\n');
    const gamesSnapshot = await db.collection('games')
      .orderBy('date', 'desc')
      .limit(5)
      .get();

    if (gamesSnapshot.empty) {
      errors.push('❌ Nenhum game encontrado!');
    } else {
      console.log(`   ✅ ${gamesSnapshot.size} games recentes encontrados\n`);

      const firstGame = gamesSnapshot.docs[0];
      const gameData = firstGame.data();
      console.log(`   🎮 Game mais recente: ${gameData.date}`);
      console.log(`      - status: ${gameData.status}`);
      console.log(`      - confirmations: ${gameData.confirmations?.length || 0}\n`);
    }

    // 5. Validar XP Logs
    console.log('5️⃣  Validando XP Logs...\n');
    const xpLogsSnapshot = await db.collection('xp_logs')
      .orderBy('created_at', 'desc')
      .limit(5)
      .get();

    if (xpLogsSnapshot.empty) {
      warnings.push('⚠️  Nenhum XP log encontrado');
    } else {
      console.log(`   ✅ ${xpLogsSnapshot.size} XP logs recentes\n`);

      const firstLog = xpLogsSnapshot.docs[0];
      const logData = firstLog.data();
      console.log(`   📈 XP Log mais recente:`);
      console.log(`      - user_id: ${logData.user_id?.substring(0, 10) || 'MISSING'}...`);
      console.log(`      - xp_earned: ${logData.xp_earned || 'MISSING'}`);
      console.log(`      - game_id: ${logData.game_id?.substring(0, 10) || 'MISSING'}...\n`);
    }

    // 6. Validar Badges
    console.log('6️⃣  Validando User Badges...\n');
    const badgesSnapshot = await db.collection('user_badges')
      .orderBy('unlocked_at', 'desc')
      .limit(5)
      .get();

    if (badgesSnapshot.empty) {
      warnings.push('⚠️  Nenhum badge encontrado');
    } else {
      console.log(`   ✅ ${badgesSnapshot.size} badges recentes\n`);
    }

    // 7. Validar Statistics
    console.log('7️⃣  Validando Statistics...\n');
    const statsSnapshot = await db.collection('statistics')
      .limit(5)
      .get();

    if (statsSnapshot.empty) {
      warnings.push('⚠️  Nenhuma estatística encontrada');
    } else {
      console.log(`   ✅ ${statsSnapshot.size} estatísticas encontradas\n`);

      const firstStat = statsSnapshot.docs[0];
      const statData = firstStat.data();
      console.log(`   📊 Estatística de exemplo:`);
      console.log(`      - user_id: ${statData.user_id?.substring(0, 10) || 'MISSING'}...`);
      console.log(`      - total_games: ${statData.total_games || 0}`);
      console.log(`      - total_goals: ${statData.total_goals || 0}\n`);
    }

    // 8. Testar query crítica do LeagueViewModel
    console.log('8️⃣  Testando query crítica (FieldPath.documentId())...\n');

    const testUserIds = partsSnapshot.docs.slice(0, 3).map(doc => doc.data().user_id);

    if (testUserIds.length > 0) {
      const userQuerySnapshot = await db.collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', testUserIds)
        .get();

      if (userQuerySnapshot.empty) {
        errors.push('❌ Query com FieldPath.documentId() não retornou resultados!');
      } else {
        console.log(`   ✅ Query retornou ${userQuerySnapshot.size}/${testUserIds.length} users\n`);

        userQuerySnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`      - ${data.name} (${doc.id})`);
        });
        console.log();
      }
    }

    // RESUMO FINAL
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMO DA VALIDAÇÃO                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    if (errors.length > 0) {
      console.log('❌ ERROS CRÍTICOS:\n');
      errors.forEach(err => console.log(`   ${err}`));
      console.log();
    }

    if (warnings.length > 0) {
      console.log('⚠️  AVISOS:\n');
      warnings.forEach(warn => console.log(`   ${warn}`));
      console.log();
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ TUDO OK! Nenhum problema encontrado.\n');
    } else if (errors.length === 0) {
      console.log('✅ Sem erros críticos, apenas avisos.\n');
    } else {
      console.log('❌ Existem erros que precisam ser corrigidos!\n');
    }

  } catch (error) {
    console.error('\n❌ ERRO DURANTE VALIDAÇÃO:', error);
  }

  process.exit(0);
}

validateAll();
