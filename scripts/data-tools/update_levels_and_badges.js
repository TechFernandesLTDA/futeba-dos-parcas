/**
 * Script para atualizar níveis e gerar badges variados
 *
 * Atribui níveis aleatórios realistas para os 4 jogadores
 * Cria badges variados (não apenas PAREDAO e HAT_TRICK)
 *
 * Uso: node scripts/update_levels_and_badges.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// IDs dos usuários (ATUALIZADO - Janeiro 2026)
const USERS = {
  RICARDO: '8CwDeOLWw3Ws3N5qQJfY07ZFtnS2',
  RAFAEL: 'EN2fwT9y6ndVyKETQthCDg83DSL2',
  RENAN_ADMIN: 'FOlvyYHcZWPNqTGHkbSytMUwIAz1',
  TECH_FIELD_OWNER: 'LmclkYXROATUAvg4Ah0ZXcgcRCF2'
};

// Níveis por jogador (aleatórios mas realistas)
const PLAYER_LEVELS = {
  [USERS.RICARDO]: {
    level: 3,
    xp: 1500,
    levelName: 'Iniciante Promissor'
  },
  [USERS.RAFAEL]: {
    level: 5,
    xp: 4500,
    levelName: 'Jogo de Cintura'
  },
  [USERS.RENAN_ADMIN]: {
    level: 12,
    xp: 25000,
    levelName: 'Lenda das Quadras'
  },
  [USERS.TECH_FIELD_OWNER]: {
    level: 8,
    xp: 12000,
    levelName: 'Capitão Equilibrado'
  }
};

// Badges disponíveis para criar
const BADGE_TYPES = [
  { id: 'first_goal', name: 'Primeiro Gol', description: 'Marcou seu primeiro gol', icon: '⚽' },
  { id: 'playmaker', name: 'Playmaker', description: '5 assistências em um jogo', icon: '🎯' },
  { id: 'wall', name: 'Muralha', description: 'Jogo sem sofrer gols', icon: '🧱' },
  { id: 'streak_3', name: 'Sequência 3', description: '3 jogos seguidos', icon: '🔥' },
  { id: 'hat_trick', name: 'Hat-Trick', description: '3 gols em um jogo', icon: '🎩' },
  { id: 'mvp', name: 'MVP', description: 'Melhor em campo', icon: '⭐' },
  { id: 'century', name: '100 Jogos', description: 'Participou de 100 jogos', icon: '💯' },
  { id: 'scorer', name: 'Artilheiro', description: '20 gols na carreira', icon: '🥅' },
  { id: 'assists', name: 'Assistidor', description: '20 assistências', icon: '👟' },
  { id: 'loyal', name: 'Jogador Leal', description: 'Membro há 6 meses', icon: '🏆' },
  { id: 'victory', name: 'Vitória', description: 'Venceu 10 jogos', icon: '🏆' },
  { id: 'underrated', name: 'Subestimado', description: 'Rating 80+ sem elogios', icon: '🤫' }
];

/**
 * Atualiza nível de um jogador
 */
async function updatePlayerLevel(userId, levelData) {
  await db.collection('users').doc(userId).update({
    level: levelData.level,
    experience_points: levelData.xp,
    levelName: levelData.levelName
  });
  console.log(`✅ ${userId} → Nível ${levelData.level} (${levelData.levelName})`);
}

/**
 * Cria um badge para um jogador
 */
async function createBadge(userId, badgeType, gameId = null) {
  const badgeRef = db.collection('user_badges').doc();

  const badge = {
    id: badgeRef.id,
    userId: userId,
    badgeId: badgeType.id,
    badgeName: badgeType.name,
    badgeDescription: badgeType.description,
    badgeIcon: badgeType.icon,
    gameId: gameId,
    unlockedAt: admin.firestore.Timestamp.now()
  };

  await badgeRef.set(badge);
  return badge;
}

/**
 * Atribui badges variados para os jogadores
 */
async function assignBadges() {
  console.log('\n🏅 Atribuindo badges variados...\n');

  const badgesToCreate = [
    // Ricardo - Badges de iniciante
    { userId: USERS.RICARDO, badge: BADGE_TYPES[0], gameId: null }, // first_goal
    { userId: USERS.RICARDO, badge: BADGE_TYPES[1], gameId: null }, // playmaker
    { userId: USERS.RICARDO, badge: BADGE_TYPES[5], gameId: null }, // mvp

    // Rafael - Badges de meio-campo
    { userId: USERS.RAFAEL, badge: BADGE_TYPES[2], gameId: null }, // wall
    { userId: USERS.RAFAEL, badge: BADGE_TYPES[4], gameId: null }, // streak_3
    { userId: USERS.RAFAEL, badge: BADGE_TYPES[8], gameId: null }, // assists

    // Renan - Badges de veterano
    { userId: USERS.RENAN_ADMIN, badge: BADGE_TYPES[6], gameId: null }, // hat_trick
    { userId: USERS.RENAN_ADMIN, badge: BADGE_TYPES[9], gameId: null }, // loyal
    { userId: USERS.RENAN_ADMIN, badge: BADGE_TYPES[10], gameId: null }, // victory

    // Tech - Badges de atacante
    { userId: USERS.TECH_FIELD_OWNER, badge: BADGE_TYPES[3], gameId: null }, // streak_3
    { userId: USERS.TECH_FIELD_OWNER, badge: BADGE_TYPES[5], gameId: null }, // mvp
    { userId: USERS.TECH_FIELD_OWNER, badge: BADGE_TYPES[7], gameId: null }, // scorer
    { userId: USERS.TECH_FIELD_OWNER, badge: BADGE_TYPES[11], gameId: null } // underrated
  ];

  for (const { userId, badge, gameId } of badgesToCreate) {
    await createBadge(userId, badge, gameId);
    console.log(`  ${badge.icon} ${badge.name} → ${userId.substring(0, 10)}...`);
  }

  console.log(`\n✅ ${badgesToCreate.length} badges criados`);
}

/**
 * Adiciona logs de XP para atingir os níveis desejados
 */
async function addXPForLevels() {
  console.log('\n⭐ Adicionando XP para atingir níveis...\n');

  const batch = db.batch();

  for (const [userId, levelData] of Object.entries(PLAYER_LEVELS)) {
    // Adicionar log de XP
    const xpRef = db.collection('xp_logs').doc();
    batch.set(xpRef, {
      id: xpRef.id,
      userId: userId,
      amount: levelData.xp,
      source: 'LEVEL_ADJUSTMENT',
      sourceId: 'system',
      description: `Ajuste de nível para ${levelData.levelName}`,
      createdAt: admin.firestore.Timestamp.now()
    });
  }

  await batch.commit();
  console.log('✅ Logs de XP adicionados');
}

/**
 * Main
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('ATUALIZAÇÃO DE NÍVEIS E BADGES - FUTEBA DOS PARÇAS');
    console.log('='.repeat(60));
    console.log('\n⚠️  ATENÇÃO: Este script irá MODIFICAR dados do Firebase');
    console.log('⚠️  Certifique-se de ter backup antes de executar!\n');

    // Atualizar níveis
    console.log('📊 Atualizando níveis dos jogadores...\n');
    for (const [userId, levelData] of Object.entries(PLAYER_LEVELS)) {
      await updatePlayerLevel(userId, levelData);
    }

    // Adicionar XP
    await addXPForLevels();

    // Criar badges variados
    await assignBadges();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro durante atualização:', error);
  } finally {
    process.exit(0);
  }
}

// Executar
main();
