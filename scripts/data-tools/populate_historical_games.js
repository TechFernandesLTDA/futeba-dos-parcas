/**
 * Script para popular jogos históricos completos com estatísticas
 *
 * Cria jogos finalizados com estatísticas realistas para os 4 jogadores
 * Atualiza XP, badges, e estatísticas globais
 *
 * Uso: node scripts/populate_historical_games.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// IDs dos usuários (ATUALIZADO - Janeiro 2026)
const RICARDO_ID = '8CwDeOLWw3Ws3N5qQJfY07ZFtnS2';
const RAFAEL_ID = 'EN2fwT9y6ndVyKETQthCDg83DSL2';
const RENAN_ADMIN_ID = 'FOlvyYHcZWPNqTGHkbSytMUwIAz1';
const TECH_FIELD_OWNER_ID = 'LmclkYXROATUAvg4Ah0ZXcgcRCF2';

const USERS = {
  RICARDO: RICARDO_ID,
  RAFAEL: RAFAEL_ID,
  RENAN_ADMIN: RENAN_ADMIN_ID,
  TECH_FIELD_OWNER: TECH_FIELD_OWNER_ID
};

// Dados dos jogadores para geração aleatória
const PLAYER_DATA = {
  [RICARDO_ID]: {
    name: 'ricardo gonçalves',
    nick: 'Ricardo',
    skill: 75, // Skill base (0-100)
    positions: ['ATK', 'MID'],
    preferredFoot: 'RIGHT',
    stats: { goals: 0, assists: 0, mvp: 0 }
  },
  [RAFAEL_ID]: {
    name: 'Rafael Boumer',
    nick: 'Boumer',
    skill: 70,
    positions: ['DEF', 'MID'],
    preferredFoot: 'LEFT',
    stats: { goals: 0, assists: 0, mvp: 0 }
  },
  [RENAN_ADMIN_ID]: {
    name: 'Renan Locatiz Fernandes',
    nick: 'Renan Kakinho',
    skill: 65,
    positions: ['MID', 'DEF'],
    preferredFoot: 'RIGHT',
    stats: { goals: 0, assists: 0, mvp: 0 }
  },
  [TECH_FIELD_OWNER_ID]: {
    name: 'Tech Fernandes',
    nick: 'Tech',
    skill: 80,
    positions: ['ATK', 'GK'],
    preferredFoot: 'RIGHT',
    stats: { goals: 0, assists: 0, mvp: 0 }
  }
};

// Nomes para jogos aleatórios
const GAME_NAMES = [
  'Pelada do Segunda',
  'Futebol da tarde',
  'Pelada da sexta',
  'Futebol do dia',
  'Pelada da quadra',
  'Futebol da galera',
  'Pelada dos amigos',
  'Futebol da tarde',
  'Pelada da quadra society',
  'Futebol do fim de semana'
];

// Locais
const LOCATIONS = {
  'Society Centro': { lat: -23.5505, lng: -46.6333 },
  'Quadra do Parque': { lat: -23.6000, lng: -46.7000 }
};

/**
 * Gera um resultado aleatório de jogo
 */
function generateGameScore() {
  // Scores tipicamente entre 0 e 8
  const team1Score = Math.floor(Math.random() * 9);
  const team2Score = Math.floor(Math.random() * 9);
  return { team1Score, team2Score };
}

/**
 * Gera estatísticas para um jogador em um jogo
 */
function generatePlayerStats(playerData, gameScore, playerTeam) {
  const stats = {
    goals: 0,
    assists: 0,
    yellowCards: Math.random() < 0.2 ? 1 : 0, // 20% chance
    redCard: Math.random() < 0.05 ? 1 : 0, // 5% chance
    mvp: 0
  };

  const isWinner = (playerTeam === 'team1' && gameScore.team1Score > gameScore.team2Score) ||
                   (playerTeam === 'team2' && gameScore.team2Score > gameScore.team1Score);

  // Gols baseados na skill e posição
  if (playerData.positions.includes('ATK')) {
    const goalChance = playerData.skill / 100;
    stats.goals = Math.random() < goalChance ? Math.floor(Math.random() * 3) + 1 : 0;
  } else if (playerData.positions.includes('MID')) {
    stats.goals = Math.random() < 0.3 ? 1 : 0;
    stats.assists = Math.random() < 0.4 ? Math.floor(Math.random() * 2) + 1 : 0;
  }

  // Assistências
  if (stats.assists === 0 && stats.goals === 0) {
    stats.assists = Math.random() < 0.3 ? 1 : 0;
  }

  // Gols sofridos (para todos)
  stats.goalsConceded = playerTeam === 'team1' ? gameScore.team2Score : gameScore.team1Score;

  // MVP baseado em performance
  const performanceScore = stats.goals * 3 + stats.assists * 2 + (isWinner ? 2 : 0);
  stats.mvp = performanceScore >= 5 ? 1 : 0;

  return stats;
}

