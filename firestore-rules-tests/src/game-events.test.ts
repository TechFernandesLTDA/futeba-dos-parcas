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

const GAME_ID = "ge-game-001";
const EVENT_PLAYER_B = "ge-event-b";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo Game Events",
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

  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_A}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });

  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_B}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_B,
    status: "CONFIRMED",
  });

  await seedDoc(testEnv, `game_events/${EVENT_PLAYER_B}`, {
    game_id: GAME_ID,
    type: "GOAL",
    created_by: UID_PLAYER_B,
    player_id: UID_PLAYER_B,
    minute: 15,
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("game_events — create", () => {
  it("Confirmed player NÃO pode criar evento direto; deve usar Cloud Function", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_events/ge-create-confirmed`).set({
        game_id: GAME_ID,
        type: "GOAL",
        created_by: UID_PLAYER_B,
        player_id: UID_PLAYER_B,
        minute: 30,
        created_at: new Date(),
      })
    );
  });

  it("Game owner NÃO pode criar evento direto", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`game_events/ge-create-owner`).set({
        game_id: GAME_ID,
        type: "ASSIST",
        created_by: UID_PLAYER_A,
        player_id: UID_PLAYER_B,
        minute: 20,
        created_at: new Date(),
      })
    );
  });

  it("Admin client NÃO pode criar evento direto", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`game_events/ge-create-admin`).set({
        game_id: GAME_ID,
        type: "YELLOW_CARD",
        created_by: UID_ADMIN,
        player_id: UID_PLAYER_A,
        minute: 10,
        created_at: new Date(),
      })
    );
  });

  it("Confirmed player NAO pode criar evento com created_by de outro", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_events/ge-fake-creator`).set({
        game_id: GAME_ID,
        type: "GOAL",
        created_by: UID_PLAYER_A,
        player_id: UID_PLAYER_B,
        minute: 25,
        created_at: new Date(),
      })
    );
  });

  it("Nao-confirmado NAO pode criar evento", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`game_events/ge-unconfirmed`).set({
        game_id: GAME_ID,
        type: "GOAL",
        created_by: UID_PLAYER_C,
        player_id: UID_PLAYER_C,
        minute: 5,
        created_at: new Date(),
      })
    );
  });

  it("Nao-autenticado NAO pode criar evento", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`game_events/ge-anon`).set({
        game_id: GAME_ID,
        type: "GOAL",
        created_by: "anon",
        player_id: "anon",
        minute: 1,
        created_at: new Date(),
      })
    );
  });
});

describe("game_events — read", () => {
  it("Player sem acesso NÃO pode ler eventos privados", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`game_events/${EVENT_PLAYER_B}`).get());
  });

  it("Player confirmado pode ler eventos", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`game_events/${EVENT_PLAYER_B}`).get());
  });

  it("Admin pode ler eventos", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`game_events/${EVENT_PLAYER_B}`).get());
  });

  it("Nao-autenticado NAO pode ler eventos", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`game_events/${EVENT_PLAYER_B}`).get());
  });
});

describe("game_events — update", () => {
  it("created_by NÃO pode atualizar evento direto", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_events/${EVENT_PLAYER_B}`).update({
        minute: 16,
      })
    );
  });

  it("created_by NAO pode alterar created_by (fieldUnchanged)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_events/${EVENT_PLAYER_B}`).update({
        created_by: UID_PLAYER_A,
      })
    );
  });

  it("Game owner NÃO pode atualizar evento direto", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`game_events/${EVENT_PLAYER_B}`).update({
        minute: 22,
      })
    );
  });

  it("Admin client NÃO pode atualizar evento direto", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`game_events/${EVENT_PLAYER_B}`).update({
        minute: 45,
      })
    );
  });

  it("Nao-confirmado NAO pode atualizar evento", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`game_events/${EVENT_PLAYER_B}`).update({
        minute: 90,
      })
    );
  });
});

describe("game_events — delete", () => {
  it("Game owner NÃO pode deletar evento direto", async () => {
    await seedDoc(testEnv, `game_events/ge-del-owner`, {
      game_id: GAME_ID,
      type: "GOAL",
      created_by: UID_PLAYER_B,
      player_id: UID_PLAYER_B,
      minute: 10,
    });
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`game_events/ge-del-owner`).delete());
  });

  it("Admin client NÃO pode deletar evento direto", async () => {
    await seedDoc(testEnv, `game_events/ge-del-admin`, {
      game_id: GAME_ID,
      type: "GOAL",
      created_by: UID_PLAYER_B,
      player_id: UID_PLAYER_B,
      minute: 20,
    });
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`game_events/ge-del-admin`).delete());
  });

  it("Confirmed player NÃO pode deletar evento direto", async () => {
    await seedDoc(testEnv, `game_events/ge-del-self`, {
      game_id: GAME_ID,
      type: "ASSIST",
      created_by: UID_PLAYER_B,
      player_id: UID_PLAYER_B,
      minute: 33,
    });
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`game_events/ge-del-self`).delete());
  });

  it("Confirmed player NAO pode deletar evento de outro", async () => {
    await seedDoc(testEnv, `game_events/ge-del-other`, {
      game_id: GAME_ID,
      type: "GOAL",
      created_by: UID_PLAYER_A,
      player_id: UID_PLAYER_A,
      minute: 5,
    });
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`game_events/ge-del-other`).delete());
  });

  it("Nao-confirmado NAO pode deletar evento", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`game_events/${EVENT_PLAYER_B}`).delete());
  });

  it("Nao-autenticado NAO pode deletar evento", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`game_events/${EVENT_PLAYER_B}`).delete());
  });
});
