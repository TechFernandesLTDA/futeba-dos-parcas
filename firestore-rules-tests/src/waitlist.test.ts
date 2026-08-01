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

const GAME_ID = "wl-game-001";
const FUTURE_TIME = Date.now() + 7 * 24 * 60 * 60 * 1000;

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo Waitlist Test",
    owner_id: UID_PLAYER_A,
    status: "SCHEDULED",
    date_time: new Date(FUTURE_TIME),
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 10,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    group_id: null,
    co_organizers: [],
  });

  await seedDoc(testEnv, `games/${GAME_ID}/waitlist/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    game_id: GAME_ID,
    status: "WAITING",
    user_name: "Player B",
    queue_position: 1,
    added_at: Date.now(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("waitlist — create", () => {
  it("Player pode adicionar si mesmo a waitlist com status WAITING", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_C}`).set({
        user_id: UID_PLAYER_C,
        game_id: GAME_ID,
        status: "WAITING",
        user_name: "Player C",
        queue_position: 2,
        added_at: Date.now(),
      })
    );
  });

  it("Player NAO pode adicionar outro usuario na waitlist", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/fake-entry`).set({
        user_id: UID_PLAYER_C,
        game_id: GAME_ID,
        status: "WAITING",
        user_name: "Player C",
        queue_position: 2,
        added_at: Date.now(),
      })
    );
  });

  it("Player NAO pode criar entrada com status PROMOTED (apenas server)", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/promoted-fake`).set({
        user_id: UID_PLAYER_C,
        game_id: GAME_ID,
        status: "PROMOTED",
        user_name: "Player C",
        queue_position: 1,
        added_at: Date.now(),
      })
    );
  });

  it("Player NAO pode criar waitlist com game_id diferente do path", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/wrong-game`).set({
        user_id: UID_PLAYER_C,
        game_id: "other-game",
        status: "WAITING",
        user_name: "Player C",
        queue_position: 1,
        added_at: Date.now(),
      })
    );
  });

  it("Nao-autenticado NAO pode criar waitlist", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/anon`).set({
        user_id: "anon",
        game_id: GAME_ID,
        status: "WAITING",
        user_name: "Anon",
        queue_position: 1,
        added_at: Date.now(),
      })
    );
  });
});

describe("waitlist — read", () => {
  it("Player pode ler propria entrada na waitlist", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).get()
    );
  });

  it("Game owner pode ler todas entradas da waitlist", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).get()
    );
  });

  it("Admin pode ler qualquer entrada da waitlist", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).get()
    );
  });

  it("Qualquer usuario autenticado pode ler entradas da waitlist", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).get()
    );
  });

  it("Nao-autenticado NAO pode ler waitlist", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).get()
    );
  });
});

describe("waitlist — update", () => {
  it("Player NAO pode atualizar propria entrada (apenas server)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).update({
        status: "PROMOTED",
      })
    );
  });

  it("Admin NAO pode atualizar waitlist via client rules", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).update({
        status: "PROMOTED",
      })
    );
  });

  it("Player pode reentrar pelo doc canonico apos estado terminal", async () => {
    await seedDoc(testEnv, `games/${GAME_ID}/waitlist/${UID_PLAYER_C}`, {
      user_id: UID_PLAYER_C,
      game_id: GAME_ID,
      status: "EXPIRED",
      user_name: "Player C",
      queue_position: 2,
      added_at: Date.now() - 60_000,
    });
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_C}`).set({
        user_id: UID_PLAYER_C,
        game_id: GAME_ID,
        status: "WAITING",
        user_name: "Player C",
        queue_position: 2,
        added_at: Date.now(),
        notified_at: null,
        response_deadline: null,
      })
    );
  });

  it("Player NAO pode reabrir entrada terminal com id nao canonico", async () => {
    const legacyId = "legacy-terminal";
    await seedDoc(testEnv, `games/${GAME_ID}/waitlist/${legacyId}`, {
      user_id: UID_PLAYER_C,
      game_id: GAME_ID,
      status: "CANCELLED",
      user_name: "Player C",
      queue_position: 2,
      added_at: Date.now() - 60_000,
    });
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/${legacyId}`).update({
        status: "WAITING",
        added_at: Date.now(),
      })
    );
  });
});

describe("waitlist — delete", () => {
  it("Player pode deletar propria entrada (sair da fila)", async () => {
    await seedDoc(testEnv, `games/${GAME_ID}/waitlist/del-self`, {
      user_id: UID_PLAYER_C,
      game_id: GAME_ID,
      status: "WAITING",
      user_name: "Player C",
      queue_position: 3,
      added_at: Date.now(),
    });
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/del-self`).delete()
    );
  });

  it("Admin pode deletar qualquer entrada da waitlist", async () => {
    await seedDoc(testEnv, `games/${GAME_ID}/waitlist/del-admin`, {
      user_id: UID_PLAYER_C,
      game_id: GAME_ID,
      status: "WAITING",
      user_name: "Player C",
      queue_position: 4,
      added_at: Date.now(),
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/del-admin`).delete()
    );
  });

  it("Game owner pode deletar entrada de outro na waitlist", async () => {
    await seedDoc(testEnv, `games/${GAME_ID}/waitlist/del-owner`, {
      user_id: UID_PLAYER_C,
      game_id: GAME_ID,
      status: "WAITING",
      user_name: "Player C",
      queue_position: 5,
      added_at: Date.now(),
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ID}/waitlist/del-owner`).delete()
    );
  });

  it("Nao-owner NAO pode deletar entrada alheia", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/nonowner-del`).delete()
    );
  });

  it("Nao-autenticado NAO pode deletar waitlist", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ID}/waitlist/${UID_PLAYER_B}`).delete()
    );
  });
});

// ============================================================
// COLLECTION GROUP (#3955)
// ============================================================
// Queries collectionGroup("waitlist") client-side devem ser escopadas ao
// proprio user_id (ou admin); a varredura de expirados roda server-side em
// functions/reminders.ts (Admin SDK bypassa rules). O match dentro de
// games/{gameId}/waitlist nao cobre o aggregate.
describe("waitlist — collection group", () => {
  it("Player pode listar propria entrada via collection group (filtro user_id)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.collectionGroup("waitlist").where("user_id", "==", UID_PLAYER_B).get()
    );
  });

  it("Admin pode listar waitlist via collection group", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.collectionGroup("waitlist").where("user_id", "==", UID_ADMIN).get()
    );
  });

  it("Player pode listar collection group scoped a si mesmo mesmo sem resultados", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.collectionGroup("waitlist").where("user_id", "==", UID_PLAYER_C).get()
    );
  });

  it("Player NAO pode rodar collection group sem filtro de user_id (vazamento)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.collectionGroup("waitlist").get());
  });

  it("Nao-autenticado NAO pode listar waitlist via collection group", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.collectionGroup("waitlist").where("user_id", "==", UID_PLAYER_B).get()
    );
  });
});
