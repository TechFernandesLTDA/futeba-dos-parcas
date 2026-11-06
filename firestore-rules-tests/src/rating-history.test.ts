/**
 * Testes de Firestore Security Rules — Subcoleção: users/{userId}/rating_history
 *
 * Caracterização do comportamento ATUAL da rule (não é a rule ideal).
 * Ver DIAGNOSTICO para os casos marcados como HOJE PERMITE / HOJE NEGA.
 *
 * Regra real (firestore.rules, dentro de match /users/{userId}, #1994 e #1709):
 * - read: request.auth.uid == userId (dono do caminho) OU ADMIN
 * - create, update, delete: if false (só Cloud Functions via Admin SDK escrevem)
 *
 * Como a regra está aninhada em users/{userId}, o userId é o do CAMINHO.
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const ENTRY_A = `users/${UID_PLAYER_A}/rating_history/entry-001`;
const COLLECTION_A = `users/${UID_PLAYER_A}/rating_history`;

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, ENTRY_A, {
    rating: 3.5,
    previous_rating: 3.2,
    source: "GAME",
    created_at: new Date("2026-10-28T00:00:00Z"),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("rating_history — leitura", () => {
  it("Não-autenticado NÃO pode ler rating_history", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(ENTRY_A).get());
  });

  it("Dono do caminho (PlayerA) pode ler o próprio rating_history", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(ENTRY_A).get());
  });

  it("Outro autenticado (PlayerB) NÃO pode ler rating_history de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(ENTRY_A).get());
  });

  it("Admin pode ler rating_history de qualquer usuário", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(ENTRY_A).get());
  });

  it("Não-autenticado NÃO pode listar rating_history", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection(COLLECTION_A).get());
  });

  it("Dono (PlayerA) pode listar o próprio rating_history", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.collection(COLLECTION_A).get());
  });

  it("Outro autenticado (PlayerB) NÃO pode listar rating_history de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.collection(COLLECTION_A).get());
  });

  it("Admin pode listar rating_history de PlayerA", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.collection(COLLECTION_A).get());
  });
});

describe("rating_history — criação", () => {
  it("Não-autenticado NÃO pode criar rating_history", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`${COLLECTION_A}/novo-anon`).set({ rating: 4 }));
  });

  it("Dono (PlayerA) NÃO pode criar entrada no próprio rating_history", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`${COLLECTION_A}/novo-dono`).set({ rating: 4 }));
  });

  it("Outro autenticado (PlayerB) NÃO pode criar entrada em rating_history de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`${COLLECTION_A}/novo-outro`).set({ rating: 4 }));
  });

  it("Admin NÃO pode criar rating_history pelo cliente (só Cloud Functions)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`${COLLECTION_A}/novo-admin`).set({ rating: 4 }));
  });
});

describe("rating_history — atualização", () => {
  it("Não-autenticado NÃO pode atualizar rating_history", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(ENTRY_A).update({ rating: 5 }));
  });

  it("Dono (PlayerA) NÃO pode atualizar a própria entrada", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(ENTRY_A).update({ rating: 5 }));
  });

  it("Outro autenticado (PlayerB) NÃO pode atualizar entrada de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(ENTRY_A).update({ rating: 5 }));
  });

  it("Admin NÃO pode atualizar rating_history pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(ENTRY_A).update({ rating: 5 }));
  });
});

describe("rating_history — exclusão", () => {
  it("Não-autenticado NÃO pode excluir rating_history", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(ENTRY_A).delete());
  });

  it("Dono (PlayerA) NÃO pode excluir a própria entrada", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(ENTRY_A).delete());
  });

  it("Outro autenticado (PlayerB) NÃO pode excluir entrada de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(ENTRY_A).delete());
  });

  it("Admin NÃO pode excluir rating_history pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(ENTRY_A).delete());
  });
});