/**
 * Distribui times balanceados
 */
function distributeTeams() {
  // Usar os IDs diretamente, não as chaves do objeto USERS
  const userIds = Object.values(USERS);
  // Shuffle
  const shuffled = userIds.sort(() => Math.random() - 0.5);
  return {
    team1: [shuffled[0], shuffled[1]],
    team2: [shuffled[2], shuffled[3]]
  };
}

/**
 * Cria um jogo finalizado com estatísticas completas
 */
async function createFinishedGame(date, hour) {
  const gameId = `hist_${date}_${Math.random().toString(36).substr(2, 9)}`;
  const gameRef = db.collection('games').doc(gameId);

  const teams = distributeTeams();
  const gameScore = generateGameScore();
  const gameName = GAME_NAMES[Math.floor(Math.random() * GAME_NAMES.length)];
  const locationName = Object.keys(LOCATIONS)[Math.floor(Math.random() * Object.keys(LOCATIONS).length)];
  const location = LOCATIONS[locationName];

  // Criar data/hora
  const [year, month, day] = date.split('-').map(Number);
  const [hourStr, minStr] = hour.split(':').map(Number);
  const gameDateTime = new Date(year, month - 1, day, hourStr, minStr);

  // Criar jogo
  const gameData = {
    id: gameId,
    name: `${gameName} - ${date}`,
    date: date,
    time: hour,
    dateTime: gameDateTime.getTime(),
    locationId: locationName,
    locationName: locationName,
    locationLat: location.lat,
    locationLng: location.lng,
    fieldType: 'SOCIETY',
    status: 'FINISHED',
    visibility: 'PRIVATE',
    maxPlayers: 8,
    isConfirmationOpen: false,
    groupId: '3lf59lAW7URlOBcLN9bn', // Futebol De Segunda Feira
    ownerId: USERS.RENAN_ADMIN,
    createdAt: admin.firestore.Timestamp.fromDate(gameDateTime),
    updatedAt: admin.firestore.Timestamp.now(),
    team1Score: gameScore.team1Score,
    team2Score: gameScore.team2Score,
    team1Players: teams.team1,
    team2Players: teams.team2
  };

  // Criar confirmações
  const confirmations = [];
  const batch = db.batch();

  for (const userId of Object.values(USERS)) {
    const playerTeam = teams.team1.includes(userId) ? 'team1' : 'team2';
    const playerData = PLAYER_DATA[userId];
    const stats = generatePlayerStats(playerData, gameScore, playerTeam);

    const confirmation = {
      id: `${gameId}_${userId}`,
      gameId: gameId,
      userId: userId,
      userName: playerData.name,
      userPhoto: null,
      position: 'FIELD',
      status: 'CONFIRMED',
      isCasualPlayer: false,
      team: playerTeam,
      // Estatísticas do jogo
      goals: stats.goals,
      assists: stats.assists,
      yellowCards: stats.yellowCards,
      redCard: stats.redCard,
      mvp: stats.mvp,
      isPaid: true
    };

    confirmations.push(confirmation);
    batch.set(db.collection('confirmations').doc(confirmation.id), confirmation);
  }

  // Adicionar jogo
  batch.set(gameRef, gameData);

  await batch.commit();
  console.log(`✅ Jogo criado: ${gameName} - ${date} (${gameScore.team1Score}x${gameScore.team2Score})`);

  return { gameId, gameData, confirmations };
}

/**
 * Atualiza estatísticas globais de um jogador
 */
