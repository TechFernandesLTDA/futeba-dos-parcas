/**
 * Análise Completa dos Dados do Firebase - Futeba dos Parças
 * Coleta todos os dados de usuários, grupos, jogos, estatísticas, XP e badges
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Formata timestamp para display
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('pt-BR');
}

// Formata nome do jogador
function formatPlayerName(userData) {
  if (userData.nickname) return `${userData.nickname} (${userData.name})`;
  return userData.name || 'Usuário Sem Nome';
}

async function analyzeData() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       ANÁLISE COMPLETA DOS DADOS DO FIREBASE                      ║');
  console.log('║              Futeba dos Parças                                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  try {
    // ============================================
    // 1. COLETAR TODOS OS USUÁRIOS
    // ============================================
    console.log('1️⃣  COLETANDO USUÁRIOS...\n');
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      console.log('   ❌ Nenhum usuário encontrado!\n');
    } else {
      console.log(`   ✅ Total de usuários: ${usersSnapshot.size}\n`);
    }

    // Map de usuários para lookup rápido
    const usersMap = new Map();
    usersSnapshot.forEach(doc => {
      usersMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // ============================================
    // 2. COLETAR TODOS OS GRUPOS
    // ============================================
    console.log('2️⃣  COLETANDO GRUPOS...\n');
    const groupsSnapshot = await db.collection('groups').get();

    if (groupsSnapshot.empty) {
      console.log('   ❌ Nenhum grupo encontrado!\n');
    } else {
      console.log(`   ✅ Total de grupos: ${groupsSnapshot.size}\n`);

      groupsSnapshot.forEach(doc => {
        const group = doc.data();
        console.log(`   📁 ${group.name} (${doc.id})`);
        console.log(`      - Dono: ${usersMap.get(group.owner_id)?.name || 'N/A'}`);
        console.log(`      - Membros: ${group.member_count || 0}`);
        console.log(`      - Status: ${group.status || 'ACTIVE'}`);
        console.log(`      - Público: ${group.is_public ? 'Sim' : 'Não'}`);
        console.log(`      - Criado em: ${formatDate(group.created_at)}\n`);
      });
    }

    // ============================================
    // 3. COLETAR JOGOS FINALIZADOS
    // ============================================
    console.log('3️⃣  COLETANDO JOGOS FINALIZADOS...\n');
    const gamesSnapshot = await db.collection('games')
      .where('status', '==', 'FINISHED')
      .orderBy('dateTime', 'desc')
      .get();

    if (gamesSnapshot.empty) {
      console.log('   ⚠️  Nenhum jogo finalizado encontrado!\n');
    } else {
      console.log(`   ✅ Total de jogos finalizados: ${gamesSnapshot.size}\n`);

      gamesSnapshot.forEach(doc => {
        const game = doc.data();
        const owner = usersMap.get(game.owner_id);
        console.log(`   🎮 Jogo: ${game.title || 'Sem título'} (${doc.id})`);
        console.log(`      - Data: ${formatDate(game.dateTime)}`);
        console.log(`      - Organizador: ${owner?.name || 'N/A'}`);
        console.log(`      - Local: ${game.location_name || 'N/A'}`);
        console.log(`      - Confirmados: ${game.confirmations?.length || 0}`);
        console.log(`      - MVP: ${usersMap.get(game.mvp_id)?.name || 'N/A'}\n`);
      });
    }

    // ============================================
    // 4. COLETAR ESTATÍSTICAS
    // ============================================
    console.log('4️⃣  COLETANDO ESTATÍSTICAS...\n');
    const statsSnapshot = await db.collection('statistics').get();

    if (statsSnapshot.empty) {
      console.log('   ⚠️  Nenhuma estatística encontrada!\n');
    } else {
      console.log(`   ✅ Total de registros de estatísticas: ${statsSnapshot.size}\n`);

      // Agrupar estatísticas por jogador
      const statsByPlayer = new Map();

      statsSnapshot.forEach(doc => {
        const stat = doc.data();
        const userId = stat.player_id || stat.user_id;

        if (!statsByPlayer.has(userId)) {
          statsByPlayer.set(userId, {
            user: usersMap.get(userId),
            total_games: 0,
            goals: 0,
            assists: 0,
            mvp_count: 0,
            wins: 0,
            losses: 0
          });
        }

        const playerStats = statsByPlayer.get(userId);
        playerStats.total_games += stat.total_games || stat.games_played || 0;
        playerStats.goals += stat.goals || 0;
        playerStats.assists += stat.assists || 0;
        playerStats.mvp_count += stat.mvp_count || 0;
        playerStats.wins += stat.wins || 0;
        playerStats.losses += stat.losses || 0;
      });
    }

    // ============================================
    // 5. COLETAR LOGS DE XP
    // ============================================
    console.log('5️⃣  COLETANDO LOGS DE XP...\n');
    const xpLogsSnapshot = await db.collection('xp_logs')
      .orderBy('created_at', 'desc')
      .get();

    if (xpLogsSnapshot.empty) {
      console.log('   ⚠️  Nenhum log de XP encontrado!\n');
    } else {
      console.log(`   ✅ Total de logs de XP: ${xpLogsSnapshot.size}\n`);

      // Agrupar XP por usuário
      const xpByUser = new Map();

      xpLogsSnapshot.forEach(doc => {
        const log = doc.data();
        const userId = log.user_id;

        if (!xpByUser.has(userId)) {
          xpByUser.set(userId, {
            user: usersMap.get(userId),
            total_xp: 0,
            logs: []
          });
        }

        const userXp = xpByUser.get(userId);
        userXp.total_xp += log.xp_earned || 0;
        userXp.logs.push(log);
      });
    }

    // ============================================
    // 6. COLETAR BADGES
    // ============================================
    console.log('6️⃣  COLETANDO BADGES...\n');
    const badgesSnapshot = await db.collection('user_badges')
      .orderBy('unlocked_at', 'desc')
      .get();

    if (badgesSnapshot.empty) {
      console.log('   ⚠️  Nenhum badge encontrado!\n');
    } else {
      console.log(`   ✅ Total de badges desbloqueados: ${badgesSnapshot.size}\n`);

      // Agrupar badges por usuário
      const badgesByUser = new Map();

      badgesSnapshot.forEach(doc => {
        const badge = doc.data();
        const userId = badge.user_id;

        if (!badgesByUser.has(userId)) {
          badgesByUser.set(userId, {
            user: usersMap.get(userId),
            badges: []
          });
        }

        badgesByUser.get(userId).badges.push(badge);
      });
    }

    // ============================================
    // 7. COLETAR CONFIRMAÇÕES DE JOGO
    // ============================================
    console.log('7️⃣  COLETANDO CONFIRMAÇÕES DE JOGO...\n');
    const confirmationsSnapshot = await db.collection('confirmations').get();

    if (confirmationsSnapshot.empty) {
      console.log('   ⚠️  Nenhuma confirmação encontrada!\n');
    } else {
      console.log(`   ✅ Total de confirmações: ${confirmationsSnapshot.size}\n`);

      // Contar jogos por jogador
      const gamesByPlayer = new Map();

      confirmationsSnapshot.forEach(doc => {
        const conf = doc.data();
        const userId = conf.user_id;

        if (!gamesByPlayer.has(userId)) {
          gamesByPlayer.set(userId, {
            user: usersMap.get(userId),
            games_count: 0,
            games: []
          });
        }

        const playerGames = gamesByPlayer.get(userId);
        playerGames.games_count += 1;
        playerGames.games.push({ gameId: conf.game_id, status: conf.status });
      });
    }

    // ============================================
    // RELATÓRIO FINAL POR JOGADOR
    // ============================================
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                    RELATÓRIO FINAL POR JOGADOR                   ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    for (const [userId, user] of usersMap) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`👤 JOGADOR: ${formatPlayerName(user)}`);
      console.log(`   ID: ${userId}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Nível: ${user.level || 1}`);
      console.log(`   XP Total: ${user.experience_points || 0}`);
      console.log(`   Role: ${user.role || 'PLAYER'}`);
      console.log(`   Buscável: ${user.is_searchable ? 'Sim' : 'Não'}`);
      console.log(`   Criado em: ${formatDate(user.created_at)}`);

      // Estatísticas do jogador
      const stats = Array.from(statsSnapshot.docs)
        .map(d => d.data())
        .find(s => s.player_id === userId || s.user_id === userId);

      if (stats) {
        console.log(`\n   📊 ESTATÍSTICAS:`);
        console.log(`      - Jogos Totais: ${stats.total_games || stats.games_played || 0}`);
        console.log(`      - Gols: ${stats.goals || 0}`);
        console.log(`      - Assistências: ${stats.assists || 0}`);
        console.log(`      - MVPs: ${stats.mvp_count || 0}`);
        console.log(`      - Vitórias: ${stats.wins || 0}`);
        console.log(`      - Derrotas: ${stats.losses || 0}`);
        console.log(`      - Defesas: ${stats.saves || 0}`);
      }

      // Jogos realizados
      const playerConfirmations = Array.from(confirmationsSnapshot.docs)
        .map(d => d.data())
        .filter(c => c.user_id === userId && c.status === 'CONFIRMED');

      if (playerConfirmations.length > 0) {
        console.log(`\n   🎮 JOGOS CONFIRMADOS: ${playerConfirmations.length}`);
        playerConfirmations.slice(0, 10).forEach(conf => {
          const game = gamesSnapshot.docs.find(d => d.id === conf.game_id)?.data();
          if (game) {
            console.log(`      - ${game.title || 'Sem título'} (${formatDate(game.dateTime)})`);
          }
        });
        if (playerConfirmations.length > 10) {
          console.log(`      ... e mais ${playerConfirmations.length - 10} jogos`);
        }
      }

      // Logs de XP recentes
      const playerXpLogs = Array.from(xpLogsSnapshot.docs)
        .map(d => d.data())
        .filter(log => log.user_id === userId)
        .slice(0, 5);

      if (playerXpLogs.length > 0) {
        console.log(`\n   📈 LOGS DE XP RECENTES:`);
        playerXpLogs.forEach(log => {
          console.log(`      - +${log.xp_earned} XP: ${log.reason || 'Sem motivo'} (${formatDate(log.created_at)})`);
        });
      }

      // Badges conquistados
      const playerBadges = Array.from(badgesSnapshot.docs)
        .map(d => d.data())
        .filter(b => b.user_id === userId);

      if (playerBadges.length > 0) {
        console.log(`\n   🏆 BADGES CONQUISTADOS: ${playerBadges.length}`);
        playerBadges.forEach(badge => {
          console.log(`      - ${badge.badge_id || badge.badgeName || 'Badge'} (${formatDate(badge.unlocked_at)})`);
        });
      }

      console.log('');
    }

    // ============================================
    // RESUMO GERAL
    // ============================================
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                        RESUMO GERAL                              ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    console.log(`📊 USUÁRIOS: ${usersSnapshot.size}`);
    console.log(`📁 GRUPOS: ${groupsSnapshot.size}`);
    console.log(`🎮 JOGOS FINALIZADOS: ${gamesSnapshot.size}`);
    console.log(`📈 ESTATÍSTICAS: ${statsSnapshot.size}`);
    console.log(`✨ LOGS DE XP: ${xpLogsSnapshot.size}`);
    console.log(`🏆 BADGES: ${badgesSnapshot.size}`);
    console.log(`✅ CONFIRMAÇÕES: ${confirmationsSnapshot.size}`);

    // Jogador com mais gols
    let topScorer = { name: 'N/A', goals: 0 };
    for (const doc of statsSnapshot.docs) {
      const stats = doc.data();
      if ((stats.goals || 0) > topScorer.goals) {
        const user = usersMap.get(stats.player_id || stats.user_id);
        topScorer = {
          name: user?.name || 'N/A',
          goals: stats.goals
        };
      }
    }
    console.log(`\n⚽ ARTEIRO: ${topScorer.name} (${topScorer.goals} gols)`);

    // Jogador com mais MVPs
    let topMvp = { name: 'N/A', mvps: 0 };
    for (const doc of statsSnapshot.docs) {
      const stats = doc.data();
      if ((stats.mvp_count || 0) > topMvp.mvps) {
        const user = usersMap.get(stats.player_id || stats.user_id);
        topMvp = {
          name: user?.name || 'N/A',
          mvps: stats.mvp_count
        };
      }
    }
    console.log(`👑 MVP: ${topMvp.name} (${topMvp.mvps} MVPs)`);

    // Jogador com maior nível
    let topLevel = { name: 'N/A', level: 1, xp: 0 };
    for (const [userId, user] of usersMap) {
      if ((user.level || 1) > topLevel.level ||
          ((user.level || 1) === topLevel.level && (user.experience_points || 0) > topLevel.xp)) {
        topLevel = {
          name: user.name || 'N/A',
          level: user.level || 1,
          xp: user.experience_points || 0
        };
      }
    }
    console.log(`🌟 MAIOR NÍVEL: ${topLevel.name} (Nível ${topLevel.level}, ${topLevel.xp} XP)`);

    console.log('\n✅ Análise concluída com sucesso!\n');

  } catch (error) {
    console.error('\n❌ ERRO DURANTE ANÁLISE:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

// Executar análise
analyzeData();
