/**
 * Script de Reparação de Órfãos
 * Futeba dos Parças - v1.4.0
 *
 * Detecta e repara referências órfãs no Firestore:
 * - Games com groupId inválido
 * - Games com locationId inválido
 * - Confirmations com gameId inválido
 * - Statistics com userId inválido
 * - XP Logs com referências inválidas
 *
 * Uso:
 *   node repair_orphans.js [--fix] [--dry-run] [--archive]
 *
 * Flags:
 *   --fix      Corrige/arquiva órfãos
 *   --dry-run  Mostra correções sem aplicar
 *   --archive  Move para coleção de arquivo em vez de deletar
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

// Inicializar Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Caches para verificação
const validGroups = new Set();
const validLocations = new Set();
const validGames = new Set();
const validUsers = new Set();

// Contadores
const stats = {
  gamesWithInvalidGroup: [],
  gamesWithInvalidLocation: [],
  confirmationsWithInvalidGame: [],
  statisticsWithInvalidUser: [],
  xpLogsWithInvalidRef: [],
  totalOrphans: 0,
  archived: 0,
  deleted: 0,
};

/**
 * Carrega todos os IDs válidos para cache
 */
async function loadValidIds() {
  console.log("Carregando IDs válidos para cache...");

  // Grupos
  const groupsSnapshot = await db.collection("groups").select().get();
  for (const doc of groupsSnapshot.docs) {
    validGroups.add(doc.id);
  }
  console.log(`  Grupos: ${validGroups.size}`);

  // Locais
  const locationsSnapshot = await db.collection("locations").select().get();
  for (const doc of locationsSnapshot.docs) {
    validLocations.add(doc.id);
  }
  console.log(`  Locais: ${validLocations.size}`);

  // Jogos
  const gamesSnapshot = await db.collection("games").select().get();
  for (const doc of gamesSnapshot.docs) {
    validGames.add(doc.id);
  }
  console.log(`  Jogos: ${validGames.size}`);

  // Usuários
  const usersSnapshot = await db.collection("users").select().get();
  for (const doc of usersSnapshot.docs) {
    validUsers.add(doc.id);
  }
  console.log(`  Usuários: ${validUsers.size}`);

  console.log("");
}

/**
 * Verifica jogos com foreign keys inválidas
 */
async function checkGamesOrphans() {
  console.log("Verificando jogos órfãos...");

  const gamesSnapshot = await db.collection("games").get();

  for (const doc of gamesSnapshot.docs) {
    const data = doc.data();

    // Verificar group_id
    if (data.group_id && !validGroups.has(data.group_id)) {
      stats.gamesWithInvalidGroup.push({
        id: doc.id,
        title: data.title || data.name,
        invalidRef: data.group_id,
        date: data.date || data.game_date,
      });
    }

    // Verificar location_id
    if (data.location_id && !validLocations.has(data.location_id)) {
      stats.gamesWithInvalidLocation.push({
        id: doc.id,
        title: data.title || data.name,
        invalidRef: data.location_id,
        date: data.date || data.game_date,
      });
    }
  }

  console.log(
    `  Games com grupo inválido: ${stats.gamesWithInvalidGroup.length}`
  );
  console.log(
    `  Games com local inválido: ${stats.gamesWithInvalidLocation.length}`
  );
}

/**
 * Verifica confirmações com gameId inválido
 */
async function checkConfirmationsOrphans() {
  console.log("Verificando confirmações órfãs...");

  // Confirmações são subcoleção de games, então precisamos iterar
  for (const gameId of validGames) {
    const confirmationsSnapshot = await db
      .collection("games")
      .doc(gameId)
      .collection("confirmations")
      .get();

    for (const doc of confirmationsSnapshot.docs) {
      const data = doc.data();

      // Verificar user_id
      if (data.user_id && !validUsers.has(data.user_id)) {
        stats.confirmationsWithInvalidGame.push({
          gameId,
          confirmationId: doc.id,
          invalidUserId: data.user_id,
        });
      }
    }
  }

  console.log(
    `  Confirmações com usuário inválido: ${stats.confirmationsWithInvalidGame.length}`
  );
}

/**
 * Verifica estatísticas com userId inválido
 */
