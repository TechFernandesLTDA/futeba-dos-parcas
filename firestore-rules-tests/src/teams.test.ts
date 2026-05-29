import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
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

const GAME_ID = "teams-game-001";
const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo Teams Test",
    owner_id: UID_PLAYER_A,
    status: "CONFIRMED",
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
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("teams — create", () => {
  it("Game owner pode criar time no seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`teams/team-create-by-owner`).set({
        name: "Time Azul",
        game_id: GAME_ID,
        players: [],
        created_at: new Date(),
      })
    );
  });

  it("Admin pode criar time em qualquer jogo", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`teams/team-create-by-admin`).set({
        name: "Time Admin",
        game_id: GAME_ID,
        players: [],
        created_at: new Date(),
      })
    );
  });

  it("Nao-owner NAO pode criar time no jogo", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`teams/team-create-unauth`).set({
        name: "Time Invasor",
        game_id: GAME_ID,
        players: [],
        created_at: new Date(),
      })
    );
  });

  it("Nao-autenticado NAO pode criar time", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`teams/team-anon`).set({
        name: "Time Anon",
        game_id: GAME_ID,
        players: [],
        created_at: new Date(),
      })
    );
  });
});

describe("teams — read", () => {
  it("Player autenticado pode ler times", async () => {
    await seedDoc(testEnv, `teams/team-readable`, {
      name: "Time Leitura",
      game_id: GAME_ID,
      players: [UID_PLAYER_A],
    });
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`teams/team-readable`).get());
  });

  it("Admin pode ler times", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`teams/team-readable`).get());
  });

  it("Nao-autenticado NAO pode ler times", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`teams/team-readable`).get());
  });
});

describe("teams — update", () => {
  beforeEach(async () => {
    await seedDoc(testEnv, `teams/team-update-target`, {
      name: "Time Original",
      game_id: GAME_ID,
      players: [UID_PLAYER_B],
    });
  });

  it("Game owner pode atualizar time do seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`teams/team-update-target`).update({
        name: "Time Atualizado",
      })
    );
  });

  it("Game owner NAO pode alterar game_id (anti-pivot #860)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`teams/team-update-target`).update({
        game_id: "other-game-id",
      })
    );
  });

  it("Admin pode atualizar qualquer time", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`teams/team-update-target`).update({
        name: "Time Admin Edit",
      })
    );
  });

  it("Nao-owner NAO pode atualizar time", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`teams/team-update-target`).update({
        name: "Time Hack",
      })
    );
  });
});

describe("teams — delete", () => {
  it("Game owner pode deletar time do seu jogo", async () => {
    await seedDoc(testEnv, `teams/team-del-owner`, {
      name: "Time Del",
      game_id: GAME_ID,
      players: [],
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`teams/team-del-owner`).delete());
  });

  it("Admin pode deletar qualquer time", async () => {
    await seedDoc(testEnv, `teams/team-del-admin`, {
      name: "Time Del Admin",
      game_id: GAME_ID,
      players: [],
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`teams/team-del-admin`).delete());
  });

  it("Nao-owner NAO pode deletar time", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`teams/team-del-owner`).delete());
  });

  it("Nao-autenticado NAO pode deletar time", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`teams/team-del-admin`).delete());
  });
});
