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

const GAME_ID = "gs-game-001";
const SUMMON_PLAYER_B = "gs-summon-b";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo Summons Test",
    owner_id: UID_PLAYER_A,
    status: "SCHEDULED",
    date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 8,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    group_id: null,
    co_organizers: [],
  });

  await seedDoc(testEnv, `game_summons/${SUMMON_PLAYER_B}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_B,
    summoned_by: UID_PLAYER_A,
    status: "PENDING",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("game_summons — create", () => {
  it("Player pode summon outro com summoned_by proprio", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`game_summons/gs-create-valid`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_C,
        summoned_by: UID_PLAYER_A,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode summon para jogo que nao possui", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_summons/gs-non-owner`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_C,
        summoned_by: UID_PLAYER_B,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Admin pode summon para jogo existente", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`game_summons/gs-create-admin`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_C,
        summoned_by: UID_ADMIN,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode summon com summoned_by de outro usuario", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_summons/gs-fake-summoner`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_C,
        summoned_by: UID_PLAYER_A,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode summon si mesmo (user_id == summoned_by)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`game_summons/gs-self-summon`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_A,
        summoned_by: UID_PLAYER_A,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode summon para jogo inexistente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`game_summons/gs-nonexistent-game`).set({
        game_id: "non-existent-game",
        user_id: UID_PLAYER_C,
        summoned_by: UID_PLAYER_A,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Nao-autenticado NAO pode criar summon", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`game_summons/gs-anon`).set({
        game_id: GAME_ID,
        user_id: "anon",
        summoned_by: "anon",
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });
});

describe("game_summons — read", () => {
  it("Summoned user pode ler seu proprio summon", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`game_summons/${SUMMON_PLAYER_B}`).get());
  });

  it("Summoner pode ler summon que criou", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`game_summons/${SUMMON_PLAYER_B}`).get());
  });

  it("Admin pode ler qualquer summon", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`game_summons/${SUMMON_PLAYER_B}`).get());
  });

  it("Player NAO envolvido NAO pode ler summon alheio", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`game_summons/${SUMMON_PLAYER_B}`).get());
  });

  it("Nao-autenticado NAO pode ler summon", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`game_summons/${SUMMON_PLAYER_B}`).get());
  });
});

describe("game_summons — update", () => {
  it("Summoned user pode atualizar status para ACCEPTED", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`game_summons/${SUMMON_PLAYER_B}`).update({
        status: "ACCEPTED",
        updated_at: new Date(),
      })
    );
  });

  it("Summoned user pode atualizar status para DECLINED", async () => {
    await seedDoc(testEnv, `game_summons/gs-update-decline`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      summoned_by: UID_PLAYER_A,
      status: "PENDING",
    });
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`game_summons/gs-update-decline`).update({
        status: "DECLINED",
        updated_at: new Date(),
      })
    );
  });

  it("Summoned user NAO pode alterar summoned_by", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_summons/${SUMMON_PLAYER_B}`).update({
        summoned_by: UID_PLAYER_B,
        updated_at: new Date(),
      })
    );
  });

  it("Summoned user NAO pode alterar game_id", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_summons/${SUMMON_PLAYER_B}`).update({
        game_id: "other-game",
        updated_at: new Date(),
      })
    );
  });

  it("Admin pode atualizar qualquer summon", async () => {
    await seedDoc(testEnv, `game_summons/gs-update-admin`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      summoned_by: UID_PLAYER_A,
      status: "PENDING",
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`game_summons/gs-update-admin`).update({
        status: "CANCELLED",
        updated_at: new Date(),
      })
    );
  });

  it("Summoner NAO pode atualizar summon (apenas destinatario)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`game_summons/${SUMMON_PLAYER_B}`).update({
        status: "CANCELLED",
        updated_at: new Date(),
      })
    );
  });
});

describe("game_summons — delete", () => {
  it("Summoner pode deletar summon proprio", async () => {
    await seedDoc(testEnv, `game_summons/gs-del-summoner`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      summoned_by: UID_PLAYER_A,
      status: "PENDING",
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`game_summons/gs-del-summoner`).delete());
  });

  it("Admin pode deletar qualquer summon", async () => {
    await seedDoc(testEnv, `game_summons/gs-del-admin`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      summoned_by: UID_PLAYER_A,
      status: "PENDING",
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`game_summons/gs-del-admin`).delete());
  });

  it("Summoned user NAO pode deletar summon", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`game_summons/${SUMMON_PLAYER_B}`).delete());
  });

  it("Nao-envolvido NAO pode deletar summon", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`game_summons/${SUMMON_PLAYER_B}`).delete());
  });
});