async function checkStatisticsOrphans() {
  console.log("Verificando estatísticas órfãs...");

  const statsSnapshot = await db.collection("statistics").get();

  for (const doc of statsSnapshot.docs) {
    const data = doc.data();

    // Verificar user_id
    if (data.user_id && !validUsers.has(data.user_id)) {
      stats.statisticsWithInvalidUser.push({
        id: doc.id,
        invalidUserId: data.user_id,
      });
    }
  }

  console.log(
    `  Estatísticas com usuário inválido: ${stats.statisticsWithInvalidUser.length}`
  );
}

/**
 * Verifica XP logs com referências inválidas
 */
async function checkXPLogsOrphans() {
  console.log("Verificando XP logs órfãos...");

  const xpLogsSnapshot = await db.collection("xp_logs").get();

  for (const doc of xpLogsSnapshot.docs) {
    const data = doc.data();
    let isOrphan = false;
    const invalidRefs = [];

    // Verificar user_id
    if (data.user_id && !validUsers.has(data.user_id)) {
      isOrphan = true;
      invalidRefs.push(`user_id: ${data.user_id}`);
    }

    // Verificar game_id
    if (data.game_id && !validGames.has(data.game_id)) {
      isOrphan = true;
      invalidRefs.push(`game_id: ${data.game_id}`);
    }

    if (isOrphan) {
      stats.xpLogsWithInvalidRef.push({
        id: doc.id,
        invalidRefs,
        amount: data.amount,
      });
    }
  }

  console.log(
    `  XP logs com referência inválida: ${stats.xpLogsWithInvalidRef.length}`
  );
}

/**
 * Arquiva um documento em coleção de arquivo
 */
async function archiveDocument(collection, docId, data) {
  const archiveRef = db.collection(`${collection}_archived`).doc(docId);
  await archiveRef.set({
    ...data,
    _archived_at: admin.firestore.FieldValue.serverTimestamp(),
    _archive_reason: "orphan_cleanup",
  });
  await db.collection(collection).doc(docId).delete();
}

/**
 * Corrige/arquiva órfãos
 */
async function fixOrphans(shouldArchive, dryRun) {
  console.log("\nCorrigindo órfãos...\n");

  // 1. Games com grupo inválido
  for (const game of stats.gamesWithInvalidGroup) {
    console.log(`[GAME] ${game.title || game.id} - grupo inválido`);
    if (!dryRun) {
      if (shouldArchive) {
        const doc = await db.collection("games").doc(game.id).get();
        await archiveDocument("games", game.id, doc.data());
        stats.archived++;
      } else {
        // Apenas limpar a referência inválida
        await db.collection("games").doc(game.id).update({
          group_id: admin.firestore.FieldValue.delete(),
        });
      }
    }
  }

  // 2. Games com local inválido
  for (const game of stats.gamesWithInvalidLocation) {
    console.log(`[GAME] ${game.title || game.id} - local inválido`);
    if (!dryRun) {
      // Apenas limpar a referência inválida (não deletar o jogo)
      await db.collection("games").doc(game.id).update({
        location_id: admin.firestore.FieldValue.delete(),
      });
    }
  }

  // 3. Confirmações órfãs
  for (const conf of stats.confirmationsWithInvalidGame) {
    console.log(`[CONFIRMATION] ${conf.confirmationId} - usuário inválido`);
    if (!dryRun) {
      await db
        .collection("games")
        .doc(conf.gameId)
        .collection("confirmations")
        .doc(conf.confirmationId)
        .delete();
      stats.deleted++;
    }
  }

  // 4. Estatísticas órfãs
  for (const stat of stats.statisticsWithInvalidUser) {
    console.log(`[STATISTICS] ${stat.id} - usuário inválido`);
    if (!dryRun) {
      if (shouldArchive) {
        const doc = await db.collection("statistics").doc(stat.id).get();
        await archiveDocument("statistics", stat.id, doc.data());
        stats.archived++;
      } else {
        await db.collection("statistics").doc(stat.id).delete();
        stats.deleted++;
      }
    }
  }

  // 5. XP logs órfãos
  for (const log of stats.xpLogsWithInvalidRef) {
    console.log(`[XP_LOG] ${log.id} - ${log.invalidRefs.join(", ")}`);
    if (!dryRun) {
      if (shouldArchive) {
        const doc = await db.collection("xp_logs").doc(log.id).get();
        await archiveDocument("xp_logs", log.id, doc.data());
        stats.archived++;
      } else {
        await db.collection("xp_logs").doc(log.id).delete();
        stats.deleted++;
      }
    }
  }
}

