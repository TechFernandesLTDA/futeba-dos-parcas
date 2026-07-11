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

const GAME_ID = "ps-game-001";
const OWNED_PIVOT_GAME = "ps-game-owned-pivot";
const FOREIGN_GAME = "ps-game-foreign";
const STAT_PLAYER_B = "ps-player-b-stats";
const FOREIGN_STAT = "ps-foreign-stats";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo Player Stats",
    owner_id: UID_PLAYER_A,
    status: "FINISHED",
    date_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 2,
    goalkeepers_count: 0,
    team1_score: 3,
    team2_score: 1,
    group_id: null,
    co_organizers: [],
  });

  await seedDoc(testEnv, `player_stats/${STAT_PLAYER_B}`, {
    game_id: GAME_ID,
    player_id: UID_PLAYER_B,
    goals: 2,
    assists: 1,
    saves: 0,
    yellow_cards: 0,
    red_cards: 0,
  });

  await seedDoc(testEnv, `games/${OWNED_PIVOT_GAME}`, {
    owner_id: UID_PLAYER_A,
    status: "FINISHED",
  });
  await seedDoc(testEnv, `games/${FOREIGN_GAME}`, {
    owner_id: UID_PLAYER_B,
    status: "FINISHED",
  });
  await seedDoc(testEnv, `player_stats/${FOREIGN_STAT}`, {
    game_id: FOREIGN_GAME,
    player_id: UID_PLAYER_C,
    goals: 0,
    assists: 0,
    saves: 0,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("player_stats — create", () => {
  it("Game owner pode criar player_stats no seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`player_stats/ps-create-owner`).set({
        game_id: GAME_ID,
        player_id: UID_PLAYER_C,
        goals: 1,
        assists: 0,
        saves: 0,
      })
    );
  });

  it("Admin pode criar player_stats para qualquer jogo", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`player_stats/ps-create-admin`).set({
        game_id: GAME_ID,
        player_id: UID_PLAYER_B,
        goals: 2,
        assists: 1,
        saves: 0,
      })
    );
  });

  it("Player NAO pode criar player_stats (apenas owner/admin)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`player_stats/ps-create-player`).set({
        game_id: GAME_ID,
        player_id: UID_PLAYER_B,
        goals: 1,
        assists: 0,
        saves: 0,
      })
    );
  });

  it("Game owner NAO pode criar stats com goals acima de 100", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`player_stats/ps-exploit-goals`).set({
        game_id: GAME_ID,
        player_id: UID_PLAYER_C,
        goals: 999,
        assists: 0,
        saves: 0,
      })
    );
  });

  it("Nao-autenticado NAO pode criar player_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`player_stats/ps-anon`).set({
        game_id: GAME_ID,
        player_id: "anon",
        goals: 0,
        assists: 0,
        saves: 0,
      })
    );
  });
});

describe("player_stats — read", () => {
  it("Player autenticado pode ler player_stats", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`player_stats/${STAT_PLAYER_B}`).get());
  });

  it("Admin pode ler player_stats", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`player_stats/${STAT_PLAYER_B}`).get());
  });

  it("Nao-autenticado NAO pode ler player_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`player_stats/${STAT_PLAYER_B}`).get());
  });
});

describe("player_stats — update", () => {
  it("Game owner pode atualizar player_stats do seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`player_stats/${STAT_PLAYER_B}`).update({
        goals: 3,
      })
    );
  });

  it("Admin pode atualizar qualquer player_stats", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`player_stats/${STAT_PLAYER_B}`).update({
        assists: 2,
      })
    );
  });

  it("Game owner NAO pode alterar game_id (fieldUnchanged)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`player_stats/${STAT_PLAYER_B}`).update({
        game_id: "other-game",
      })
    );
  });

  it("Owner de outro jogo NAO pode pivotar game_id para assumir stat alheio", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`player_stats/${FOREIGN_STAT}`).update({
        game_id: OWNED_PIVOT_GAME,
        goals: 10,
      })
    );
  });

  it("Game owner NAO pode trocar player_id da estatistica", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`player_stats/${STAT_PLAYER_B}`).update({
        player_id: UID_PLAYER_C,
      })
    );
  });

  it("Nao-owner NAO pode atualizar player_stats", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`player_stats/${STAT_PLAYER_B}`).update({
        goals: 10,
      })
    );
  });
});

describe("player_stats — delete", () => {
  it("Game owner pode deletar player_stats do seu jogo", async () => {
    await seedDoc(testEnv, `player_stats/ps-del-owner`, {
      game_id: GAME_ID,
      player_id: UID_PLAYER_C,
      goals: 0,
      assists: 0,
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`player_stats/ps-del-owner`).delete());
  });

  it("Admin pode deletar qualquer player_stats", async () => {
    await seedDoc(testEnv, `player_stats/ps-del-admin`, {
      game_id: GAME_ID,
      player_id: UID_PLAYER_C,
      goals: 1,
      assists: 0,
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`player_stats/ps-del-admin`).delete());
  });

  it("Nao-owner NAO pode deletar player_stats", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`player_stats/${STAT_PLAYER_B}`).delete());
  });

  it("Nao-autenticado NAO pode deletar player_stats", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`player_stats/${STAT_PLAYER_B}`).delete());
  });
});
