/**
 * Testes de Firestore Security Rules — Coleção: users
 *
 * Cobre:
 * - Leitura: admin vê tudo, player vê a si mesmo ou apenas perfis
 *   pesquisáveis sem PII materializada no doc público
 * - Criação: usuário cria apenas seu próprio doc com role=PLAYER
 * - Atualização: campos imutáveis (role, experience_points, created_at) protegidos
 * - Deleção: bloqueada para todos
 * - Não-autenticado: negado em tudo
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import {
  initTestEnv,
  asAdmin,
  asUser,
  asAnon,
  seedDoc,
  UID_ADMIN,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;
const UID_USERS_A = "uid-users-a-001";
const UID_USERS_B = "uid-users-b-001";
const UID_USERS_C = "uid-users-c-001";
const UID_USERS_D = "uid-users-d-001";
const UID_USERS_E = "uid-users-e-001";

function asUsersA() {
  return asUser(testEnv, UID_USERS_A);
}

function asUsersB() {
  return asUser(testEnv, UID_USERS_B);
}

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `users/${UID_USERS_A}`, {
    name: "Jogador A",
    email: null,
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

  await seedDoc(testEnv, `users/${UID_USERS_B}`, {
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

  await seedDoc(testEnv, `users/${UID_USERS_C}`, {
    name: "Jogador C",
    email: "player.c@test.com",
    role: "PLAYER",
    is_searchable: true,
    experience_points: 200,
    level: 2,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: 2.5,
    mid_rating: 2.5,
    defender_rating: 2.5,
    gk_rating: 2.5,
  });

  await seedDoc(testEnv, `users/${UID_USERS_D}`, {
    name: "Jogador D",
    email: "",
    phone: "",
    phone_verified: null,
    role: "PLAYER",
    is_searchable: true,
    experience_points: 150,
    level: 2,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: 2.8,
    mid_rating: 2.6,
    defender_rating: 2.4,
    gk_rating: 2.2,
  });

  await seedDoc(testEnv, `users/${UID_USERS_E}`, {
    name: "Jogador E",
    email: null,
    role: "PLAYER",
    isSearchable: true,
    experience_points: 180,
    level: 2,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: 2.8,
    mid_rating: 2.6,
    defender_rating: 2.4,
    gk_rating: 2.2,
  });

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

  await seedDoc(testEnv, "invite_codes/ABC123", {
    user_id: UID_USERS_A,
    inviter_name: "Jogador A",
    active: true,
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("users — leitura", () => {
  it("Admin pode ler qualquer perfil", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`users/${UID_USERS_B}`).get());
  });

  it("Player pode ler seu próprio perfil", async () => {
    const db = asUsersA();
    await assertSucceeds(db.doc(`users/${UID_USERS_A}`).get());
  });

  it("Player pode ler perfil de outro com is_searchable=true e sem PII no doc", async () => {
    const db = asUsersB();
    await assertSucceeds(db.doc(`users/${UID_USERS_A}`).get());
  });

  it("Player NÃO pode ler perfil de outro com is_searchable=false", async () => {
    const db = asUsersA();
    await assertFails(db.doc(`users/${UID_USERS_B}`).get());
  });

  it("Player NÃO pode ler perfil pesquisável quando o doc ainda expõe PII", async () => {
    const db = asUsersA();
    await assertFails(db.doc(`users/${UID_USERS_C}`).get());
  });

  it('Player pode ler perfil pesquisável com email/phone vazios', async () => {
    const db = asUsersA();
    await assertSucceeds(db.doc(`users/${UID_USERS_D}`).get());
  });

  it("Player pode ler perfil legado com isSearchable=true e sem PII no doc", async () => {
    const db = asUsersA();
    await assertSucceeds(db.doc(`users/${UID_USERS_E}`).get());
  });

  it("Não-autenticado NÃO pode ler perfil nenhum", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`users/${UID_USERS_A}`).get());
  });
});

describe("users — criação", () => {
  it("Player pode criar seu próprio doc com role=PLAYER", async () => {
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
        invited_by_code: "ABC123",
      })
    );
  });

  it("Player NÃO pode criar perfil sem código de apadrinhamento", async () => {
    const newUid = "uid-new-player-no-invite";
    const userCtx = testEnv
      .authenticatedContext(newUid, { role: "PLAYER", verified: true })
      .firestore();
    await assertFails(
      userCtx.doc(`users/${newUid}`).set({
        name: "Sem Convite",
        email: "semconvite@test.com",
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
        role: "ADMIN",
        striker_rating: 0,
        mid_rating: 0,
        defender_rating: 0,
        gk_rating: 0,
      })
    );
  });

  it("Player NÃO pode criar doc de outro usuário", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_B}`).set({
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
      db.doc("users/uid-anon-create").set({
        name: "Anon",
        email: "anon@test.com",
        role: "PLAYER",
      })
    );
  });
});

describe("users — campos imutáveis (atualização)", () => {
  it("Player NÃO pode alterar o campo 'role'", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({ role: "ADMIN" })
    );
  });

  it("Player NÃO pode alterar 'experience_points'", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({ experience_points: 99999 })
    );
  });

  it("Player NÃO pode alterar 'level'", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({ level: 10 })
    );
  });

  it("Player NÃO pode alterar contador ou código de convite", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({
        invite_count: 999,
        invite_code: "HACK99",
      })
    );
  });

  it("Player NÃO pode alterar 'created_at'", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({ created_at: new Date() })
    );
  });

  it("Player pode atualizar campos básicos do próprio perfil (name, ratings)", async () => {
    const db = asUsersA();
    await assertSucceeds(
      db.doc(`users/${UID_USERS_A}`).update({
        name: "Jogador A Atualizado",
        striker_rating: 3.0,
        mid_rating: 2.5,
        defender_rating: 2.0,
        gk_rating: 1.5,
      })
    );
  });

  it("Player pode atualizar status publico de procurando jogo hoje", async () => {
    const db = asUsersA();
    await assertSucceeds(
      db.doc(`users/${UID_USERS_A}`).update({
        looking_for_game_today: true,
        looking_for_game_today_until: new Date("2026-06-27T23:59:59.999-03:00"),
        looking_for_game_today_updated_at: serverTimestamp(),
      })
    );
  });

  it("Player NÃO pode gravar status procurando jogo hoje com tipos inválidos", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({
        looking_for_game_today: "sim",
        looking_for_game_today_until: "fim do dia",
      })
    );
  });

  it("SECFIX #578: Player NÃO pode atualizar PII (email, birth_date, etc) em users", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({
        email: "tentativa@hack.com",
      })
    );
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({
        birth_date: 946684800000,
      })
    );
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({
        height_cm: 180,
      })
    );
  });

  it("CPF-audit #1306: Player NÃO pode escrever 'cpfVerifiedAt' diretamente", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({ cpfVerifiedAt: new Date() })
    );
  });

  it("CPF-audit #1306: Player NÃO pode escrever 'verifiedAt' diretamente", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_A}`).update({ verifiedAt: new Date() })
    );
  });

  it("CPF-audit #1306: Player PODE atualizar campos básicos normalmente (regressão)", async () => {
    const db = asUsersA();
    await assertSucceeds(
      db.doc(`users/${UID_USERS_A}`).update({
        name: "Jogador A Regressao",
        nickname: "joga_a",
        striker_rating: 4.0,
      })
    );
  });

  it("Admin pode atualizar qualquer campo do perfil", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`users/${UID_USERS_A}`).update({ name: "Admin Changed Name" })
    );
  });

  it("Player NÃO pode atualizar perfil de outro usuário", async () => {
    const db = asUsersA();
    await assertFails(
      db.doc(`users/${UID_USERS_B}`).update({ name: "Invasão" })
    );
  });
});

describe("users — deleção", () => {
  it("Nenhum usuário pode deletar perfis (delete=false nas rules)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`users/${UID_USERS_B}`).delete());
  });

  it("Player NÃO pode deletar seu próprio perfil", async () => {
    const db = asUsersA();
    await assertFails(db.doc(`users/${UID_USERS_A}`).delete());
  });
});
