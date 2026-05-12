/**
 * Testes de Firestore Security Rules — Coleção: season_participation
 *
 * Cobre:
 * - Leitura: qualquer autenticado pode ler (rankings de liga)
 * - Criação: apenas ADMIN (Cloud Functions gerenciam isso)
 * - Atualização: apenas ADMIN
 * - Deleção: ninguém pode deletar (rule não define allow delete → implícito deny)
 * - Não-autenticado: negado em tudo
 * - PLAYER: negado em create, update e delete
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
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const PART_001 = "part-season-2026-05-player-a";
const PART_002 = "part-season-2026-05-player-b";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `season_participation/${PART_001}`, {
    user_id: UID_PLAYER_A,
    season_id: "season-2026-05",
    group_id: "group-abc",
    xp_total: 1500,
    games_played: 12,
    wins: 8,
    draws: 2,
    losses: 2,
    rank: 1,
    division: "GOLD",
    created_at: new Date(),
    updated_at: new Date(),
  });

  await seedDoc(testEnv, `season_participation/${PART_002}`, {
    user_id: UID_PLAYER_B,
    season_id: "season-2026-05",
    group_id: "group-abc",
    xp_total: 1200,
    games_played: 10,
    wins: 6,
    draws: 2,
    losses: 2,
    rank: 2,
    division: "SILVER",
    created_at: new Date(),
    updated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("season_participation — leitura", () => {
  it("Autenticado pode ler própria participação de temporada", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`season_participation/${PART_001}`).get());
  });

  it("Autenticado pode ler participação de outro jogador (rankings são públicos)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`season_participation/${PART_002}`).get());
  });

  it("Admin pode ler participação de temporada", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`season_participation/${PART_001}`).get());
  });

  it("Não-autenticado NÃO pode ler season_participation", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`season_participation/${PART_001}`).get());
  });
});

describe("season_participation — criação", () => {
  it("Admin pode criar registro de season_participation", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("season_participation/part-admin-created").set({
        user_id: UID_PLAYER_A,
        season_id: "season-2026-06",
        group_id: "group-abc",
        xp_total: 0,
        games_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        rank: 0,
        division: "BRONZE",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("PLAYER NÃO pode criar season_participation (Cloud Functions apenas)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("season_participation/part-player-hack").set({
        user_id: UID_PLAYER_A,
        season_id: "season-2026-06",
        group_id: "group-abc",
        xp_total: 9999,
        games_played: 100,
        wins: 100,
        draws: 0,
        losses: 0,
        rank: 1,
        division: "DIAMOND",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar season_participation", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("season_participation/part-anon-hack").set({
        user_id: "anon",
        season_id: "season-2026-06",
        group_id: "group-abc",
        xp_total: 0,
        games_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        rank: 0,
        division: "NONE",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });
});

describe("season_participation — atualização", () => {
  it("Admin pode atualizar registro de season_participation", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`season_participation/${PART_001}`).update({
        xp_total: 1600,
        rank: 1,
        updated_at: new Date(),
      })
    );
  });

  it("PLAYER NÃO pode atualizar própria season_participation", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`season_participation/${PART_001}`).update({
        xp_total: 99999,
        division: "DIAMOND",
        rank: 1,
      })
    );
  });

  it("PLAYER NÃO pode atualizar season_participation de outro", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`season_participation/${PART_002}`).update({
        xp_total: 0,
        rank: 999,
      })
    );
  });

  it("Não-autenticado NÃO pode atualizar season_participation", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`season_participation/${PART_001}`).update({ xp_total: 0 })
    );
  });
});

describe("season_participation — deleção", () => {
  it("Admin NÃO pode deletar season_participation (rule não define allow delete)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`season_participation/${PART_002}`).delete());
  });

  it("PLAYER NÃO pode deletar season_participation", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`season_participation/${PART_002}`).delete());
  });

  it("Não-autenticado NÃO pode deletar season_participation", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`season_participation/${PART_001}`).delete());
  });
});
