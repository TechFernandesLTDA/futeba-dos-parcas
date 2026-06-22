/**
 * Testes de Firestore Security Rules — Coleções de jogo ao vivo:
 *   - live_games/{gameId}
 *   - live_games/{gameId}/events/{eventId}
 *   - live_scores/{scoreId}
 *   - live_player_stats/{statId}
 *
 * Cobre:
 * - live_games: leitura para qualquer autenticado; write apenas owner ou admin
 * - live_games/events: leitura auth; create/update/delete owner/admin ou confirmed player (próprios eventos)
 * - live_scores: leitura auth; create owner_id==self ou admin; update owner/admin apenas (SECFIX #1603)
 * - live_player_stats: leitura auth; create owner/admin/confirmed player (próprias stats); update fieldUnchanged(game_id, player_id)
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

const LIVE_GAME_ID = "live-game-001";
const EVENT_EXISTING = "event-existing-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Jogo de referência (usado por isGameOwner)
  await seedDoc(testEnv, `games/${LIVE_GAME_ID}`, {
    title: "Jogo Ao Vivo",
    owner_id: UID_PLAYER_A,
    status: "LIVE",
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

  // Estado ao vivo do jogo
  await seedDoc(testEnv, `live_games/${LIVE_GAME_ID}`, {
    owner_id: UID_PLAYER_A,
    status: "LIVE",
    started_at: new Date(),
  });

  // player B confirmado no jogo
  await seedDoc(testEnv, `confirmations/${LIVE_GAME_ID}_${UID_PLAYER_B}`, {
    game_id: LIVE_GAME_ID,
    user_id: UID_PLAYER_B,
    status: "CONFIRMED",
    created_at: new Date(),
  });

  // Evento existente criado pelo game owner
  await seedDoc(
    testEnv,
    `live_games/${LIVE_GAME_ID}/events/${EVENT_EXISTING}`,
    {
      type: "GOAL",
      player_id: UID_PLAYER_B,
      created_by: UID_PLAYER_A,
      created_at: new Date(),
    }
  );

  // live_score existente para o jogo
  await seedDoc(testEnv, `live_scores/${LIVE_GAME_ID}`, {
    owner_id: UID_PLAYER_A,
    team1_score: 1,
    team2_score: 0,
    updated_at: new Date(),
  });

  // live_player_stats existente
  await seedDoc(
    testEnv,
    `live_player_stats/${LIVE_GAME_ID}_${UID_PLAYER_B}`,
    {
      game_id: LIVE_GAME_ID,
      player_id: UID_PLAYER_B,
      goals: 1,
      assists: 0,
      saves: 0,
    }
  );
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LIVE_GAMES — documento raiz
// ============================================================

describe("live_games — leitura", () => {
  it("Qualquer autenticado pode ler live_games", async () => {
    const db = asPlayerC(testEnv); // não é owner nem confirmed
    await assertSucceeds(db.doc(`live_games/${LIVE_GAME_ID}`).get());
  });

  it("Não-autenticado NÃO pode ler live_games", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`live_games/${LIVE_GAME_ID}`).get());
  });
});

describe("live_games — escrita (create/update/delete)", () => {
  it("Game owner pode criar documento live_games com owner_id == userId()", async () => {
    await seedDoc(testEnv, `games/live-game-new`, {
      title: "Novo Jogo Live",
      owner_id: UID_PLAYER_A,
      status: "CONFIRMED",
      date_time: new Date(),
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 0,
      goalkeepers_count: 0,
      team1_score: null,
      team2_score: null,
      group_id: null,
      co_organizers: [],
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`live_games/live-game-new`).set({
        owner_id: UID_PLAYER_A,
        status: "LIVE",
        started_at: new Date(),
      })
    );
  });

  it("Admin pode criar documento live_games", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`live_games/live-game-admin`).set({
        owner_id: UID_ADMIN,
        status: "LIVE",
        started_at: new Date(),
      })
    );
  });

  it("Confirmed player NÃO pode criar live_games com owner_id diferente do real dono", async () => {
    // Rule: isAdmin() || request.resource.data.owner_id == userId()
    // player B pode criar um doc com owner_id=player_B, mas não tem autoridade sobre o jogo real
    // Teste: tenta criar live_game com owner_id = player B (que não é dono do jogo)
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`live_games/live-game-b-owner-hack`).set({
        owner_id: UID_PLAYER_A, // owner_id != userId() — negado
        status: "LIVE",
        started_at: new Date(),
      })
    );
  });

  it("Game owner pode atualizar live_games", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`live_games/${LIVE_GAME_ID}`).update({
        status: "LIVE",
        updated_at: new Date(),
      })
    );
  });

  it("Confirmed player NÃO pode atualizar live_games de jogo alheio", async () => {
    // Rule: isAdmin() || resource.data.owner_id == userId()
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`live_games/${LIVE_GAME_ID}`).update({ status: "FINISHED" })
    );
  });

  it("Game owner pode deletar live_games", async () => {
    await seedDoc(testEnv, `live_games/live-game-delete`, {
      owner_id: UID_PLAYER_A,
      status: "LIVE",
      started_at: new Date(),
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`live_games/live-game-delete`).delete());
  });
});

// ============================================================
// LIVE_GAMES/EVENTS — subcoleção
// ============================================================

describe("live_games/events — leitura e escrita", () => {
  it("Qualquer autenticado pode ler eventos", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc(`live_games/${LIVE_GAME_ID}/events/${EVENT_EXISTING}`).get()
    );
  });

  it("Game owner pode criar evento", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`live_games/${LIVE_GAME_ID}/events/event-owner-create`).set({
        type: "assist",
        player_id: UID_PLAYER_B,
        created_by: UID_PLAYER_A,
        created_at: new Date(),
      })
    );
  });

  it("Confirmed player pode criar evento com created_by == self", async () => {
    // Rule: isConfirmedPlayer(gameId) && created_by == userId()
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`live_games/${LIVE_GAME_ID}/events/event-confirmed-create`).set({
        type: "goal",
        player_id: UID_PLAYER_B,
        created_by: UID_PLAYER_B,
        created_at: new Date(),
      })
    );
  });

  it("Confirmed player NÃO pode criar evento com created_by diferente de self", async () => {
    // Rule: created_by == userId()
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`live_games/${LIVE_GAME_ID}/events/event-fake-creator`).set({
        type: "GOAL",
        player_id: UID_PLAYER_B,
        created_by: UID_PLAYER_A, // não é player B
        created_at: new Date(),
      })
    );
  });

  it("Não-confirmado (player C) NÃO pode criar evento", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`live_games/${LIVE_GAME_ID}/events/event-unconfirmed`).set({
        type: "GOAL",
        player_id: UID_PLAYER_C,
        created_by: UID_PLAYER_C,
        created_at: new Date(),
      })
    );
  });

  it("Game owner pode atualizar qualquer evento", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db
        .doc(`live_games/${LIVE_GAME_ID}/events/${EVENT_EXISTING}`)
        .update({ type: "ASSIST" })
    );
  });

  it("Game owner pode deletar qualquer evento", async () => {
    await seedDoc(
      testEnv,
      `live_games/${LIVE_GAME_ID}/events/event-owner-delete`,
      {
        type: "GOAL",
        player_id: UID_PLAYER_B,
        created_by: UID_PLAYER_A,
        created_at: new Date(),
      }
    );
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`live_games/${LIVE_GAME_ID}/events/event-owner-delete`).delete()
    );
  });
});

// ============================================================
// LIVE_SCORES
// ============================================================

describe("live_scores — leitura e escrita", () => {
  it("Qualquer autenticado pode ler live_scores", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`live_scores/${LIVE_GAME_ID}`).get());
  });

  it("Não-autenticado NÃO pode ler live_scores", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`live_scores/${LIVE_GAME_ID}`).get());
  });

  it("Owner pode criar live_score com owner_id == self e placares válidos", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`live_scores/live-score-new`).set({
        owner_id: UID_PLAYER_A,
        team1_score: 0,
        team2_score: 0,
        updated_at: new Date(),
      })
    );
  });

  it("Placar com valor inválido (> 100) é rejeitado", async () => {
    // Rule: isValidScore() — limite máximo de 100
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`live_scores/live-score-invalid`).set({
        owner_id: UID_PLAYER_A,
        team1_score: 101,
        team2_score: 0,
        updated_at: new Date(),
      })
    );
  });

  it("Owner pode atualizar live_score sem alterar owner_id", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`live_scores/${LIVE_GAME_ID}`).update({
        team1_score: 2,
        team2_score: 1,
        updated_at: new Date(),
      })
    );
  });

  it("Confirmed player NÃO pode atualizar live_score (anti-fraude #1603)", async () => {
    // SECFIX #1603: isConfirmedPlayer removido da allow update — apenas admin/owner podem alterar placar
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`live_scores/${LIVE_GAME_ID}`).update({
        team1_score: 2,
        team2_score: 2,
        updated_at: new Date(),
      })
    );
  });

  it("Admin pode atualizar live_score", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`live_scores/${LIVE_GAME_ID}`).update({
        team1_score: 3,
        team2_score: 1,
        updated_at: new Date(),
      })
    );
  });
});

// ============================================================
// LIVE_PLAYER_STATS
// ============================================================

describe("live_player_stats — leitura e escrita", () => {
  it("Qualquer autenticado pode ler live_player_stats", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc(`live_player_stats/${LIVE_GAME_ID}_${UID_PLAYER_B}`).get()
    );
  });

  it("Confirmed player pode criar suas próprias stats (player_id == self)", async () => {
    // Rule: isConfirmedPlayer(game_id) && player_id == userId()
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`live_player_stats/stat-b-new`).set({
        game_id: LIVE_GAME_ID,
        player_id: UID_PLAYER_B,
        goals: 0,
        assists: 1,
        saves: 0,
      })
    );
  });

  it("Confirmed player NÃO pode criar stats de outro player", async () => {
    // Rule: player_id == userId()
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`live_player_stats/stat-b-fake`).set({
        game_id: LIVE_GAME_ID,
        player_id: UID_PLAYER_A, // tentativa de criar como player A
        goals: 10,
        assists: 0,
        saves: 0,
      })
    );
  });

  it("Confirmed player pode atualizar suas próprias stats", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db
        .doc(`live_player_stats/${LIVE_GAME_ID}_${UID_PLAYER_B}`)
        .update({ goals: 2, assists: 0, saves: 0 })
    );
  });

  it("Stats com goals > 100 rejeitado (isValidScore)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`live_player_stats/stat-overflow`).set({
        game_id: LIVE_GAME_ID,
        player_id: UID_PLAYER_B,
        goals: 999,
        assists: 0,
        saves: 0,
      })
    );
  });
});
