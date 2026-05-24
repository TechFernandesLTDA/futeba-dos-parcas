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
  asFieldOwner,
  UID_ADMIN,
  UID_FIELD_OWNER,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GAME_ID = "greq-game-001";
const REQUEST_PLAYER_C = "greq-pc-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo Game Requests",
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

  await seedDoc(testEnv, `game_requests/${REQUEST_PLAYER_C}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_C,
    status: "PENDING",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("game_requests — create", () => {
  it("Player pode criar request com requester_id proprio e status PENDING", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`game_requests/greq-create-b`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_B,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode criar request com user_id de outro", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_requests/greq-fake-user`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_A,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Player NAO pode criar request sem campos obrigatorios", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_requests/greq-missing-fields`).set({
        user_id: UID_PLAYER_B,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Game owner NAO pode criar request para outro (player comum)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`game_requests/greq-owner-creates`).set({
        game_id: GAME_ID,
        user_id: UID_PLAYER_B,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Nao-autenticado NAO pode criar request", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`game_requests/greq-anon`).set({
        game_id: GAME_ID,
        user_id: "anon",
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });
});

describe("game_requests — read", () => {
  it("Requester pode ler seu proprio request", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`game_requests/${REQUEST_PLAYER_C}`).get());
  });

  it("Game owner pode ler requests do seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`game_requests/${REQUEST_PLAYER_C}`).get());
  });

  it("Admin pode ler qualquer request", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`game_requests/${REQUEST_PLAYER_C}`).get());
  });

  it("Player NAO envolvido NAO pode ler request alheio", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`game_requests/${REQUEST_PLAYER_C}`).get());
  });

  it("Nao-autenticado NAO pode ler request", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`game_requests/${REQUEST_PLAYER_C}`).get());
  });
});

describe("game_requests — update (aprovacao/rejeicao)", () => {
  it("Game owner pode aprovar request (status APPROVED)", async () => {
    await seedDoc(testEnv, `game_requests/greq-update-approve`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      status: "PENDING",
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`game_requests/greq-update-approve`).update({
        status: "APPROVED",
        reviewed_by: UID_PLAYER_A,
        reviewed_at: new Date(),
      })
    );
  });

  it("Game owner pode rejeitar request (status REJECTED)", async () => {
    await seedDoc(testEnv, `game_requests/greq-update-reject`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      status: "PENDING",
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`game_requests/greq-update-reject`).update({
        status: "REJECTED",
        reviewed_by: UID_PLAYER_A,
        reviewed_at: new Date(),
        rejection_reason: "Lotado",
      })
    );
  });

  it("Game owner NAO pode alterar user_id da request", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`game_requests/${REQUEST_PLAYER_C}`).update({
        user_id: UID_PLAYER_B,
      })
    );
  });

  it("Nao-owner NAO pode atualizar request", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`game_requests/${REQUEST_PLAYER_C}`).update({
        status: "APPROVED",
      })
    );
  });

  it("Requester NAO pode auto-aprovar propria request", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`game_requests/${REQUEST_PLAYER_C}`).update({
        status: "APPROVED",
      })
    );
  });
});

describe("game_requests — delete", () => {
  it("Requester pode cancelar propria request (delete)", async () => {
    await seedDoc(testEnv, `game_requests/greq-del-self`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_C,
      status: "PENDING",
    });
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`game_requests/greq-del-self`).delete());
  });

  it("Game owner pode deletar request do seu jogo", async () => {
    await seedDoc(testEnv, `game_requests/greq-del-owner`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      status: "PENDING",
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`game_requests/greq-del-owner`).delete());
  });

  it("Admin pode deletar qualquer request", async () => {
    await seedDoc(testEnv, `game_requests/greq-del-admin`, {
      game_id: GAME_ID,
      user_id: UID_PLAYER_B,
      status: "PENDING",
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`game_requests/greq-del-admin`).delete());
  });

  it("Nao-owner nao-requester NAO pode deletar request", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`game_requests/${REQUEST_PLAYER_C}`).delete());
  });
});
