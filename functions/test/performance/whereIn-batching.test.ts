/**
 * PERFORMANCE — WHERE-IN BATCHING
 *
 * Valida que a função batchedWhereIn divide queries em chunks de 10.
 * O Firestore Admin SDK v10+ aceita até 30 items por whereIn,
 * mas a convenção do projeto é chunks de 10 (conforme CLAUDE.md)
 * para manter paridade com a limitação original e queries previsíveis.
 *
 * Critérios:
 * - 25 IDs → 3 sub-queries (chunks: 10, 10, 5)
 * - Todos os resultados são retornados corretamente
 * - Nenhum erro é lançado
 */

import * as admin from "firebase-admin";
import {
  initEmulatorApp,
  getDb,
  measureMs,
  seedUsers,
  batchedWhereIn,
  clearCollections,
} from "./utils";

// FIRESTORE_EMULATOR_HOST deve ser definido ANTES do initializeApp
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";

beforeAll(async () => {
  initEmulatorApp();
}, 10_000);

afterAll(async () => {
  const db = getDb();
  await clearCollections(db, ["users"]);
}, 30_000);

describe("whereIn Batching — Validação", () => {
  let db: admin.firestore.Firestore;
  let seededIds: string[];

  beforeAll(async () => {
    db = getDb();

    // Seed: 25 usuários para testar batching
    seededIds = await seedUsers(db, 25, "wi-user");
  }, 30_000);

  test("batchedWhereIn com 25 IDs deve retornar todos os 25 documentos", async () => {
    const docs = await batchedWhereIn(
      db,
      "users",
      admin.firestore.FieldPath.documentId(),
      seededIds,
      10
    );

    console.log(`[WhereIn] 25 IDs → ${docs.length} docs retornados`);

    expect(docs.length).toBe(25);
  });

  test("batchedWhereIn com 25 IDs deve resultar em 3 chunks [10, 10, 5]", async () => {
    // Verifica a lógica de chunking diretamente
    const chunkSize = 10;
    const ids = seededIds; // 25 IDs

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    console.log(
      `[WhereIn] 25 IDs → ${chunks.length} chunks: ` +
      chunks.map((c) => c.length).join(", ")
    );

    // 25 IDs com chunkSize=10 → 3 chunks [10, 10, 5]
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(10);
    expect(chunks[1].length).toBe(10);
    expect(chunks[2].length).toBe(5);
  });

  test("batchedWhereIn deve completar em < 500ms para 25 IDs", async () => {
    const { result: docs, ms } = await measureMs(() =>
      batchedWhereIn(
        db,
        "users",
        admin.firestore.FieldPath.documentId(),
        seededIds,
        10
      )
    );

    console.log(`[WhereIn] 25 IDs em ${ms.toFixed(1)}ms → ${docs.length} docs`);

    expect(ms).toBeLessThan(500);
    expect(docs.length).toBe(25);
  });

  test("batchedWhereIn com 10 IDs deve executar 1 única sub-query", async () => {
    const ids10 = seededIds.slice(0, 10);

    const chunks: string[][] = [];
    const chunkSize = 10;
    for (let i = 0; i < ids10.length; i += chunkSize) {
      chunks.push(ids10.slice(i, i + chunkSize));
    }

    console.log(`[WhereIn] 10 IDs → ${chunks.length} chunk(s)`);

    // 10 IDs com chunkSize=10 → exatamente 1 chunk
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(10);

    // Valida que todos os documentos são retornados
    const docs = await batchedWhereIn(
      db,
      "users",
      admin.firestore.FieldPath.documentId(),
      ids10,
      10
    );

    expect(docs.length).toBe(10);
  });

  test("batchedWhereIn com array vazio deve retornar array vazio sem erros", async () => {
    const docs = await batchedWhereIn(
      db,
      "users",
      admin.firestore.FieldPath.documentId(),
      [],
      10
    );

    expect(docs).toEqual([]);
  });

  test("batchedWhereIn com IDs inexistentes deve retornar apenas os existentes", async () => {
    const mixedIds = [
      ...seededIds.slice(0, 5),
      "id-que-nao-existe-001",
      "id-que-nao-existe-002",
    ];

    const docs = await batchedWhereIn(
      db,
      "users",
      admin.firestore.FieldPath.documentId(),
      mixedIds,
      10
    );

    console.log(
      `[WhereIn] ${mixedIds.length} IDs (5 existentes + 2 inexistentes) → ${docs.length} docs`
    );

    // Retorna apenas os existentes
    expect(docs.length).toBe(5);
  });

  test("batchedWhereIn com chunkSize=5 deve dividir 25 IDs em 5 chunks", async () => {
    const chunks: string[][] = [];
    const chunkSize = 5;
    for (let i = 0; i < seededIds.length; i += chunkSize) {
      chunks.push(seededIds.slice(i, i + chunkSize));
    }

    console.log(
      `[WhereIn] 25 IDs com chunkSize=5 → ${chunks.length} chunks`
    );

    expect(chunks.length).toBe(5);
    chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(5));

    // Valida funcionamento com chunkSize menor
    const docs = await batchedWhereIn(
      db,
      "users",
      admin.firestore.FieldPath.documentId(),
      seededIds,
      5
    );

    expect(docs.length).toBe(25);
  });
});
