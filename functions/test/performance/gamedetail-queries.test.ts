/**
 * PERFORMANCE — GAME DETAIL QUERIES
 *
 * Simula a carga de dados da GameDetailScreen:
 * - Seed: 1 jogo + 20 confirmações + 5 times + 30 player_stats
 * - Query: todas as subcoleções do jogo carregadas em paralelo
 *
 * Critérios:
 * - Carga em paralelo (Promise.all) completa em < 600ms
 *
 * Nota sobre contagem de leituras: o Admin SDK não expõe contador nativo.
 * Contamos leituras como a soma de snapshot.size de cada subcoleção.
 */

import * as admin from "firebase-admin";
import {
  initEmulatorApp,
  getDb,
  measureMs,
  seedUsers,
  seedGames,
  seedConfirmations,
  seedTeams,
  seedPlayerStats,
  clearCollections,
} from "./utils";

// FIRESTORE_EMULATOR_HOST deve ser definido ANTES do initializeApp
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";

const GROUP_ID = "group-gamedetail-perf";

beforeAll(async () => {
  initEmulatorApp();
}, 10_000);

afterAll(async () => {
  const db = getDb();
  await clearCollections(db, ["users", "games"]);
}, 30_000);

describe("GameDetailScreen Queries — Performance", () => {
  let db: admin.firestore.Firestore;
  let gameId: string;
  let userIds: string[];

  beforeAll(async () => {
    db = getDb();

    // Seed: 30 usuários para confirmações e estatísticas
    userIds = await seedUsers(db, 30, "gd-user");

    // Seed: 1 jogo
    const [gid] = await seedGames(db, 1, userIds[0], GROUP_ID, "gd-game");
    gameId = gid;

    // Seed: subcoleções do jogo em paralelo
    await Promise.all([
      seedConfirmations(db, gameId, userIds.slice(0, 20)), // 20 confirmações
      seedTeams(db, gameId, 5), // 5 times
      seedPlayerStats(db, gameId, userIds.slice(0, 30)), // 30 player_stats
    ]);
  }, 60_000);

  test("carga em paralelo de todas as subcoleções deve completar em < 600ms", async () => {
    const { result: [gameSnap, confirmationsSnap, teamsSnap, statsSnap], ms } =
      await measureMs(() =>
        Promise.all([
          // Documento principal do jogo
          db.collection("games").doc(gameId).get(),

          // Subcoleção: confirmações
          db
            .collection("games")
            .doc(gameId)
            .collection("confirmations")
            .orderBy("confirmed_at", "asc")
            .get(),

          // Subcoleção: times
          db
            .collection("games")
            .doc(gameId)
            .collection("teams")
            .get(),

          // Subcoleção: estatísticas por jogador
          db
            .collection("games")
            .doc(gameId)
            .collection("player_stats")
            .get(),
        ])
      );

    const totalReads =
      (gameSnap.exists ? 1 : 0) +
      confirmationsSnap.size +
      teamsSnap.size +
      statsSnap.size;

    console.log(
      `[GameDetail] Carga completa em ${ms.toFixed(1)}ms. ` +
      `Leituras: game=1, confirmations=${confirmationsSnap.size}, ` +
      `teams=${teamsSnap.size}, player_stats=${statsSnap.size}, ` +
      `total=${totalReads}`
    );

    expect(ms).toBeLessThan(600);
  });

  test("documento principal do jogo deve existir e carregar em < 200ms", async () => {
    const { result: snap, ms } = await measureMs(() =>
      db.collection("games").doc(gameId).get()
    );

    console.log(`[GameDetail] Doc principal: exists=${snap.exists} em ${ms.toFixed(1)}ms`);

    expect(ms).toBeLessThan(200);
    expect(snap.exists).toBe(true);
    expect(snap.data()?.group_id).toBe(GROUP_ID);
  });

  test("confirmações devem ter 20 documentos e carregar em < 400ms", async () => {
    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("games")
        .doc(gameId)
        .collection("confirmations")
        .orderBy("confirmed_at", "asc")
        .get()
    );

    console.log(
      `[GameDetail] Confirmações: ${snap.size} docs em ${ms.toFixed(1)}ms`
    );

    expect(ms).toBeLessThan(400);
    expect(snap.size).toBe(20);
  });

  test("times devem ter 5 documentos e carregar em < 300ms", async () => {
    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("games")
        .doc(gameId)
        .collection("teams")
        .get()
    );

    console.log(`[GameDetail] Times: ${snap.size} docs em ${ms.toFixed(1)}ms`);

    expect(ms).toBeLessThan(300);
    expect(snap.size).toBe(5);
  });

  test("player_stats devem ter 30 documentos e carregar em < 400ms", async () => {
    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("games")
        .doc(gameId)
        .collection("player_stats")
        .get()
    );

    console.log(
      `[GameDetail] Player stats: ${snap.size} docs em ${ms.toFixed(1)}ms`
    );

    expect(ms).toBeLessThan(400);
    expect(snap.size).toBe(30);
  });

  test("total de leituras da GameDetailScreen deve ser 56 (1+20+5+30)", async () => {
    const [gameSnap, confirmationsSnap, teamsSnap, statsSnap] =
      await Promise.all([
        db.collection("games").doc(gameId).get(),
        db.collection("games").doc(gameId).collection("confirmations").get(),
        db.collection("games").doc(gameId).collection("teams").get(),
        db.collection("games").doc(gameId).collection("player_stats").get(),
      ]);

    const totalReads =
      (gameSnap.exists ? 1 : 0) +
      confirmationsSnap.size +
      teamsSnap.size +
      statsSnap.size;

    // 1 (game) + 20 (confirmações) + 5 (times) + 30 (stats) = 56
    console.log(`[GameDetail] Total de leituras: ${totalReads}`);

    expect(totalReads).toBe(56);
  });
});