async function updatePlayerStatistics(userId, gameStats) {
  const statsRef = db.collection('statistics').doc(userId);

  await statsRef.set({
    userId: userId,
    totalGames: admin.firestore.FieldValue.increment(1),
    totalGoals: admin.firestore.FieldValue.increment(gameStats.goals),
    totalAssists: admin.firestore.FieldValue.increment(gameStats.assists),
    totalYellowCards: admin.firestore.FieldValue.increment(gameStats.yellowCards),
    totalRedCards: admin.firestore.FieldValue.increment(gameStats.redCard),
    bestPlayerCount: admin.firestore.FieldValue.increment(gameStats.mvp),
    updatedAt: admin.firestore.Timestamp.now()
  }, { merge: true });
}

/**
 * Adiciona XP por jogo finalizado
 */
async function addXPForGame(userId, gameData, stats) {
  const xpRef = db.collection('xp_logs').doc();

  // XP base por jogo
  let xpEarned = 50;

  // Bônus por gols
  xpEarned += stats.goals * 20;

  // Bônus por assistências
  xpEarned += stats.assists * 10;

  // Bônus por MVP
  if (stats.mvp > 0) xpEarned += 30;

  // Bônus por vitória
  const playerTeam = stats.team;
  const won = (playerTeam === 'team1' && gameData.team1Score > gameData.team2Score) ||
            (playerTeam === 'team2' && gameData.team2Score > gameData.team1Score);
  if (won) xpEarned += 25;

  await xpRef.set({
    id: xpRef.id,
    userId: userId,
    amount: xpEarned,
    source: 'GAME_FINISHED',
    sourceId: gameData.id,
    description: `Jogo finalizado: ${gameData.name}`,
    createdAt: admin.firestore.Timestamp.now()
  });

  return xpEarned;
}

/**
 * Cria jogos históricos para janeiro de 2026
 */
async function populateJanuary2026Games() {
  console.log('🚀 Iniciando população de jogos de janeiro 2026...\n');

  const games = [];
  const startDate = new Date(2026, 0, 1); // 1 de janeiro de 2026
  const endDate = new Date(2026, 0, 14);  // 14 de janeiro de 2026

  let gameCount = 0;

  // Gerar jogos aproximadamente 3x por semana (segunda, quarta, sexta)
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();

    // Segunda (1), Quarta (3), Sexta (5) - dias de pelada
    if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Gerar 2 jogos por dia de pelada (horários diferentes)
      for (const hour of ['18:00', '20:00']) {
        try {
          const result = await createFinishedGame(dateStr, hour);
          games.push(result);
          gameCount++;

          // Atualizar estatísticas de cada jogador
          for (const confirmation of result.confirmations) {
            await updatePlayerStatistics(
              confirmation.userId,
              {
                goals: confirmation.goals,
                assists: confirmation.assists,
                yellowCards: confirmation.yellowCards,
                redCard: confirmation.redCard,
                mvp: confirmation.mvp
              }
            );

            // Adicionar XP
            await addXPForGame(confirmation.userId, result.gameData, confirmation);
          }

          // Pequena pausa para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Erro ao criar jogo para ${dateStr} ${hour}:`, error.message);
        }
      }
    }

    // Próximo dia
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`\n✅ Total de jogos criados: ${gameCount}`);

  // Resumo das estatísticas
  console.log('\n📊 RESUMO DAS ESTATÍSTICAS:');
  for (const [userId, playerData] of Object.entries(PLAYER_DATA)) {
    console.log(`\n${playerData.nick}:`);
    console.log(`  Jogos: ${gameCount}`);
    // Nota: As estatísticas acumuladas seriam buscadas do Firestore
  }

  return games;
}

/**
 * Main
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('POPULAÇÃO DE DADOS HISTÓRICOS - FUTEBA DOS PARÇAS');
    console.log('='.repeat(60));
    console.log('\n⚠️  ATENÇÃO: Este script irá ADICIONAR dados ao Firebase');
    console.log('⚠️  Certifique-se de ter backup antes de executar!\n');

    await populateJanuary2026Games();

    console.log('\n' + '='.repeat(60));
    console.log('✅ POPULAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro durante população:', error);
  } finally {
    process.exit(0);
  }
}

// Executar
main();
