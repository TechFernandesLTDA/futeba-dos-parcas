/**
 * Testes de Firestore Security Rules — Coleção: weekly_stats
 *
 * Caracterização do comportamento ATUAL da rule (não é a rule ideal).
 * Ver DIAGNOSTICO para os casos marcados como HOJE PERMITE / HOJE NEGA.
 *
 * Regra real (firestore.rules, #2157):
 * - read: qualquer usuário autenticado (leitura pública de agregados)
 * - write: if false (só Admin SDK / Cloud Functions escrevem)
 *
 * Observação: o comentário da rule diz que docId == userId, mas a rule
 * não verifica isso em nenhum lugar (não há escrita de cliente para testar).
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const DOC_A = UID_PLAYER_A; // docId == userId (convenção do comentário da rule)
const DOC_B = UID_PLAYER_B;

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `weekly_stats/${DOC_A}`, {
    user_id: UID_PLAYER_A,
    games_played: 2,
    xp_gained: 120,
    week_start: new Date("2026-10-26T00:00:00Z"),
  });

  await seedDoc(testEnv, `weekly_stats/${DOC_B}`, {
    user_id: UID_PLAYER_B,
    games_played: 1,
    xp_gained: 40,
    week_start: new Date("2026-10-26T00:00:00Z"),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("weekly_stats — leitura", () => {
  it("Não-autenticado NÃO pode ler weekly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).get());
  });

  it("Dono (PlayerA) pode ler o próprio weekly_stats", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`weekly_stats/${DOC_A}`).get());
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): outro autenticado (PlayerB) lê weekly_stats de PlayerA", async () => {
    // Intencional pela rule (#2157, leitura pública de agregados), mas registrado
    // aqui para o DIAGNOSTICO decidir se estatísticas semanais devem ser públicas.
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`weekly_stats/${DOC_A}`).get());
  });

  it("Admin pode ler weekly_stats", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`weekly_stats/${DOC_A}`).get());
  });

  it("Não-autenticado NÃO pode listar weekly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("weekly_stats").get());
  });

  it("Autenticado pode listar weekly_stats sem filtro", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.collection("weekly_stats").get());
  });
});

describe("weekly_stats — criação", () => {
  it("Não-autenticado NÃO pode criar weekly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc("weekly_stats/novo-anon").set({ xp_gained: 1 }));
  });

  it("Dono (PlayerC) NÃO pode criar o próprio weekly_stats", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`weekly_stats/${UID_PLAYER_C}`).set({ user_id: UID_PLAYER_C, xp_gained: 10 })
    );
  });

  it("Outro autenticado (PlayerA) NÃO pode criar weekly_stats de PlayerC", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`weekly_stats/${UID_PLAYER_C}`).set({ user_id: UID_PLAYER_C, xp_gained: 10 })
    );
  });

  it("Admin NÃO pode criar weekly_stats pelo cliente (só Admin SDK)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc("weekly_stats/novo-admin").set({ xp_gained: 1 }));
  });
});

describe("weekly_stats — atualização", () => {
  it("Não-autenticado NÃO pode atualizar weekly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });

  it("Dono (PlayerA) NÃO pode atualizar o próprio weekly_stats", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });

  it("Outro autenticado (PlayerB) NÃO pode atualizar weekly_stats de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });

  it("Admin NÃO pode atualizar weekly_stats pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });
});

describe("weekly_stats — exclusão", () => {
  it("Não-autenticado NÃO pode excluir weekly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).delete());
  });

  it("Dono (PlayerA) NÃO pode excluir o próprio weekly_stats", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).delete());
  });

  it("Outro autenticado (PlayerB) NÃO pode excluir weekly_stats de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).delete());
  });

  it("Admin NÃO pode excluir weekly_stats pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`weekly_stats/${DOC_A}`).delete());
  });
});
