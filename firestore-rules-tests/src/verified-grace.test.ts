import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  asUser,
  seedDoc,
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const UID_UNVERIFIED_GAME_OWNER = "uid-unverified-001";
const GROUP_UNVERIFIED_QUALIFIED = "grace-group-unverified-qualified";
const GROUP_PLAYER_A_QUALIFIED = "grace-group-player-a-qualified";

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `groups/${GROUP_UNVERIFIED_QUALIFIED}`, {
    name: "Grupo Grace Unverified",
    owner_id: UID_UNVERIFIED_GAME_OWNER,
    status: "ACTIVE",
    member_count: 5,
  });
  await seedDoc(testEnv, `groups/${GROUP_PLAYER_A_QUALIFIED}`, {
    name: "Grupo Grace Player A",
    owner_id: UID_PLAYER_A,
    status: "ACTIVE",
    member_count: 5,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("verified grace period — isVerifiedOrGrace() enforcement", () => {
  // FIX #3922: a grace period foi estendida para 2026-10-03 UTC. A fonte
  // única da data está em functions/src/auth/verification-grace.ts, validada
  // por scripts/check-verification-grace-parity.js. Quando a grace expirar,
  // este teste vai falhar (assertSucceeds vira failure) — esse é o sinal
  // para decidir aplicar o enforcement ou estender novamente.
  it("Usuario nao verificado com perfil completo pode criar game (a criacao exige profileComplete, nao verified)", async () => {
    const unverifiedDb = asUser(testEnv, UID_UNVERIFIED_GAME_OWNER, {
      role: "PLAYER",
      verified: false,
      profileComplete: true,
    });
    await assertSucceeds(
      unverifiedDb.doc("games/game-unverified").set({
        title: "Jogo Unverified",
        owner_id: UID_UNVERIFIED_GAME_OWNER,
        status: "SCHEDULED",
        visibility: "GROUP_ONLY", // FIX #4126
        date_time: FUTURE_DATE,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_UNVERIFIED_QUALIFIED,
        co_organizers: [],
      })
    );
  });

  it("Usuario nao verificado NAO pode criar confirmacao (alem da grace)", async () => {
    await seedDoc(testEnv, `games/grace-game-confirm`, {
      title: "Grace Confirm Test",
      owner_id: UID_PLAYER_A,
      status: "SCHEDULED",
      visibility: "GROUP_ONLY", // FIX #4126
      date_time: FUTURE_DATE,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 0,
      goalkeepers_count: 0,
      team1_score: null,
      team2_score: null,
      group_id: null,
      co_organizers: [],
    });
    const unverifiedDb = asUser(testEnv, "uid-unverified-002", {
      role: "PLAYER",
      verified: false,
      profileComplete: true,
    });
    await assertFails(
      unverifiedDb.doc(`confirmations/grace-game-confirm_uid-unverified-002`).set({
        game_id: "grace-game-confirm",
        user_id: "uid-unverified-002",
        status: "CONFIRMED",
        is_on_the_way: false,
        eta_minutes: null,
        created_at: new Date(),
      })
    );
  });

  it("Usuario nao verificado NAO pode criar game_event direto; deve usar Cloud Function", async () => {
    await seedDoc(testEnv, `games/grace-game-event`, {
      title: "Grace Event Test",
      owner_id: UID_PLAYER_A,
      status: "LIVE",
      date_time: new Date(),
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 2,
      goalkeepers_count: 0,
      team1_score: 0,
      team2_score: 0,
      group_id: null,
      co_organizers: [],
    });
    await seedDoc(testEnv, `confirmations/grace-game-event_uid-unverified-003`, {
      game_id: "grace-game-event",
      user_id: "uid-unverified-003",
      status: "CONFIRMED",
    });
    const unverifiedDb = asUser(testEnv, "uid-unverified-003", {
      role: "PLAYER",
      verified: false,
      profileComplete: true,
    });
    await assertFails(
      unverifiedDb.doc(`game_events/ge-grace-unverified`).set({
        game_id: "grace-game-event",
        type: "GOAL",
        created_by: "uid-unverified-003",
        player_id: "uid-unverified-003",
        minute: 10,
        created_at: new Date(),
      })
    );
  });

  it("Usuario nao verificado NAO pode criar MVP vote direto; deve usar Cloud Function", async () => {
    await seedDoc(testEnv, `games/grace-game-mvp`, {
      title: "Grace MVP Test",
      owner_id: UID_PLAYER_A,
      status: "FINISHED",
      date_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 2,
      goalkeepers_count: 0,
      team1_score: 2,
      team2_score: 1,
      group_id: null,
      co_organizers: [],
    });
    await seedDoc(testEnv, `confirmations/grace-game-mvp_uid-unverified-004`, {
      game_id: "grace-game-mvp",
      user_id: "uid-unverified-004",
      status: "CONFIRMED",
    });
    await seedDoc(testEnv, `confirmations/grace-game-mvp_${UID_PLAYER_A}`, {
      game_id: "grace-game-mvp",
      user_id: UID_PLAYER_A,
      status: "CONFIRMED",
    });
    const unverifiedDb = asUser(testEnv, "uid-unverified-004", {
      role: "PLAYER",
      verified: false,
      profileComplete: true,
    });
    await assertFails(
      unverifiedDb.doc(`mvp_votes/vote-grace-unverified`).set({
        game_id: "grace-game-mvp",
        voter_id: "uid-unverified-004",
        mvp_id: UID_PLAYER_A,
        best_gk_id: null,
        worst_player_id: null,
        created_at: new Date(),
      })
    );
  });

  it("Usuario verificado pode criar game (controle positivo)", async () => {
    const verifiedDb = asPlayerA(testEnv);
    await assertSucceeds(
      verifiedDb.doc("games/game-verified-positive").set({
        title: "Jogo Verificado",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        visibility: "GROUP_ONLY", // FIX #4126
        date_time: FUTURE_DATE,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_PLAYER_A_QUALIFIED,
        co_organizers: [],
      })
    );
  });

  it("Admin nao verificado ainda pode criar (isAdmin bypass)", async () => {
    const adminUnverified = asUser(testEnv, "uid-admin-unverified", {
      role: "ADMIN",
      verified: false,
      profileComplete: true,
    });
    await assertSucceeds(
      adminUnverified.doc("games/game-admin-unverified").set({
        title: "Admin Jogo",
        owner_id: "uid-admin-unverified",
        status: "SCHEDULED",
        visibility: "GROUP_ONLY", // FIX #4126
        date_time: FUTURE_DATE,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: null,
        co_organizers: [],
      })
    );
  });
});
