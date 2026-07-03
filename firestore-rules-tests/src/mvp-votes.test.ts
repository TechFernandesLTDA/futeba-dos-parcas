/**
 * Testes de Firestore Security Rules — Coleção: mvp_votes/{voteId}
 *
 * Cobre:
 * - get: voter_id == self OU admin OU game owner OU confirmed player
 * - list: admin OU game owner OU confirmed player (sem branch voter_id)
 * - create: isVerifiedOrGrace + confirmed player + voter_id == self + mvp_id != self
 *           + mvp_id deve ser confirmed + best_gk_id/worst_player_id validados
 * - create: não-confirmado negado
 * - update/delete: apenas admin (não é false — admin pode corrigir fraudes)
 * - update/delete: voter (dono do voto) NÃO pode alterar/deletar
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
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GAME_ID = "game-mvp-001";
const VOTE_PLAYER_B = `vote-${UID_PLAYER_B}`;

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Jogo de referência (owner = player A)
  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo MVP Test",
    owner_id: UID_PLAYER_A,
    status: "FINISHED",
    date_time: new Date(),
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 2,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    group_id: null,
    co_organizers: [],
  });

  // player B confirmado no jogo (voter)
  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_B}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_B,
    status: "CONFIRMED",
    created_at: new Date(),
  });

  // player A confirmado no jogo (candidato a mvp_id — é o owner e também confirmado)
  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_A}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
    created_at: new Date(),
  });

  // voto existente de player B (para testes de update/delete)
  await seedDoc(testEnv, `mvp_votes/${VOTE_PLAYER_B}`, {
    game_id: GAME_ID,
    voter_id: UID_PLAYER_B,
    mvp_id: UID_PLAYER_A,
    best_gk_id: null,
    worst_player_id: null,
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA (get) — mvp_votes
// ============================================================

describe("mvp_votes — get (leitura individual)", () => {
  it("Voter pode ler seu próprio voto (voter_id == userId)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).get());
  });

  it("Admin pode ler qualquer voto", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).get());
  });

  it("Game owner pode ler votos do próprio jogo", async () => {
    // player A é owner do jogo — pode fazer get
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).get());
  });

  it("Confirmed player pode ler votos do jogo em que está confirmado", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).get());
  });

  it("Não-confirmado (player C) NÃO pode ler votos de um jogo alheio", async () => {
    // player C não está confirmado no jogo e não é admin nem owner
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).get());
  });

  it("Não-autenticado NÃO pode ler votos", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).get());
  });
});

// ============================================================
// CRIAÇÃO — mvp_votes
// ============================================================

describe("mvp_votes — create", () => {
  it("Cliente NAO pode criar voto direto; deve usar Cloud Function", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`mvp_votes/vote-create-test-b`).set({
        game_id: GAME_ID,
        voter_id: UID_PLAYER_B,
        mvp_id: UID_PLAYER_A,
        best_gk_id: null,
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });

  it("Voter NÃO pode votar em si mesmo como MVP", async () => {
    // Rule: request.resource.data.mvp_id != userId()
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`mvp_votes/vote-self-mvp`).set({
        game_id: GAME_ID,
        voter_id: UID_PLAYER_B,
        mvp_id: UID_PLAYER_B, // auto-voto: negado
        best_gk_id: null,
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });

  it("voter_id diferente de userId() é rejeitado", async () => {
    // Rule: voter_id == userId()
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`mvp_votes/vote-fake-voter`).set({
        game_id: GAME_ID,
        voter_id: UID_PLAYER_A, // tenta se passar por player A
        mvp_id: UID_PLAYER_A,
        best_gk_id: null,
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });

  it("Não-confirmado (player C) NÃO pode criar voto", async () => {
    // Rule: isConfirmedPlayer(game_id) — player C não está confirmado
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`mvp_votes/vote-unconfirmed`).set({
        game_id: GAME_ID,
        voter_id: UID_PLAYER_C,
        mvp_id: UID_PLAYER_A,
        best_gk_id: null,
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });

  it("mvp_id de player não-confirmado é rejeitado", async () => {
    // Rule: isConfirmedUserForGame(game_id, mvp_id) — player C não confirmado
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`mvp_votes/vote-unconfirmed-mvp`).set({
        game_id: GAME_ID,
        voter_id: UID_PLAYER_B,
        mvp_id: UID_PLAYER_C, // player C não está confirmado
        best_gk_id: null,
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });

  it("best_gk_id de player não-confirmado é rejeitado", async () => {
    // Rule: best_gk_id != null → isConfirmedUserForGame(game_id, best_gk_id)
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`mvp_votes/vote-bad-gk`).set({
        game_id: GAME_ID,
        voter_id: UID_PLAYER_B,
        mvp_id: UID_PLAYER_A,
        best_gk_id: UID_PLAYER_C, // player C não está confirmado
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar voto", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`mvp_votes/vote-anon`).set({
        game_id: GAME_ID,
        voter_id: "anon",
        mvp_id: UID_PLAYER_A,
        best_gk_id: null,
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });
});

// ============================================================
// UPDATE / DELETE — mvp_votes
// ============================================================

describe("mvp_votes — update/delete (apenas admin)", () => {
  it("Admin pode atualizar voto (correção de fraude)", async () => {
    // Rule: allow update, delete: if isAdmin();
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`mvp_votes/${VOTE_PLAYER_B}`).update({
        mvp_id: UID_PLAYER_A,
      })
    );
  });

  it("Admin pode deletar voto (remoção de fraude)", async () => {
    await seedDoc(testEnv, `mvp_votes/vote-admin-delete-target`, {
      game_id: GAME_ID,
      voter_id: UID_PLAYER_B,
      mvp_id: UID_PLAYER_A,
      best_gk_id: null,
      worst_player_id: null,
      created_at: new Date(),
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`mvp_votes/vote-admin-delete-target`).delete()
    );
  });

  it("Voter (dono do voto) NÃO pode atualizar próprio voto", async () => {
    // Rule: update exige isAdmin() — voter não é admin
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`mvp_votes/${VOTE_PLAYER_B}`).update({
        mvp_id: UID_PLAYER_A,
      })
    );
  });

  it("Voter NÃO pode deletar próprio voto (imutável para não-admin)", async () => {
    // Rule: delete exige isAdmin()
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).delete());
  });

  it("Game owner NÃO pode deletar voto (sem ser admin)", async () => {
    // player A é owner do jogo mas não é ADMIN
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`mvp_votes/${VOTE_PLAYER_B}`).delete());
  });
});