/**
 * Executa verificação e reparação
 */
async function repairOrphans(shouldFix, dryRun, shouldArchive) {
  console.log("========================================");
  console.log("   REPARAÇÃO DE ÓRFÃOS - Futeba");
  console.log("========================================");
  console.log(`Modo: ${shouldFix ? (dryRun ? "DRY-RUN" : "FIX") : "VERIFICAÇÃO"}`);
  if (shouldFix && shouldArchive) {
    console.log("Arquivando em vez de deletar");
  }
  console.log("");

  // Carregar IDs válidos
  await loadValidIds();

  // Verificar órfãos
  await checkGamesOrphans();
  await checkConfirmationsOrphans();
  await checkStatisticsOrphans();
  await checkXPLogsOrphans();

  // Calcular total
  stats.totalOrphans =
    stats.gamesWithInvalidGroup.length +
    stats.gamesWithInvalidLocation.length +
    stats.confirmationsWithInvalidGame.length +
    stats.statisticsWithInvalidUser.length +
    stats.xpLogsWithInvalidRef.length;

  // Corrigir se solicitado
  if (shouldFix && stats.totalOrphans > 0) {
    await fixOrphans(shouldArchive, dryRun);
  }

  // Relatório final
  console.log("\n========================================");
  console.log("              RELATÓRIO FINAL");
  console.log("========================================");
  console.log(`\nGames com grupo inválido:     ${stats.gamesWithInvalidGroup.length}`);
  console.log(`Games com local inválido:     ${stats.gamesWithInvalidLocation.length}`);
  console.log(`Confirmações órfãs:           ${stats.confirmationsWithInvalidGame.length}`);
  console.log(`Estatísticas órfãs:           ${stats.statisticsWithInvalidUser.length}`);
  console.log(`XP logs órfãos:               ${stats.xpLogsWithInvalidRef.length}`);
  console.log(`\nTOTAL DE ÓRFÃOS:              ${stats.totalOrphans}`);

  if (shouldFix) {
    console.log(
      `\nArquivados: ${stats.archived}${dryRun ? " (dry-run)" : ""}`
    );
    console.log(`Deletados:  ${stats.deleted}${dryRun ? " (dry-run)" : ""}`);
  }

  // Detalhes
  if (stats.totalOrphans > 0 && !shouldFix) {
    console.log("\n--- DETALHES (primeiros 10 de cada tipo) ---\n");

    if (stats.gamesWithInvalidGroup.length > 0) {
      console.log("Games com grupo inválido:");
      for (const game of stats.gamesWithInvalidGroup.slice(0, 10)) {
        console.log(`  - ${game.title || game.id} (grupo: ${game.invalidRef})`);
      }
    }

    if (stats.gamesWithInvalidLocation.length > 0) {
      console.log("\nGames com local inválido:");
      for (const game of stats.gamesWithInvalidLocation.slice(0, 10)) {
        console.log(`  - ${game.title || game.id} (local: ${game.invalidRef})`);
      }
    }

    if (stats.confirmationsWithInvalidGame.length > 0) {
      console.log("\nConfirmações órfãs:");
      for (const conf of stats.confirmationsWithInvalidGame.slice(0, 10)) {
        console.log(
          `  - Game ${conf.gameId} / Confirmação ${conf.confirmationId}`
        );
      }
    }

    if (stats.statisticsWithInvalidUser.length > 0) {
      console.log("\nEstatísticas órfãs:");
      for (const stat of stats.statisticsWithInvalidUser.slice(0, 10)) {
        console.log(`  - ${stat.id} (user: ${stat.invalidUserId})`);
      }
    }

    if (stats.xpLogsWithInvalidRef.length > 0) {
      console.log("\nXP logs órfãos:");
      for (const log of stats.xpLogsWithInvalidRef.slice(0, 10)) {
        console.log(`  - ${log.id}: ${log.invalidRefs.join(", ")}`);
      }
    }
  }

  console.log("\n========================================");

  return stats;
}

// Execução principal
const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");
const dryRun = args.includes("--dry-run");
const shouldArchive = args.includes("--archive");

repairOrphans(shouldFix, dryRun, shouldArchive)
  .then((result) => {
    console.log("\nVerificação concluída!");
    process.exit(result.totalOrphans > 0 && !shouldFix ? 1 : 0);
  })
  .catch((error) => {
    console.error("Erro na verificação:", error);
    process.exit(1);
  });
