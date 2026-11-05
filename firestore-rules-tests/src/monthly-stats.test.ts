/**
 * Testes de Firestore Security Rules — Coleção: monthly_stats
 *
 * Caracterização do comportamento ATUAL da rule (não é a rule ideal).
 * Ver DIAGNOSTICO para os casos marcados como HOJE PERMITE / HOJE NEGA.
 *
 * Regra real (firestore.rules, #2157):
 * - read: qualquer usuário autenticado (leitura pública de agregados)
 * - write: if false (só Admin SDK / Cloud Functions escrevem)
 *
 * Não há regra de dono: o docId não é amarrado ao uid. A "dona" de um
 * documento é só o campo user_id, que a rule não consulta.
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

const DOC_A = `2026-10_${UID_PLAYER_A}`;
const DOC_B = `2026-10_${UID_PLAYER_B}`;

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `monthly_stats/${DOC_A}`, {
    user_id: UID_PLAYER_A,
    month: "2026-10",
    games_played: 6,
    xp_gained: 410,
  });

  await seedDoc(testEnv, `monthly_stats/${DOC_B}`, {
    user_id: UID_PLAYER_B,
    month: "2026-10",
    games_played: 3,
    xp_gained: 150,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("monthly_stats — leitura", () => {
  it("Não-autenticado NÃO pode ler monthly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).get());
  });

  it("Dono (PlayerA) pode ler o próprio monthly_stats", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`monthly_stats/${DOC_A}`).get());
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): outro autenticado (PlayerB) lê monthly_stats de PlayerA", async () => {
    // Intencional pela rule (#2157, leitura pública de agregados), registrado
    // para o DIAGNOSTICO decidir se estatísticas mensais devem ser públicas.
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`monthly_stats/${DOC_A}`).get());
  });

  it("Admin pode ler monthly_stats", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`monthly_stats/${DOC_A}`).get());
  });

  it("Não-autenticado NÃO pode listar monthly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("monthly_stats").get());
  });

  it("Autenticado pode listar monthly_stats sem filtro", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.collection("monthly_stats").get());
  });
});

describe("monthly_stats — criação", () => {
  it("Não-autenticado NÃO pode criar monthly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc("monthly_stats/novo-anon").set({ xp_gained: 1 }));
  });

  it("Dono (PlayerC) NÃO pode criar o próprio monthly_stats", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`monthly_stats/2026-10_${UID_PLAYER_C}`).set({ user_id: UID_PLAYER_C, xp_gained: 10 })
    );
  });

  it("Outro autenticado (PlayerA) NÃO pode criar monthly_stats de PlayerC", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`monthly_stats/2026-10_${UID_PLAYER_C}`).set({ user_id: UID_PLAYER_C, xp_gained: 10 })
    );
  });

  it("Admin NÃO pode criar monthly_stats pelo cliente (só Admin SDK)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc("monthly_stats/novo-admin").set({ xp_gained: 1 }));
  });
});

describe("monthly_stats — atualização", () => {
  it("Não-autenticado NÃO pode atualizar monthly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });

  it("Dono (PlayerA) NÃO pode atualizar o próprio monthly_stats", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });

  it("Outro autenticado (PlayerB) NÃO pode atualizar monthly_stats de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });

  it("Admin NÃO pode atualizar monthly_stats pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).update({ xp_gained: 999 }));
  });
});

describe("monthly_stats — exclusão", () => {
  it("Não-autenticado NÃO pode excluir monthly_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).delete());
  });

  it("Dono (PlayerA) NÃO pode excluir o próprio monthly_stats", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).delete());
  });

  it("Outro autenticado (PlayerB) NÃO pode excluir monthly_stats de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).delete());
  });

  it("Admin NÃO pode excluir monthly_stats pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`monthly_stats/${DOC_A}`).delete());
  });
});
