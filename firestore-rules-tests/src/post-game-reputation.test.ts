/**
 * Testes de Firestore Security Rules — Coleção: post_game_reputation
 *
 * Caracterização do comportamento ATUAL da rule (não é a rule ideal).
 * Ver DIAGNOSTICO para os casos marcados como HOJE PERMITE / HOJE NEGA.
 *
 * Regra real (firestore.rules, linha ~1095, #2968):
 * - read: ADMIN, OU reviewer_id == uid, OU target_user_id == uid
 * - create, update, delete: if false (escrita só pela Cloud Function
 *   submitPostGameReputation, via Admin SDK)
 *
 * O documento grava reviewer_id, reviewer_name e reviewer_photo
 * (functions/src/reputation/post-game-reputation.ts), então o alvo da
 * avaliação enxerga quem o avaliou.
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

const REP_ID = "rep-001";
const REP_PATH = `post_game_reputation/${REP_ID}`;

beforeAll(async () => {
  testEnv = await initTestEnv();

  // PlayerA avaliou PlayerB no jogo game-001
  await seedDoc(testEnv, REP_PATH, {
    game_id: "game-001",
    group_id: "group-001",
    reviewer_id: UID_PLAYER_A,
    reviewer_name: "Jogador A",
    reviewer_photo: "",
    target_user_id: UID_PLAYER_B,
    target_user_name: "Jogador B",
    rating: 4,
    created_at: new Date("2026-10-28T20:00:00Z"),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("post_game_reputation — leitura", () => {
  it("Não-autenticado NÃO pode ler post_game_reputation", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(REP_PATH).get());
  });

  it("Reviewer (PlayerA) pode ler a própria avaliação", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(REP_PATH).get());
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): Target (PlayerB) lê quem o avaliou (reviewer_id/nome)", async () => {
    // Pela rule o alvo lê o documento inteiro, incluindo reviewer_id e reviewer_name.
    // Se a avaliação deve ser anônima para o alvo, isto está errado.
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(REP_PATH).get());
  });

  it("Terceiro autenticado (PlayerC) NÃO pode ler avaliação de outros", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(REP_PATH).get());
  });

  it("Admin pode ler qualquer avaliação", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(REP_PATH).get());
  });

  it("Não-autenticado NÃO pode listar post_game_reputation", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("post_game_reputation").get());
  });

  it("Usuário NÃO pode listar sem filtro (rule exige filtro de reviewer/target para não-admin)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.collection("post_game_reputation").get());
  });

  it("Reviewer (PlayerA) pode listar com where reviewer_id == uid", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.collection("post_game_reputation").where("reviewer_id", "==", UID_PLAYER_A).get()
    );
  });

  it("Target (PlayerB) pode listar com where target_user_id == uid", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.collection("post_game_reputation").where("target_user_id", "==", UID_PLAYER_B).get()
    );
  });

  it("Terceiro (PlayerC) NÃO pode listar avaliações de PlayerA como reviewer", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.collection("post_game_reputation").where("reviewer_id", "==", UID_PLAYER_A).get()
    );
  });

  it("Admin pode listar post_game_reputation sem filtro", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.collection("post_game_reputation").get());
  });
});

describe("post_game_reputation — criação", () => {
  it("Não-autenticado NÃO pode criar avaliação", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc("post_game_reputation/novo-anon").set({ rating: 5 }));
  });

  it("Reviewer (PlayerA) NÃO pode criar avaliação pelo cliente (só Cloud Function)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("post_game_reputation/novo-reviewer").set({
        reviewer_id: UID_PLAYER_A,
        target_user_id: UID_PLAYER_C,
        rating: 5,
      })
    );
  });

  it("Outro autenticado (PlayerC) NÃO pode criar avaliação", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("post_game_reputation/novo-outro").set({
        reviewer_id: UID_PLAYER_C,
        target_user_id: UID_PLAYER_B,
        rating: 5,
      })
    );
  });

  it("Admin NÃO pode criar avaliação pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc("post_game_reputation/novo-admin").set({ rating: 5 }));
  });
});

describe("post_game_reputation — atualização", () => {
  it("Não-autenticado NÃO pode atualizar avaliação", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(REP_PATH).update({ rating: 1 }));
  });

  it("Reviewer (PlayerA) NÃO pode editar a própria avaliação", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(REP_PATH).update({ rating: 1 }));
  });

  it("Target (PlayerB) NÃO pode atualizar avaliação recebida", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(REP_PATH).update({ rating: 1 }));
  });

  it("Admin NÃO pode atualizar avaliação pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(REP_PATH).update({ rating: 1 }));
  });
});

describe("post_game_reputation — exclusão", () => {
  it("Não-autenticado NÃO pode excluir avaliação", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(REP_PATH).delete());
  });

  it("Reviewer (PlayerA) NÃO pode excluir a própria avaliação", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(REP_PATH).delete());
  });

  it("Target (PlayerB) NÃO pode excluir avaliação recebida", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(REP_PATH).delete());
  });

  it("Admin NÃO pode excluir avaliação pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(REP_PATH).delete());
  });
});
