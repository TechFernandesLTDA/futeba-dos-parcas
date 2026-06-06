/**
 * SCRIPTOF WIPE — Zera dados de jogos e estatísticas de TODOS os usuários.
 *
 * ⚠️  OPERAÇÃO DESTRUTIVA E IRREVERSÍVEL
 *
 * Apaga:
 *   games, confirmations, teams, game_events, live_scores,
 *   xp_logs, ranking_deltas, season_participation,
 *   user_badges, activities, notifications, mvp_votes,
 *   waitlist, check_ins, game_summons, schedules,
 *   league_matches (subcoleção de groups),
 *   league_standings (subcoleção de groups)
 *
 * Reseta nos users/{uid}:
 *   experience_points → 0, level → 1
 *
 * NÃO apaga:
 *   users, groups, locations, app_settings, official-groups
 *
 * Uso (via service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json \
 *   npx tsx scripts/wipe-data.ts
 *
 * Ou via Firebase CLI token:
 *   firebase use futebadosparcas
 *   npx tsx scripts/wipe-data.ts
 */

import * as admin from 'firebase-admin';

// ==========================================
// CONFIGURAÇÃO
// ==========================================

const PROJECT_ID = 'futebadosparcas';
const BATCH_SIZE = 450;

// Coleções top-level a apagar
const TOP_COLLECTIONS = [
  'games',
  'confirmations',
  'teams',
  'game_events',
  'live_scores',
  'xp_logs',
  'ranking_deltas',
  'season_participation',
  'user_badges',
  'activities',
  'notifications',
  'mvp_votes',
  'waitlist',
  'check_ins',
  'game_summons',
  'schedules',
  'player_stats',
  'error_logs',
  'verification_failures',
  'audit_logs',
  'metrics',
];

// ==========================================
// INICIALIZAÇÃO
// ==========================================

function initAdmin(): admin.firestore.Firestore {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: PROJECT_ID,
    });
  }
  return admin.firestore();
}

// ==========================================
// HELPERS
// ==========================================

async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionName: string,
): Promise<number> {
  let totalDeleted = 0;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db.collection(collectionName).limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      totalDeleted++;
    });
    await batch.commit();

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`  [${collectionName}] ${totalDeleted} documentos removidos...`);

    if (snapshot.size < BATCH_SIZE) break;
  }

  return totalDeleted;
}

async function deleteSubCollections(
  db: admin.firestore.Firestore,
  parentCollection: string,
  subCollection: string,
): Promise<number> {
  let totalDeleted = 0;

  const parentDocs = await db
    .collection(parentCollection)
    .select(admin.firestore.FieldPath.documentId())
    .get();

  for (const parentDoc of parentDocs.docs) {
    let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

    while (true) {
      let query = parentDoc.ref
        .collection(subCollection)
        .limit(BATCH_SIZE);
      if (lastDoc) query = query.startAfter(lastDoc);

      const snapshot = await query.get();
      if (snapshot.empty) break;

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        totalDeleted++;
      });
      await batch.commit();

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.size < BATCH_SIZE) break;
    }
  }

  return totalDeleted;
}

async function resetUserStats(
  db: admin.firestore.Firestore,
): Promise<number> {
  let totalReset = 0;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db
      .collection('users')
      .select('experience_points', 'level')
      .limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        experience_points: 0,
        level: 1,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      totalReset++;
    });
    await batch.commit();

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`  [users] ${totalReset} usuários resetados...`);

    if (snapshot.size < BATCH_SIZE) break;
  }

  return totalReset;
}

// ==========================================
// EXECUÇÃO PRINCIPAL
// ==========================================

async function main() {
  const db = initAdmin();

  console.log('==========================================');
  console.log('  WIPE — Zerando dados do Futeba dos Parças');
  console.log('  Projeto:', PROJECT_ID);
  console.log('==========================================');
  console.log('');

  let grandTotal = 0;

  // Fase 1: Apagar coleções top-level
  console.log('--- Fase 1: Coleções top-level ---');
  for (const col of TOP_COLLECTIONS) {
    console.log(`Apagando ${col}...`);
    const deleted = await deleteCollection(db, col);
    console.log(`  [${col}] Total: ${deleted} documentos`);
    grandTotal += deleted;
  }

  // Fase 2: Apagar subcoleções
  console.log('');
  console.log('--- Fase 2: Subcoleções ---');

  console.log('Apagando groups/{id}/league_matches...');
  const leagueMatches = await deleteSubCollections(db, 'groups', 'league_matches');
  console.log(`  [league_matches] Total: ${leagueMatches}`);
  grandTotal += leagueMatches;

  console.log('Apagando groups/{id}/league_standings...');
  const leagueStandings = await deleteSubCollections(db, 'groups', 'league_standings');
  console.log(`  [league_standings] Total: ${leagueStandings}`);
  grandTotal += leagueStandings;

  console.log('Apagando groups/{id}/cashbox...');
  const cashbox = await deleteSubCollections(db, 'groups', 'cashbox');
  console.log(`  [cashbox] Total: ${cashbox}`);
  grandTotal += cashbox;

  // Fase 3: Resetar XP/level dos usuários
  console.log('');
  console.log('--- Fase 3: Resetar estatísticas dos usuários ---');
  const usersReset = await resetUserStats(db);
  grandTotal += usersReset;

  console.log('');
  console.log('==========================================');
  console.log(`  WIPE CONCLUÍDO. ${grandTotal} registos afetados.`);
  console.log('==========================================');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
