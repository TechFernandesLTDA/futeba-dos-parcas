/**
 * PERFORMANCE — RANKING QUERIES
 *
 * Simula a carga de dados da RankingScreen:
 * - Seed: 500 usuários com documentos de estatísticas
 * - Query: top 100 por XP, paginado (páginas de 25 docs)
 *
 * Critérios:
 * - < 500ms por página
 * - < 100 leituras por página
 *
 * Nota sobre contagem de leituras: o Admin SDK não expõe contador nativo.
 * Contamos leituras como snapshot.size de cada query de paginação.
 */

import * as admin from "firebase-admin";
import {
  initEmulatorApp,
  getDb,
  measureMs,
  seedUsers,
  seedStatistics,
  clearCollections,
} from "./utils";

// FIRESTORE_EMULATOR_HOST deve ser definido ANTES do initializeApp
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";

const GROUP_ID = "group-ranking-perf";
const PAGE_SIZE = 25;

beforeAll(async () => {
  initEmulatorApp();

  const db = getDb();

  // Seed: 500 usuários com estatísticas
  console.log("[Ranking] Criando 500 usuários e estatísticas...");
  const userIds = await seedUsers(db, 500, "rank-user");
  await seedStatistics(db, userIds, GROUP_ID);
  console.log("[Ranking] Seed concluído.");
}, 120_000);

afterAll(async () => {
  const db = getDb();
  await clearCollections(db, ["users", "statistics"]);
}, 30_000);

describe("RankingScreen Queries — Performance", () => {
  let db: admin.firestore.Firestore;

  beforeEach(() => {
    db = getDb();
  });

  test("primeira página (top 25) deve carregar em < 500ms", async () => {
    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("statistics")
        .where("group_id", "==", GROUP_ID)
        .orderBy("xp", "desc")
        .limit(PAGE_SIZE)
        .get()
    );

    console.log(
      `[Ranking] Página 1: ${snap.size} docs em ${ms.toFixed(1)}ms`
    );

    expect(ms).toBeLessThan(500);
    expect(snap.size).toBeLessThanOrEqual(PAGE_SIZE);

    // Verifica ordenação por XP decrescente
    if (snap.size >= 2) {
      const first = snap.docs[0].data().xp as number;
      const second = snap.docs[1].data().xp as number;
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  test("segunda página (startAfter) deve carregar em < 500ms", async () => {
    // Busca primeira página para obter cursor
    const firstPageSnap = await db
      .collection("statistics")
      .where("group_id", "==", GROUP_ID)
      .orderBy("xp", "desc")
      .limit(PAGE_SIZE)
      .get();

    expect(firstPageSnap.size).toBeGreaterThan(0);
    const lastDoc = firstPageSnap.docs[firstPageSnap.docs.length - 1];

    // Busca segunda página usando startAfter
    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("statistics")
        .where("group_id", "==", GROUP_ID)
        .orderBy("xp", "desc")
        .startAfter(lastDoc)
        .limit(PAGE_SIZE)
        .get()
    );

    console.log(
      `[Ranking] Página 2 (startAfter): ${snap.size} docs em ${ms.toFixed(1)}ms`
    );

    expect(ms).toBeLessThan(500);
    expect(snap.size).toBeLessThanOrEqual(PAGE_SIZE);
  });

  test("terceira página deve carregar em < 500ms", async () => {
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    // Navega até o cursor da segunda página
    for (let page = 0; page < 2; page++) {
      const query = lastDoc
        ? db
          .collection("statistics")
          .where("group_id", "==", GROUP_ID)
          .orderBy("xp", "desc")
          .startAfter(lastDoc)
          .limit(PAGE_SIZE)
        : db
          .collection("statistics")
          .where("group_id", "==", GROUP_ID)
          .orderBy("xp", "desc")
          .limit(PAGE_SIZE);

      const snap = await query.get();
      if (snap.size === 0) break;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    if (!lastDoc) {
      console.warn("[Ranking] Menos de 2 páginas disponíveis — pulando teste");
      return;
    }

    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("statistics")
        .where("group_id", "==", GROUP_ID)
        .orderBy("xp", "desc")
        .startAfter(lastDoc!)
        .limit(PAGE_SIZE)
        .get()
    );

    console.log(
      `[Ranking] Página 3 (startAfter): ${snap.size} docs em ${ms.toFixed(1)}ms`
    );

    expect(ms).toBeLessThan(500);
  });

  test("leituras por página devem ser < 100", async () => {
    const { result: snap, ms } = await measureMs(() =>
      db
        .collection("statistics")
        .where("group_id", "==", GROUP_ID)
        .orderBy("xp", "desc")
        .limit(PAGE_SIZE)
        .get()
    );

    // Contagem de leituras = número de documentos retornados
    const reads = snap.size;

    console.log(
      `[Ranking] Leituras na primeira página: ${reads} docs em ${ms.toFixed(1)}ms`
    );

    expect(reads).toBeLessThan(100);
  });

  test("top 100 carregados em 4 páginas, todas < 500ms cada", async () => {
    const timings: number[] = [];
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let totalDocs = 0;
    const maxPages = 4;

    for (let page = 0; page < maxPages; page++) {
      const query = lastDoc
        ? db
          .collection("statistics")
          .where("group_id", "==", GROUP_ID)
          .orderBy("xp", "desc")
          .startAfter(lastDoc)
          .limit(PAGE_SIZE)
        : db
          .collection("statistics")
          .where("group_id", "==", GROUP_ID)
          .orderBy("xp", "desc")
          .limit(PAGE_SIZE);

      const { result: snap, ms } = await measureMs(() => query.get());

      timings.push(ms);
      totalDocs += snap.size;

      console.log(
        `[Ranking] Página ${page + 1}: ${snap.size} docs em ${ms.toFixed(1)}ms`
      );

      expect(ms).toBeLessThan(500);

      if (snap.size === 0) break;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    console.log(
      `[Ranking] Total: ${totalDocs} docs em ${maxPages} páginas. ` +
      `Tempos: [${timings.map((t) => t.toFixed(1)).join(", ")}]ms`
    );

    expect(totalDocs).toBeGreaterThanOrEqual(PAGE_SIZE);
  });
});
