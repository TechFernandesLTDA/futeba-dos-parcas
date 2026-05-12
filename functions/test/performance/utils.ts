/**
 * UTILITÁRIOS COMPARTILHADOS — SUITE DE PERFORMANCE DE QUERIES FIRESTORE
 *
 * Fornece helpers de seed e medição de tempo para os testes de performance.
 * Todos os testes rodam contra o emulador Firestore (FIRESTORE_EMULATOR_HOST).
 */

import * as admin from "firebase-admin";

// ==========================================
// INICIALIZAÇÃO DO EMULADOR
// ==========================================

let appInitialized = false;

/**
 * Inicializa o firebase-admin apontando para o emulador Firestore.
 * Deve ser chamado uma vez antes de qualquer operação de banco.
 * FIRESTORE_EMULATOR_HOST deve ser definido ANTES desta chamada.
 */
export function initEmulatorApp(): admin.app.App {
  // Garante FIRESTORE_EMULATOR_HOST antes do initializeApp
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
  }

  if (!appInitialized) {
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId: "demo-perf-test" });
    }
    appInitialized = true;
  }

  return admin.apps[0] as admin.app.App;
}

/**
 * Retorna instância do Firestore conectada ao emulador.
 */
export function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

// ==========================================
// MEDIÇÃO DE TEMPO
// ==========================================

/**
 * Mede o tempo de execução de uma função assíncrona em milissegundos.
 *
 * @param fn - Função assíncrona a ser medida
 * @returns Objeto com o resultado e a duração em ms
 */
export async function measureMs<T>(
  fn: () => Promise<T>
): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

// ==========================================
// LIMPEZA DE COLEÇÃO
// ==========================================

/**
 * Deleta todos os documentos de uma coleção no emulador.
 * Utilizado no afterEach/afterAll para isolar testes.
 */
