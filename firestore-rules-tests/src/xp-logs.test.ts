/**
 * Testes de Firestore Security Rules — Coleção: xp_logs/{logId}
 *
 * Regras (firestore.rules linhas 1694-1698):
 *   allow read:          if isAuthenticated() && resource.data.user_id == userId();
 *   allow create:        if isAdmin();
 *   allow update, delete: if false;
 *
 * Destaques críticos (anti-fraude):
 * - NÃO há bypass de admin na leitura — admin também não lê log de outro user pelas rules
 * - update e delete são completamente bloqueados (false) — imutabilidade total
 * - create exige role ADMIN (em produção a Cloud Function usa Admin SDK, bypassa rules)
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
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const LOG_PLAYER_A = "xp-log-player-a-001";
const LOG_PLAYER_B = "xp-log-player-b-001";
const LOG_ADMIN = "xp-log-admin-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Log de XP de player A
  await seedDoc(testEnv, `xp_logs/${LOG_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    amount: 50,
    reason: "PARTICIPATION",
    game_id: "game-001",
    created_at: new Date(),
  });

  // Log de XP de player B
  await seedDoc(testEnv, `xp_logs/${LOG_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    amount: 30,
    reason: "MVP",
    game_id: "game-001",
    created_at: new Date(),
  });

  // Log de XP do admin (para testar que admin só lê o seu próprio)
  await seedDoc(testEnv, `xp_logs/${LOG_ADMIN}`, {
    user_id: UID_ADMIN,
    amount: 10,
    reason: "PARTICIPATION",
    game_id: "game-002",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA — xp_logs
// ============================================================

describe("xp_logs — leitura", () => {
  it("Player pode ler seu próprio log de XP (user_id == userId)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`xp_logs/${LOG_PLAYER_A}`).get());
  });

  it("Player NÃO pode ler log de XP de outro player", async () => {
    // Rule: resource.data.user_id == userId()
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`xp_logs/${LOG_PLAYER_B}`).get());
  });

  it("Admin NÃO pode ler log de XP de outro usuário via rules (sem bypass isAdmin)", async () => {
    // CRÍTICO: rule não tem exceção isAdmin() na leitura
    // Admin SDK (Cloud Function) bypassa rules — mas regras do cliente negam mesmo admin
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`xp_logs/${LOG_PLAYER_A}`).get());
  });

  it("Admin pode ler apenas seu próprio log de XP (user_id == admin uid)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`xp_logs/${LOG_ADMIN}`).get());
  });

  it("Não-autenticado NÃO pode ler xp_logs", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`xp_logs/${LOG_PLAYER_A}`).get());
  });
});

// ============================================================
// CRIAÇÃO — xp_logs
// ============================================================

describe("xp_logs — create", () => {
  it("Admin pode criar log de XP (simula Cloud Function em testes de cliente)", async () => {
    // Rule: allow create: if isAdmin();
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`xp_logs/xp-log-admin-create`).set({
        user_id: UID_PLAYER_A,
        amount: 20,
        reason: "WIN",
        game_id: "game-003",
        created_at: new Date(),
      })
    );
  });

  it("Player NÃO pode criar log de XP (apenas admin/Cloud Function)", async () => {
    // Rule: create exige isAdmin()
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`xp_logs/xp-log-player-hack`).set({
        user_id: UID_PLAYER_A,
        amount: 9999, // XP inflado: negado
        reason: "HACK",
        game_id: "game-001",
        created_at: new Date(),
      })
    );
  });

  it("FIELD_OWNER NÃO pode criar log de XP", async () => {
    const db = asFieldOwner(testEnv);
    await assertFails(
      db.doc(`xp_logs/xp-log-field-owner-hack`).set({
        user_id: UID_PLAYER_A,
        amount: 100,
        reason: "PARTICIPATION",
        game_id: "game-001",
        created_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar log de XP", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`xp_logs/xp-log-anon`).set({
        user_id: "anon",
        amount: 50,
        reason: "PARTICIPATION",
        game_id: "game-001",
        created_at: new Date(),
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO — xp_logs (always false — imutabilidade total)
// ============================================================

describe("xp_logs — update: sempre negado (imutável)", () => {
  it("Admin NÃO pode atualizar log de XP (update=false — anti-fraude crítico)", async () => {
    // Rule: allow update: if false;
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`xp_logs/${LOG_PLAYER_A}`).update({ amount: 999 })
    );
  });

  it("Player dono do log NÃO pode atualizar (update=false)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`xp_logs/${LOG_PLAYER_A}`).update({ amount: 100 })
    );
  });

  it("Player B NÃO pode atualizar log de player A (update=false)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`xp_logs/${LOG_PLAYER_A}`).update({ amount: 0 })
    );
  });
});

// ============================================================
// DELEÇÃO — xp_logs (always false — imutabilidade total)
// ============================================================

describe("xp_logs — delete: sempre negado (trilha de auditoria)", () => {
  it("Admin NÃO pode deletar log de XP (delete=false)", async () => {
    // Rule: allow delete: if false;
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`xp_logs/${LOG_PLAYER_A}`).delete());
  });

  it("Player dono do log NÃO pode deletar (delete=false)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`xp_logs/${LOG_PLAYER_A}`).delete());
  });

  it("Não-autenticado NÃO pode deletar log de XP", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`xp_logs/${LOG_PLAYER_A}`).delete());
  });
});
