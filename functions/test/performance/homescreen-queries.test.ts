/**
 * PERFORMANCE — HOMESCREEN QUERIES
 *
 * Simula a carga de dados da HomeScreen:
 * - Seed: 50 jogos + 10 grupos + 1 usuário
 * - Query: próximos jogos para o usuário (máx 10 nos próximos 14 dias)
 *
 * Critérios:
 * - Query completa em < 500ms
 * - Total de leituras de documento < 50
 *
 * Nota sobre contagem de leituras: o Admin SDK não expõe contador nativo.
 * Contamos leituras como a soma de snapshot.size de cada query executada.
 */

import * as admin from "firebase-admin";
import {
  initEmulatorApp,
  getDb,
  measureMs,
  seedUsers,
  seedGroups,
  seedGames,
  clearCollections,
} from "./utils";

// FIRESTORE_EMULATOR_HOST deve ser definido ANTES do initializeApp
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";

beforeAll(async () => {
  initEmulatorApp();
}, 30_000);

afterAll(async () => {
  const db = getDb();
  await clearCollections(db, ["users", "games", "groups"]);
}, 30_000);

describe("HomeScreen Queries — Performance", () => {
  let db: admin.firestore.Firestore;
  let userId: string;
  let groupId: string;

  beforeAll(async () => {
    db = getDb();

    // Cria 1 usuário organizador
    const [uid] = await seedUsers(db, 1, "hs-user");
    userId = uid;

    // Cria 10 grupos
    const [gid] = await seedGroups(db, 10, userId, "hs-group");
    groupId = gid;

    // Cria 50 jogos (mix futuro/passado)
    await seedGames(db, 50, userId, groupId, "hs-game");
  }, 60_000);

  test("deve carregar próximos jogos em < 500ms", async () => {
    const now = new Date();
    const fourteenDaysLater = new Date(now);
    fourteenDaysLater.setDate(now.getDate() + 14);

    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("games")
        .where("group_id", "==", groupId)
        .where("status", "==", "SCHEDULED")
        .where("date", ">=", admin.firestore.Timestamp.fromDate(now))
        .where("date", "<=", admin.firestore.Timestamp.fromDate(fourteenDaysLater))
        .orderBy("date", "asc")
        .limit(10)
        .get()
    );

    console.log(`[HomeScreen] Próximos jogos: ${snap.size} docs em ${ms.toFixed(1)}ms`);

    expect(ms).toBeLessThan(500);
    expect(snap.size).toBeLessThanOrEqual(10);
  });

  test("deve carregar grupos do usuário em < 500ms", async () => {
    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("groups")
        .where("owner_id", "==", userId)
        .limit(10)
        .get()
    );

    console.log(`[HomeScreen] Grupos do usuário: ${snap.size} docs em ${ms.toFixed(1)}ms`);

    expect(ms).toBeLessThan(500);
  });

  test("total de leituras da HomeScreen deve ser < 50", async () => {
    const now = new Date();
    const fourteenDaysLater = new Date(now);
    fourteenDaysLater.setDate(now.getDate() + 14);

    // Simula carga completa da HomeScreen com queries em paralelo
    const [gamesSnap, groupsSnap, userSnap] = await Promise.all([
      db
        .collection("games")
        .where("group_id", "==", groupId)
        .where("status", "==", "SCHEDULED")
        .where("date", ">=", admin.firestore.Timestamp.fromDate(now))
        .where("date", "<=", admin.firestore.Timestamp.fromDate(fourteenDaysLater))
        .orderBy("date", "asc")
        .limit(10)
        .get(),
      db
        .collection("groups")
        .where("owner_id", "==", userId)
        .limit(10)
        .get(),
      db.collection("users").doc(userId).get(),
    ]);

    // Contagem de leituras: soma de docs lidos em cada query
    const totalReads =
      gamesSnap.size +
      groupsSnap.size +
      (userSnap.exists ? 1 : 0);

    console.log(
      `[HomeScreen] Total de leituras: ${totalReads}` +
      ` (jogos=${gamesSnap.size}, grupos=${groupsSnap.size}, user=${userSnap.exists ? 1 : 0})`
    );

    expect(totalReads).toBeLessThan(50);
  });

  test("carga completa da HomeScreen deve completar em < 500ms", async () => {
    const now = new Date();
    const fourteenDaysLater = new Date(now);
    fourteenDaysLater.setDate(now.getDate() + 14);

    const { ms } = await measureMs(() =>
      Promise.all([
        db
          .collection("games")
          .where("group_id", "==", groupId)
          .where("status", "==", "SCHEDULED")
          .where("date", ">=", admin.firestore.Timestamp.fromDate(now))
          .where("date", "<=", admin.firestore.Timestamp.fromDate(fourteenDaysLater))
          .orderBy("date", "asc")
          .limit(10)
          .get(),
        db
          .collection("groups")
          .where("owner_id", "==", userId)
          .limit(10)
          .get(),
        db.collection("users").doc(userId).get(),
      ])
    );

    console.log(`[HomeScreen] Carga completa em paralelo: ${ms.toFixed(1)}ms`);

    expect(ms).toBeLessThan(500);
  });
});
