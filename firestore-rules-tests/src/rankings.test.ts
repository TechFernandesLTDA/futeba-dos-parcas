/**
 * Testes de Firestore Security Rules — Coleção: rankings
 *
 * Cobre:
 * - Leitura: qualquer autenticado pode ler rankings consolidados
 * - Escrita (create/update/delete): apenas ADMIN
 * - PLAYER: negado em todo tipo de escrita
 * - Não-autenticado: negado em tudo
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const RANKING_GLOBAL = "ranking-global-season-001";
const RANKING_GROUP = "ranking-group-abc-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `rankings/${RANKING_GLOBAL}`, {
    type: "GLOBAL",
    season_id: "season-2026-05",
    top_players: [
      { uid: "uid-player-a-001", xp: 1500, rank: 1 },
      { uid: "uid-player-b-001", xp: 1200, rank: 2 },
    ],
    generated_at: new Date(),
  });

  await seedDoc(testEnv, `rankings/${RANKING_GROUP}`, {
    type: "GROUP",
    group_id: "group-abc",
    season_id: "season-2026-05",
    top_players: [{ uid: "uid-player-a-001", xp: 800, rank: 1 }],
    generated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("rankings — leitura", () => {
  it("Autenticado pode ler ranking global", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`rankings/${RANKING_GLOBAL}`).get());
  });

  it("Autenticado pode ler ranking de grupo", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`rankings/${RANKING_GROUP}`).get());
  });

  it("Admin pode ler ranking", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`rankings/${RANKING_GLOBAL}`).get());
  });

  it("Não-autenticado NÃO pode ler ranking", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`rankings/${RANKING_GLOBAL}`).get());
  });
});

describe("rankings — criação", () => {
  it("Admin pode criar ranking consolidado", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("rankings/ranking-admin-created").set({
        type: "GLOBAL",
        season_id: "season-2026-06",
        top_players: [],
        generated_at: new Date(),
      })
    );
  });

  it("PLAYER NÃO pode criar ranking", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("rankings/ranking-player-hack").set({
        type: "GLOBAL",
        season_id: "season-2026-06",
        top_players: [{ uid: UID_PLAYER_A, xp: 99999, rank: 1 }],
        generated_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar ranking", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("rankings/ranking-anon-hack").set({
        type: "GLOBAL",
        season_id: "season-2026-06",
        top_players: [],
        generated_at: new Date(),
      })
    );
  });
});

describe("rankings — atualização", () => {
  it("Admin pode atualizar ranking existente", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`rankings/${RANKING_GLOBAL}`).update({ generated_at: new Date() })
    );
  });

  it("PLAYER NÃO pode atualizar ranking", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`rankings/${RANKING_GLOBAL}`).update({
        top_players: [{ uid: UID_PLAYER_A, xp: 99999, rank: 1 }],
      })
    );
  });

  it("Não-autenticado NÃO pode atualizar ranking", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`rankings/${RANKING_GLOBAL}`).update({ generated_at: new Date() })
    );
  });
});

describe("rankings — deleção", () => {
  it("Admin pode deletar ranking", async () => {
    await seedDoc(testEnv, "rankings/ranking-to-delete", {
      type: "GROUP",
      group_id: "group-old",
      season_id: "season-2026-01",
      top_players: [],
      generated_at: new Date(),
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("rankings/ranking-to-delete").delete());
  });

  it("PLAYER NÃO pode deletar ranking", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`rankings/${RANKING_GROUP}`).delete());
  });

  it("Não-autenticado NÃO pode deletar ranking", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`rankings/${RANKING_GLOBAL}`).delete());
  });
});