export async function clearCollection(
  db: admin.firestore.Firestore,
  collectionName: string
): Promise<void> {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

/**
 * Limpa múltiplas coleções em paralelo.
 */
export async function clearCollections(
  db: admin.firestore.Firestore,
  collections: string[]
): Promise<void> {
  await Promise.all(collections.map((c) => clearCollection(db, c)));
}

// ==========================================
// SEED — USERS
// ==========================================

/**
 * Cria n usuários fake no Firestore do emulador.
 *
 * @param db - Instância do Firestore
 * @param n - Número de usuários a criar
 * @param prefix - Prefixo para IDs únicos entre suites
 * @returns IDs dos usuários criados
 */
export async function seedUsers(
  db: admin.firestore.Firestore,
  n: number,
  prefix = "user"
): Promise<string[]> {
  const ids: string[] = [];
  const batchSize = 450; // Limite de segurança (Firestore aceita até 500)
  let batch = db.batch();
  let count = 0;

  for (let i = 0; i < n; i++) {
    const id = `${prefix}-${i.toString().padStart(5, "0")}`;
    ids.push(id);

    const ref = db.collection("users").doc(id);
    batch.set(ref, {
      name: `Jogador ${i}`,
      email: `jogador${i}@perf.test`,
      role: "PLAYER",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    count++;
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return ids;
}

// ==========================================
// SEED — STATISTICS
// ==========================================

/**
 * Cria documentos de estatísticas para os usuários fornecidos.
 * Distribui XP de forma decrescente para simular ranking realista.
 *
 * @param db - Instância do Firestore
 * @param userIds - IDs dos usuários
 * @param groupId - ID do grupo
 */
export async function seedStatistics(
  db: admin.firestore.Firestore,
  userIds: string[],
  groupId = "group-perf-default"
): Promise<void> {
  const batchSize = 450;
  let batch = db.batch();
  let count = 0;

  for (let i = 0; i < userIds.length; i++) {
    const ref = db.collection("statistics").doc(`${groupId}_${userIds[i]}`);
    batch.set(ref, {
      user_id: userIds[i],
      group_id: groupId,
      xp: Math.max(0, 10000 - i * 18), // XP decrescente para simular ranking
      goals: Math.floor(Math.random() * 50),
      assists: Math.floor(Math.random() * 40),
      games_played: Math.floor(Math.random() * 100) + 1,
      wins: Math.floor(Math.random() * 60),
      mvp_count: Math.floor(Math.random() * 10),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    count++;
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

// ==========================================
// SEED — GROUPS
// ==========================================

/**
 * Cria n grupos fake no Firestore do emulador.
 *
 * @param db - Instância do Firestore
 * @param n - Número de grupos a criar
 * @param ownerUserId - ID do usuário dono dos grupos
 * @param prefix - Prefixo para IDs únicos entre suites
 * @returns IDs dos grupos criados
 */
export async function seedGroups(
  db: admin.firestore.Firestore,
  n: number,
  ownerUserId: string,
  prefix = "group"
): Promise<string[]> {
  const ids: string[] = [];
  const batch = db.batch();

  for (let i = 0; i < n; i++) {
    const id = `${prefix}-${i.toString().padStart(4, "0")}`;
    ids.push(id);

    const ref = db.collection("groups").doc(id);
    batch.set(ref, {
      name: `Grupo de Pelada ${i}`,
      owner_id: ownerUserId,
      member_count: Math.floor(Math.random() * 20) + 5,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return ids;
}

// ==========================================
// SEED — GAMES
// ==========================================

/**
 * Cria n jogos fake no Firestore.
 * Distribui datas entre passado e futuro para simular cenário real.
 *
 * @param db - Instância do Firestore
 * @param n - Total de jogos a criar
 * @param organizerId - ID do organizador
 * @param groupId - ID do grupo ao qual os jogos pertencem
 * @param prefix - Prefixo para IDs
 * @returns IDs dos jogos criados
 */
export async function seedGames(
  db: admin.firestore.Firestore,
  n: number,
  organizerId: string,
  groupId = "group-perf-default",
  prefix = "game"
): Promise<string[]> {
  const ids: string[] = [];
  const now = new Date();
  const batchSize = 450;
  let batch = db.batch();
  let count = 0;

  for (let i = 0; i < n; i++) {
    const id = `${prefix}-${i.toString().padStart(4, "0")}`;
    ids.push(id);

    // 60% dos jogos no futuro (próximos 14 dias), 40% no passado
    const daysOffset = i < Math.floor(n * 0.6)
      ? (i % 14) + 1
      : -((i % 30) + 1);

    const gameDate = new Date(now);
    gameDate.setDate(now.getDate() + daysOffset);

    const ref = db.collection("games").doc(id);
    batch.set(ref, {
      name: `Pelada ${i}`,
      group_id: groupId,
      organizer_id: organizerId,
      status: daysOffset > 0 ? "SCHEDULED" : "FINISHED",
      date: admin.firestore.Timestamp.fromDate(gameDate),
      location: `Campo ${i % 5}`,
      max_players: 22,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    count++;
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return ids;
}

// ==========================================
// SEED — GAME CONFIRMATIONS
// ==========================================

/**
 * Cria documentos de confirmação para um jogo específico.
 *
 * @param db - Instância do Firestore
 * @param gameId - ID do jogo
 * @param userIds - IDs dos usuários confirmados
 */
export async function seedConfirmations(
  db: admin.firestore.Firestore,
  gameId: string,
  userIds: string[]
): Promise<void> {
  const batch = db.batch();

  userIds.forEach((uid, i) => {
    const ref = db
      .collection("games")
      .doc(gameId)
      .collection("confirmations")
      .doc(uid);

    batch.set(ref, {
      user_id: uid,
      name: `Jogador ${i}`,
      confirmed_at: admin.firestore.FieldValue.serverTimestamp(),
      status: "CONFIRMED",
    });
  });

  await batch.commit();
}

// ==========================================
// SEED — TEAMS
// ==========================================

/**
 * Cria documentos de time para um jogo específico.
 *
 * @param db - Instância do Firestore
 * @param gameId - ID do jogo
 * @param teamCount - Número de times a criar
 */
export async function seedTeams(
  db: admin.firestore.Firestore,
  gameId: string,
  teamCount: number
): Promise<void> {
  const batch = db.batch();

  for (let i = 0; i < teamCount; i++) {
    const ref = db
      .collection("games")
      .doc(gameId)
      .collection("teams")
      .doc(`team-${i}`);

    batch.set(ref, {
      name: `Time ${String.fromCharCode(65 + i)}`, // Time A, Time B, ...
      players: [],
      score: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
}

// ==========================================
// SEED — PLAYER STATS (jogo específico)
// ==========================================

/**
 * Cria documentos de estatísticas de jogadores para um jogo específico.
 *
 * @param db - Instância do Firestore
 * @param gameId - ID do jogo
 * @param userIds - IDs dos jogadores
 */
export async function seedPlayerStats(
  db: admin.firestore.Firestore,
  gameId: string,
  userIds: string[]
): Promise<void> {
  const batchSize = 450;
  let batch = db.batch();
  let count = 0;

  for (const uid of userIds) {
    const ref = db
      .collection("games")
      .doc(gameId)
      .collection("player_stats")
      .doc(uid);

    batch.set(ref, {
      user_id: uid,
      goals: Math.floor(Math.random() * 3),
      assists: Math.floor(Math.random() * 2),
      saves: 0,
      xp_earned: 10,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    count++;
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

// ==========================================
// HELPER — BATCHED WHERE-IN
// ==========================================

/**
 * Executa queries whereIn em chunks para respeitar o limite de 10 items
 * por chunk (convenção do projeto, conforme CLAUDE.md).
 *
 * Retorna todos os documentos encontrados de todas as sub-queries.
 *
 * @param db - Instância do Firestore
 * @param collectionName - Nome da coleção
 * @param field - Campo a filtrar
 * @param ids - Lista de IDs a buscar
 * @param chunkSize - Tamanho máximo de cada chunk (padrão: 10)
 * @returns Todos os DocumentSnapshots encontrados
 */
export async function batchedWhereIn(
  db: admin.firestore.Firestore,
  collectionName: string,
  field: string | admin.firestore.FieldPath,
  ids: string[],
  chunkSize = 10
): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  if (ids.length === 0) return [];

  // Divide em chunks do tamanho configurado
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }

  // Executa todas as sub-queries em paralelo
  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      db.collection(collectionName).where(field, "in", chunk).get()
    )
  );

  // Combina os resultados
  return snapshots.flatMap((snap) => snap.docs);
}
