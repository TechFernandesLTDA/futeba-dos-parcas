/**
 * Análise Detalhada de Estatísticas e Jogos
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('pt-BR');
}

async function analyzeDetailed() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║          ANÁLISE DETALHADA - ESTATÍSTICAS E JOGOS                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  try {
    // ============================================
    // 1. COLETAR USUÁRIOS
    // ============================================
    console.log('1️⃣  CARREGANDO USUÁRIOS...\n');
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map();

    usersSnapshot.forEach(doc => {
      usersMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    console.log(`   ✅ ${usersSnapshot.size} usuários carregados\n`);

    // ============================================
    // 2. ESTATÍSTICAS DETALHADAS
    // ============================================
    console.log('2️⃣  ESTATÍSTICAS POR JOGADOR...\n');
    const statsSnapshot = await db.collection('statistics').get();

    for (const doc of statsSnapshot.docs) {
      const stat = doc.data();
      const user = usersMap.get(stat.player_id || stat.user_id);

      if (user) {
        console.log(`   👤 ${user.name} (${user.nickname || ''})`);
        console.log(`      - Documento ID: ${doc.id}`);
        console.log(`      - Player ID: ${stat.player_id || stat.user_id}`);
        console.log(`      - Group ID: ${stat.group_id || 'N/A'}`);
        console.log(`      - Jogos: ${stat.total_games || stat.games_played || 0}`);
        console.log(`      - Gols: ${stat.goals || 0}`);
        console.log(`      - Assistências: ${stat.assists || 0}`);
        console.log(`      - MVP: ${stat.mvp_count || 0}`);
        console.log(`      - Vitórias: ${stat.wins || 0}`);
        console.log(`      - Derrotas: ${stat.losses || 0}`);
        console.log(`      - Defesas: ${stat.saves || 0}`);
        console.log(`      - Gols Sofridos: ${stat.goals_conceded || 0}`);
        console.log(`      - Clean Sheets: ${stat.clean_sheets || 0}`);
        console.log(`      - Rating Atacante: ${stat.striker_rating || 'N/A'}`);
        console.log(`      - Rating Meio: ${stat.mid_rating || 'N/A'}`);
        console.log(`      - Rating Defensor: ${stat.defender_rating || 'N/A'}`);
        console.log(`      - Rating Goleiro: ${stat.gk_rating || 'N/A'}`);
        console.log('');
      }
    }

    // ============================================
    // 3. TODOS OS JOGOS (não apenas finalizados)
    // ============================================
    console.log('3️⃣  TODOS OS JOGOS (POR STATUS)...\n');

    const statuses = ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'];

    for (const status of statuses) {
      const gamesSnapshot = await db.collection('games')
        .where('status', '==', status)
        .orderBy('dateTime', 'desc')
        .limit(10)
        .get();

      if (!gamesSnapshot.empty) {
        console.log(`   🎮 Status: ${status} (${gamesSnapshot.size} jogos)\n`);

        gamesSnapshot.forEach(doc => {
          const game = doc.data();
          const owner = usersMap.get(game.owner_id);

          console.log(`      - ${game.title || 'Sem título'} (${doc.id})`);
          console.log(`        Data: ${formatDate(game.dateTime)}`);
          console.log(`        Organizador: ${owner?.name || 'N/A'}`);
          console.log(`        Local: ${game.location_name || 'N/A'}`);
          console.log(`        Confirmados: ${game.confirmations?.length || 0}`);

          if (game.status === 'FINISHED') {
            console.log(`        Placar: ${game.team_a_score || 0} x ${game.team_b_score || 0}`);
            console.log(`        MVP: ${usersMap.get(game.mvp_id)?.name || 'N/A'}`);
          }

          console.log('');
        });
      }
    }

    // ============================================
    // 4. PARTICIPAÇÃO EM TEMPORADAS
    // ============================================
    console.log('4️⃣  PARTICIPAÇÃO EM TEMPORADAS...\n');
    const seasonParticipationSnapshot = await db.collection('season_participation').get();

    if (!seasonParticipationSnapshot.empty) {
      console.log(`   ✅ ${seasonParticipationSnapshot.size} registros de participação\n`);

      for (const doc of seasonParticipationSnapshot.docs) {
        const part = doc.data();
        const user = usersMap.get(part.user_id);

        if (user) {
          console.log(`   👤 ${user.name}`);
          console.log(`      - Temporada: ${part.season_id}`);
          console.log(`      - Divisão: ${part.division || 'N/A'}`);
          console.log(`      - Rating da Liga: ${part.league_rating || 'N/A'}`);
          console.log(`      - Pontos: ${part.points || 0}`);
          console.log(`      - Jogos: ${part.games_played || 0}`);
          console.log(`      - Vitórias: ${part.wins || 0}`);
          console.log(`      - Empates: ${part.draws || 0}`);
          console.log(`      - Derrotas: ${part.losses || 0}`);
          console.log(`      - Gols Pró: ${part.goals_for || 0}`);
          console.log(`      - Gols Contra: ${part.goals_against || 0}`);
          console.log(`      - Saldo de Gols: ${(part.goals_for || 0) - (part.goals_against || 0)}`);
          console.log('');
        }
      }
    }

    // ============================================
    // 5. RANKING DELTAS (INCREMENTOS)
    // ============================================
    console.log('5️⃣  RANKING DELTAS (INCREMENTOS RECENTES)...\n');
    const deltasSnapshot = await db.collection('ranking_deltas')
      .orderBy('created_at', 'desc')
      .limit(20)
      .get();

    if (!deltasSnapshot.empty) {
      console.log(`   ✅ ${deltasSnapshot.size} incrementos recentes\n`);

      for (const doc of deltasSnapshot.docs) {
        const delta = doc.data();
        const user = usersMap.get(delta.user_id);

        console.log(`   👤 ${user?.name || 'N/A'}`);
        console.log(`      - Jogo: ${delta.game_id?.substring(0, 10)}...`);
        console.log(`      - Período: ${delta.period} (${delta.period_key})`);
        console.log(`      - Gols: +${delta.goals_added || 0}`);
        console.log(`      - Assistências: +${delta.assists_added || 0}`);
        console.log(`      - MVP: +${delta.mvp_added || 0}`);
        console.log(`      - Vitórias: +${delta.wins_added || 0}`);
        console.log(`      - Jogos: +${delta.games_added || 0}`);
        console.log(`      - XP: +${delta.xp_added || 0}`);
        console.log(`      - Defesas: +${delta.saves_added || 0}`);
        console.log(`      - Data: ${formatDate(delta.created_at)}`);
        console.log('');
      }
    }

    // ============================================
    // 6. DETALHES DOS BADGES
    // ============================================
    console.log('6️⃣  DETALHES DOS BADGES...\n');
    const badgesSnapshot = await db.collection('user_badges')
      .orderBy('unlocked_at', 'desc')
      .get();

    console.log(`   ✅ ${badgesSnapshot.size} badges totais\n`);

    // Agrupar por tipo de badge
    const badgesByType = new Map();
    const badgesByUser = new Map();

    for (const doc of badgesSnapshot.docs) {
      const badge = doc.data();
      const user = usersMap.get(badge.user_id);
      const badgeType = badge.badge_id || badge.badgeName || 'UNKNOWN';

      if (!badgesByType.has(badgeType)) {
        badgesByType.set(badgeType, []);
      }
      badgesByType.get(badgeType).push({ user, badge });

      if (!badgesByUser.has(badge.user_id)) {
        badgesByUser.set(badge.user_id, []);
      }
      badgesByUser.get(badge.user_id).push(badge);
    }

    console.log('   📊 Por Tipo de Badge:\n');
    for (const [badgeType, items] of badgesByType) {
      console.log(`      - ${badgeType}: ${items.length} ocorrência(ões)`);
    }

    console.log('\n   👨‍💼 Por Usuário:\n');
    for (const [userId, badges] of badgesByUser) {
      const user = usersMap.get(userId);
      console.log(`      - ${user?.name || 'N/A'}: ${badges.length} badges`);

      // Mostrar badges únicas
      const uniqueBadges = [...new Set(badges.map(b => b.badge_id || b.badgeName))];
      uniqueBadges.forEach(b => {
        console.log(`        • ${b}`);
      });
    }

    console.log('');

    // ============================================
    // 7. TEMPORADAS
    // ============================================
    console.log('7️⃣  TEMPORADAS...\n');
    const seasonsSnapshot = await db.collection('seasons')
      .orderBy('start_date', 'desc')
      .get();

    if (!seasonsSnapshot.empty) {
      console.log(`   ✅ ${seasonsSnapshot.size} temporadas\n`);

      for (const doc of seasonsSnapshot.docs) {
        const season = doc.data();
        console.log(`   📅 ${season.name || 'Sem nome'} (${doc.id})`);
        console.log(`      - Ativa: ${season.is_active ? 'Sim' : 'Não'}`);
        console.log(`      - Início: ${formatDate(season.start_date)}`);
        console.log(`      - Fim: ${formatDate(season.end_date)}`);
        console.log(`      - Descrição: ${season.description || 'N/A'}`);
        console.log('');
      }
    }

    console.log('✅ Análise detalhada concluída!\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

analyzeDetailed();
