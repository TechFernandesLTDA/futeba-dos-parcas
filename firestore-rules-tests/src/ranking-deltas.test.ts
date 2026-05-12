/**
 * Testes de Firestore Security Rules — Coleção: ranking_deltas
 *
 * CRITICAL: Fix #584 — fraude de XP via escrita direta de ranking_deltas pelo cliente.
 *
 * ranking_deltas são incrementos de ranking gerados EXCLUSIVAMENTE por Cloud Functions.
 * Nenhum cliente (PLAYER, FIELD_OWNER, etc.) deve conseguir criar, atualizar ou deletar
 * um delta — fazer isso permitiria inflar XP e posições no ranking artificialmente.
 *
 * Cobre:
 * - Leitura: autenticado pode ler (informacional, sem risco)
 * - Criação: PLAYER NÃO pode criar (fix #584)
 * - Atualização: PLAYER NÃO pode atualizar (fix #584)
 * - Deleção: PLAYER NÃO pode deletar (fix #584)
 * - Não-autenticado: negado em tudo
 * - Admin: pode ler, criar, atualizar e deletar (happy path)
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asFieldOwner,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const DELTA_001 = "delta-season-001";
const DELTA_002 = "delta-season-002";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `ranking_deltas/${DELTA_001}`, {
    user_id: UID_PLAYER_A,
    season_id: "season-2026-05",
    xp_delta: 150,
    rank_delta: 2,
    reason: "GAME_WIN",
    game_id: "game-abc-001",
    created_at: new Date(),
  });

  await seedDoc(testEnv, `ranking_deltas/${DELTA_002}`, {
    user_id: UID_PLAYER_B,
    season_id: "season-2026-05",
    xp_delta: 80,
    rank_delta: 1,
    reason: "MVP_VOTE",
    game_id: "game-abc-002",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA — ranking_deltas
// ============================================================

describe("ranking_deltas — leitura", () => {
  it("Autenticado pode ler ranking_delta (informacional)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`ranking_deltas/${DELTA_001}`).get());
  });

  it("Admin pode ler ranking_delta", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`ranking_deltas/${DELTA_001}`).get());
  });

  it("Não-autenticado NÃO pode ler ranking_delta", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`ranking_deltas/${DELTA_001}`).get());
  });
});

// ============================================================
// CRIAÇÃO — ranking_deltas (FIX #584: PLAYER não pode criar)
// ============================================================

describe("ranking_deltas — criação (fix #584: fraude de XP)", () => {
  it("PLAYER NÃO pode criar ranking_delta — bloqueio anti-fraude XP", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("ranking_deltas/delta-player-hack").set({
        user_id: UID_PLAYER_A,
        season_id: "season-2026-05",
        xp_delta: 9999,
        rank_delta: 100,
        reason: "HACK",
        game_id: "game-fake-001",
        created_at: new Date(),
      })
    );
  });

  it("PLAYER NÃO pode criar ranking_delta para outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("ranking_deltas/delta-player-hack-other").set({
        user_id: UID_PLAYER_B,
        season_id: "season-2026-05",
        xp_delta: 9999,
        rank_delta: 50,
        reason: "HACK",
        game_id: "game-fake-002",
        created_at: new Date(),
      })
    );
  });

  it("FIELD_OWNER NÃO pode criar ranking_delta", async () => {
    const db = asFieldOwner(testEnv);
    await assertFails(
      db.doc("ranking_deltas/delta-field-owner-hack").set({
        user_id: UID_PLAYER_A,
        season_id: "season-2026-05",
        xp_delta: 500,
        rank_delta: 10,
        reason: "FIELD_OWNER_HACK",
        game_id: "game-fake-003",
        created_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar ranking_delta", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("ranking_deltas/delta-anon-hack").set({
        user_id: "anon",
        season_id: "season-2026-05",
        xp_delta: 9999,
        rank_delta: 100,
        reason: "ANON_HACK",
        game_id: "game-fake-004",
        created_at: new Date(),
      })
    );
  });

  it("Admin pode criar ranking_delta (operação de recuperação)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("ranking_deltas/delta-admin-recovery").set({
        user_id: UID_PLAYER_A,
        season_id: "season-2026-05",
        xp_delta: 10,
        rank_delta: 0,
        reason: "ADMIN_CORRECTION",
        game_id: "game-abc-001",
        created_at: new Date(),
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO — ranking_deltas (FIX #584)
// ============================================================

describe("ranking_deltas — atualização (fix #584)", () => {
  it("PLAYER NÃO pode atualizar ranking_delta existente — bloqueio anti-fraude", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`ranking_deltas/${DELTA_001}`).update({
        xp_delta: 9999,
        rank_delta: 999,
      })
    );
  });

  it("Não-autenticado NÃO pode atualizar ranking_delta", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`ranking_deltas/${DELTA_001}`).update({ xp_delta: 1 })
    );
  });

  it("Admin pode atualizar ranking_delta (correção administrativa)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`ranking_deltas/${DELTA_002}`).update({
        xp_delta: 85,
        updated_at: new Date(),
      })
    );
  });
});

// ============================================================
// DELEÇÃO — ranking_deltas (FIX #584)
// ============================================================

describe("ranking_deltas — deleção (fix #584)", () => {
  it("PLAYER NÃO pode deletar ranking_delta — bloqueio anti-fraude (eliminação de penalidades)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`ranking_deltas/${DELTA_002}`).delete());
  });

  it("Não-autenticado NÃO pode deletar ranking_delta", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`ranking_deltas/${DELTA_001}`).delete());
  });

  it("Admin pode deletar ranking_delta (limpeza administrativa)", async () => {
    await seedDoc(testEnv, "ranking_deltas/delta-to-delete", {
      user_id: UID_PLAYER_A,
      season_id: "season-2026-04",
      xp_delta: 10,
      rank_delta: 1,
      reason: "OLD_DATA",
      game_id: "game-old-001",
      created_at: new Date(),
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("ranking_deltas/delta-to-delete").delete());
  });
});
