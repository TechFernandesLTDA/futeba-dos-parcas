/**
 * Testes de Firestore Security Rules — Coleção: user_streaks
 *
 * Caracterização do comportamento ATUAL da rule (não é a rule ideal).
 * Ver DIAGNOSTICO para os casos marcados como HOJE PERMITE / HOJE NEGA.
 *
 * Regra real (firestore.rules, linha ~3926):
 * - read: qualquer usuário autenticado
 * - create, update: somente ADMIN (custom claim)
 * - delete: sem regra, portanto negado para todos (inclusive ADMIN)
 *
 * PERMISSION_MATRIX.md (linha 167) concorda com a parte de escrita.
 * Não há checagem de dono: streakId não é amarrado ao uid.
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
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const STREAK_A = UID_PLAYER_A; // streakId == userId (convenção assumida pelo teste)

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `user_streaks/${STREAK_A}`, {
    user_id: UID_PLAYER_A,
    current_streak: 3,
    longest_streak: 5,
    last_game_date: new Date("2026-10-28T00:00:00Z"),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("user_streaks — leitura", () => {
  it("Não-autenticado NÃO pode ler user_streaks", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).get());
  });

  it("Dono (PlayerA) pode ler o próprio user_streaks", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`user_streaks/${STREAK_A}`).get());
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): outro autenticado (PlayerC) lê streak de PlayerA", async () => {
    // Qualquer autenticado lê o streak de qualquer usuário: a rule não checa dono.
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`user_streaks/${STREAK_A}`).get());
  });

  it("Admin pode ler user_streaks", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`user_streaks/${STREAK_A}`).get());
  });

  it("Não-autenticado NÃO pode listar user_streaks", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("user_streaks").get());
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): autenticado lista user_streaks sem filtro", async () => {
    // Lista completa de streaks de todos os usuários para qualquer autenticado.
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.collection("user_streaks").get());
  });
});

describe("user_streaks — criação", () => {
  it("Não-autenticado NÃO pode criar user_streaks", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc("user_streaks/novo-anon").set({ current_streak: 1 }));
  });

  it("Dono (PlayerC) NÃO pode criar o próprio user_streaks", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`user_streaks/${UID_PLAYER_C}`).set({ user_id: UID_PLAYER_C, current_streak: 1 })
    );
  });

  it("Outro autenticado (PlayerA) NÃO pode criar user_streaks de PlayerC", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`user_streaks/${UID_PLAYER_C}`).set({ user_id: UID_PLAYER_C, current_streak: 1 })
    );
  });

  it("Admin pode criar user_streaks", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("user_streaks/novo-admin").set({ user_id: "novo-admin", current_streak: 1 })
    );
  });
});

describe("user_streaks — atualização", () => {
  it("Não-autenticado NÃO pode atualizar user_streaks", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).update({ current_streak: 99 }));
  });

  it("Dono (PlayerA) NÃO pode atualizar o próprio user_streaks", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).update({ current_streak: 99 }));
  });

  it("Outro autenticado (PlayerC) NÃO pode atualizar user_streaks de PlayerA", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).update({ current_streak: 99 }));
  });

  it("Admin pode atualizar user_streaks", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`user_streaks/${STREAK_A}`).update({ current_streak: 4 }));
  });
});

describe("user_streaks — exclusão", () => {
  it("Não-autenticado NÃO pode excluir user_streaks", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).delete());
  });

  it("Dono (PlayerA) NÃO pode excluir o próprio user_streaks", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).delete());
  });

  it("Outro autenticado (PlayerC) NÃO pode excluir user_streaks de PlayerA", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).delete());
  });

  it("HOJE NEGA (ver DIAGNOSTICO): Admin NÃO pode excluir user_streaks (rule não tem allow delete)", async () => {
    // Admin cria e atualiza, mas não apaga: assimetria sem comentário na rule.
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`user_streaks/${STREAK_A}`).delete());
  });
});
