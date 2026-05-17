/**
 * Testes de Firestore Security Rules — Coleção: users
 *
 * Cobre:
 * - Leitura: admin vê tudo, player vê a si mesmo ou usuários is_searchable
 * - Criação: usuário cria apenas seu próprio doc com role=PLAYER
 * - Atualização: campos imutáveis (role, experience_points, created_at) protegidos
 * - Deleção: bloqueada para todos
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
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Seed: perfil do player A (público/pesquisável)
  await seedDoc(testEnv, `users/${UID_PLAYER_A}`, {
    name: "Jogador A",
    email: "player.a@test.com",
    role: "PLAYER",
    is_searchable: true,
    experience_points: 500,
    level: 3,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: 3.5,
    mid_rating: 3.0,
    defender_rating: 2.5,
    gk_rating: 1.0,
  });

  // Seed: perfil do player B (não pesquisável)
  await seedDoc(testEnv, `users/${UID_PLAYER_B}`, {
    name: "Jogador B",
    email: "player.b@test.com",
    role: "PLAYER",
    is_searchable: false,
    experience_points: 100,
    level: 1,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: 2.0,
    mid_rating: 2.0,
    defender_rating: 2.0,
    gk_rating: 2.0,
  });

  // Seed: perfil do admin
  await seedDoc(testEnv, `users/${UID_ADMIN}`, {
    name: "Admin",
    email: "admin@test.com",
    role: "ADMIN",
    is_searchable: false,
    experience_points: 0,
    level: 1,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: null,
    mid_rating: null,
    defender_rating: null,
    gk_rating: null,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA (READ)
// ============================================================

describe("users — leitura", () => {
  it("Admin pode ler qualquer perfil", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`users/${UID_PLAYER_B}`).get());
  });

  it("Player pode ler seu próprio perfil", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`users/${UID_PLAYER_A}`).get());
  });

  it("Player pode ler perfil de outro com is_searchable=true", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`users/${UID_PLAYER_A}`).get());
  });

  it("Player NÃO pode ler perfil de outro com is_searchable=false", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`users/${UID_PLAYER_B}`).get());
  });

  it("Não-autenticado NÃO pode ler perfil nenhum", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`users/${UID_PLAYER_A}`).get());
  });
});

// ============================================================
// CRIAÇÃO (CREATE)
// ============================================================

describe("users — criação", () => {
  it("Player pode criar seu próprio doc com role=PLAYER", async () => {
    const db = asPlayerA(testEnv);
    // Usa UID diferente para não conflitar com seed
    const newUid = "uid-new-player-create-test";
    const userCtx = testEnv
      .authenticatedContext(newUid, { role: "PLAYER", verified: true })
      .firestore();
    await assertSucceeds(
      userCtx.doc(`users/${newUid}`).set({
        name: "Novo Jogador",
        email: "novo@test.com",
        role: "PLAYER",
        striker_rating: 2.0,
        mid_rating: 2.0,
        defender_rating: 2.0,
        gk_rating: 2.0,
        is_searchable: true,
      })
    );
  });

  it("Player NÃO pode criar doc com role=ADMIN", async () => {
    const newUid = "uid-escalation-test";
    const userCtx = testEnv
      .authenticatedContext(newUid, { role: "PLAYER", verified: true })
      .firestore();
    await assertFails(
      userCtx.doc(`users/${newUid}`).set({
        name: "Hacker",
        email: "hacker@test.com",
        role: "ADMIN", // escalação de privilégio
        striker_rating: 0,
        mid_rating: 0,
        defender_rating: 0,
        gk_rating: 0,
      })
    );
  });

  it("Player NÃO pode criar doc de outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_B}`).set({
        name: "Invasor",
        email: "invasor@test.com",
        role: "PLAYER",
        striker_rating: 0,
        mid_rating: 0,
        defender_rating: 0,
        gk_rating: 0,
      })
    );
  });

  it("Não-autenticado NÃO pode criar perfil", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`users/uid-anon-create`).set({
        name: "Anon",
        email: "anon@test.com",
        role: "PLAYER",
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO (UPDATE) — campos imutáveis
// ============================================================

describe("users — campos imutáveis (atualização)", () => {
  it("Player NÃO pode alterar o campo 'role'", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({ role: "ADMIN" })
    );
  });

  it("Player NÃO pode alterar 'experience_points'", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({ experience_points: 99999 })
    );
  });

  it("Player NÃO pode alterar 'level'", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({ level: 10 })
    );
  });

  it("Player NÃO pode alterar 'created_at'", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({ created_at: new Date() })
    );
  });

  it("Player pode atualizar campos básicos do próprio perfil (name, ratings)", async () => {
    // SECFIX #578 STAGE 2: PII fields (email, fcm_token, birth_date, height_cm,
    // weight_kg, gender) NÃO podem ser escritos client-side em users.
    // Devem usar callable updateUserPii → users_private.
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`users/${UID_PLAYER_A}`).update({
        name: "Jogador A Atualizado",
        striker_rating: 3.0,
        mid_rating: 2.5,
        defender_rating: 2.0,
        gk_rating: 1.5,
      })
    );
  });

  it("SECFIX #578: Player NÃO pode atualizar PII (email, birth_date, etc) em users", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({
        email: "tentativa@hack.com",
      })
    );
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({
        birth_date: 946684800000,
      })
    );
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({
        height_cm: 180,
      })
    );
  });

  // CPF-audit #1306: campos mirror gravados exclusivamente por Cloud Function
  it("CPF-audit #1306: Player NÃO pode escrever 'cpfVerifiedAt' diretamente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({ cpfVerifiedAt: new Date() })
    );
  });

  it("CPF-audit #1306: Player NÃO pode escrever 'verifiedAt' diretamente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({ verifiedAt: new Date() })
    );
  });

  it("CPF-audit #1306: Player PODE atualizar campos básicos normalmente (regressão)", async () => {
    // Garante que as novas restricoes nao quebraram o caminho legítimo de edicao de perfil
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`users/${UID_PLAYER_A}`).update({
        name: "Jogador A Regressao",
        nickname: "joga_a",
        striker_rating: 4.0,
      })
    );
  });

  it("Admin pode atualizar qualquer campo do perfil", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`users/${UID_PLAYER_A}`).update({ name: "Admin Changed Name" })
    );
  });

  it("Player NÃO pode atualizar perfil de outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_B}`).update({ name: "Invasão" })
    );
  });
});

// ============================================================
// DELEÇÃO (DELETE)
// ============================================================

describe("users — deleção", () => {
  it("Nenhum usuário pode deletar perfis (delete=false nas rules)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`users/${UID_PLAYER_B}`).delete());
  });

  it("Player NÃO pode deletar seu próprio perfil", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`users/${UID_PLAYER_A}`).delete());
  });
});
