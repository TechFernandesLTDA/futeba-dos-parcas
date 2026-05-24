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

const GAME_ACTIVE = "conf-game-active";
const GAME_FINISHED = "conf-game-finished";
const GAME_NONEXISTENT = "conf-game-nonexistent";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ACTIVE}`, {
    title: "Jogo Ativo Confirmations",
    owner_id: UID_PLAYER_A,
    status: "CONFIRMED",
    date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 0,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    group_id: null,
    co_organizers: [],
  });

  await seedDoc(testEnv, `games/${GAME_FINISHED}`, {
    title: "Jogo Finished",
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

  await seedDoc(testEnv, `confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`, {
    game_id: GAME_ACTIVE,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
    is_on_the_way: false,
    eta_minutes: null,
    is_mvp: false,
    is_best_gk: false,
    is_worst_player: false,
    was_present: false,
    goals: null,
    team: null,
    created_at: new Date(),
  });

  await seedDoc(testEnv, `confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`, {
    game_id: GAME_FINISHED,
    user_id: UID_PLAYER_B,
    status: "CONFIRMED",
    is_on_the_way: false,
    eta_minutes: null,
    is_mvp: false,
    is_best_gk: false,
    is_worst_player: false,
    was_present: true,
    goals: 2,
    team: "team1",
    created_at: new Date(),
  });

  await seedDoc(testEnv, `confirmations/${GAME_FINISHED}_${UID_PLAYER_A}`, {
    game_id: GAME_FINISHED,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
    is_on_the_way: false,
    eta_minutes: null,
    is_mvp: false,
    is_best_gk: false,
    is_worst_player: false,
    was_present: true,
    goals: 1,
    team: "team2",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("confirmations — create (auto-confirmacao)", () => {
  it("Player pode se auto-confirmar em jogo ativo", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_B}`).set({
        game_id: GAME_ACTIVE,
        user_id: UID_PLAYER_B,
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode criar confirmacao com user_id de outro usuario", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_C}`).set({
        game_id: GAME_ACTIVE,
        user_id: UID_PLAYER_C,
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode confirmar em jogo inexistente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_NONEXISTENT}_${UID_PLAYER_A}`).set({
        game_id: GAME_NONEXISTENT,
        user_id: UID_PLAYER_A,
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode criar confirmacao com ID fora do padrao gameId_userId", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`confirmations/wrong-id-format`).set({
        game_id: GAME_ACTIVE,
        user_id: UID_PLAYER_B,
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Nao-autenticado NAO pode criar confirmacao", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_ACTIVE}_anon`).set({
        game_id: GAME_ACTIVE,
        user_id: "anon",
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });
});

describe("confirmations — create (summon pelo game owner)", () => {
  it("Game owner pode summon (criar confirmacao com user_id de outro)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_C}`).set({
        game_id: GAME_ACTIVE,
        user_id: UID_PLAYER_C,
        status: "PENDING",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Game owner NAO pode summon com status diferente de PENDING", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_ACTIVE}_summon-fail`).set({
        game_id: GAME_ACTIVE,
        user_id: UID_PLAYER_B,
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Nao-owner NAO pode summon outro jogador", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_ACTIVE}_summon-unauth`).set({
        game_id: GAME_ACTIVE,
        user_id: UID_PLAYER_C,
        status: "PENDING",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Admin pode criar confirmacao para qualquer usuario", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_ACTIVE}_admin-create`).set({
        game_id: GAME_ACTIVE,
        user_id: UID_PLAYER_B,
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });
});

describe("confirmations — read", () => {
  it("Player pode ler propria confirmacao", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).get());
  });

  it("Game owner pode ler confirmacoes do seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).get());
  });

  it("Confirmed player pode ler confirmacoes do jogo", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_A}`).get());
  });

  it("Player NAO pode ler confirmacao alheia de outro jogo", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).get());
  });

  it("Nao-autenticado NAO pode ler confirmacao", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).get());
  });

  it("Admin pode ler qualquer confirmacao", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).get());
  });
});

describe("confirmations — update (ETA pelo proprio jogador)", () => {
  it("Jogador confirmado pode atualizar proprio ETA", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).update({
        is_on_the_way: true,
        eta_minutes: 15,
        on_the_way_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("Jogador NAO pode alterar user_id pelo self-update", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).update({
        user_id: UID_PLAYER_B,
        updated_at: new Date(),
      })
    );
  });

  it("Jogador NAO pode alterar game_id pelo self-update", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).update({
        game_id: GAME_NONEXISTENT,
        updated_at: new Date(),
      })
    );
  });

  it("Jogador NAO pode atualizar goals pelo self-update (campo de stats)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        goals: 5,
        updated_at: new Date(),
      })
    );
  });
});

describe("confirmations — update (game owner stats)", () => {
  it("Game owner pode atualizar stats em jogo FINISHED", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        goals: 3,
        assists: 1,
        was_present: true,
        updated_at: new Date(),
      })
    );
  });

  it("Game owner pode atualizar status da confirmacao", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        status: "CONFIRMED",
        updated_at: new Date(),
      })
    );
  });

  it("Game owner NAO pode alterar user_id (fieldUnchanged)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        user_id: UID_PLAYER_C,
        updated_at: new Date(),
      })
    );
  });

  it("Nao-owner NAO pode atualizar stats de outro jogador", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_A}`).update({
        goals: 5,
        updated_at: new Date(),
      })
    );
  });
});

describe("confirmations — update (voto MVP flags)", () => {
  it("Confirmed player pode votar MVP (is_mvp)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        is_mvp: true,
      })
    );
  });

  it("Confirmed player pode votar best GK (is_best_gk)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        is_best_gk: true,
      })
    );
  });

  it("Confirmed player pode votar worst player (is_worst_player)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        is_worst_player: true,
      })
    );
  });

  it("Nao-confirmado NAO pode atualizar flags de MVP", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        is_mvp: true,
      })
    );
  });

  it("Confirmed player NAO pode atualizar status (fora do whitelist MVP)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_B}`).update({
        status: "CANCELLED",
      })
    );
  });
});

describe("confirmations — delete", () => {
  it("Admin pode deletar qualquer confirmacao", async () => {
    await seedDoc(testEnv, `confirmations/${GAME_ACTIVE}_del-admin`, {
      game_id: GAME_ACTIVE,
      user_id: UID_PLAYER_B,
      status: "CONFIRMED",
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`confirmations/${GAME_ACTIVE}_del-admin`).delete());
  });

  it("Player pode deletar propria confirmacao", async () => {
    await seedDoc(testEnv, `confirmations/${GAME_ACTIVE}_del-self`, {
      game_id: GAME_ACTIVE,
      user_id: UID_PLAYER_C,
      status: "CONFIRMED",
    });
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`confirmations/${GAME_ACTIVE}_del-self`).delete());
  });

  it("Game owner pode deletar confirmacao de outro no seu jogo", async () => {
    await seedDoc(testEnv, `confirmations/${GAME_ACTIVE}_del-owner`, {
      game_id: GAME_ACTIVE,
      user_id: UID_PLAYER_B,
      status: "CONFIRMED",
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`confirmations/${GAME_ACTIVE}_del-owner`).delete());
  });

  it("Nao-owner nao-admin NAO pode deletar confirmacao alheia", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_FINISHED}_${UID_PLAYER_A}`).delete()
    );
  });

  it("Nao-autenticado NAO pode deletar confirmacao", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`confirmations/${GAME_ACTIVE}_${UID_PLAYER_A}`).delete()
    );
  });
});
