/**
 * Testes de Firestore Security Rules — Coleção: activities
 *
 * Cobre:
 * - Leitura: autenticado pode ler PUBLIC, próprias (created_by ou user_id), mas não as alheias PRIVATE
 * - Criação: exige autenticado + created_by==uid + visibility válida + campos obrigatórios
 * - Atualização: apenas created_by + campo created_by imutável
 * - Deleção: apenas created_by
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
  asPlayerC,
  asAnon,
  seedDoc,
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const ACTIVITY_PUBLIC = "activity-public-001";
const ACTIVITY_PRIVATE_A = "activity-private-a-001";
const ACTIVITY_PRIVATE_B_USERID = "activity-private-b-userid-001";
const ACTIVITY_TO_UPDATE = "activity-to-update-001";
const ACTIVITY_TO_DELETE = "activity-to-delete-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `activities/${ACTIVITY_PUBLIC}`, {
    created_by: UID_PLAYER_A,
    user_id: UID_PLAYER_A,
    type: "GAME_CREATED",
    visibility: "PUBLIC",
    created_at: new Date(),
  });

  await seedDoc(testEnv, `activities/${ACTIVITY_PRIVATE_A}`, {
    created_by: UID_PLAYER_A,
    user_id: UID_PLAYER_A,
    type: "XP_EARNED",
    visibility: "PRIVATE",
    created_at: new Date(),
  });

  // Atividade privada onde user_id == PlayerB (mas created_by é PlayerA — ex.: atividade gerada por CF)
  await seedDoc(testEnv, `activities/${ACTIVITY_PRIVATE_B_USERID}`, {
    created_by: UID_PLAYER_A,
    user_id: UID_PLAYER_B,
    type: "BADGE_EARNED",
    visibility: "PRIVATE",
    created_at: new Date(),
  });

  await seedDoc(testEnv, `activities/${ACTIVITY_TO_UPDATE}`, {
    created_by: UID_PLAYER_A,
    user_id: UID_PLAYER_A,
    type: "GAME_JOINED",
    visibility: "PUBLIC",
    created_at: new Date(),
  });

  await seedDoc(testEnv, `activities/${ACTIVITY_TO_DELETE}`, {
    created_by: UID_PLAYER_A,
    user_id: UID_PLAYER_A,
    type: "GAME_FINISHED",
    visibility: "PUBLIC",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA — activities
// ============================================================

describe("activities — leitura", () => {
  it("Autenticado pode ler atividade PUBLIC (visibilidade pública)", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`activities/${ACTIVITY_PUBLIC}`).get());
  });

  it("Dono pode ler atividade PRIVATE própria via created_by", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`activities/${ACTIVITY_PRIVATE_A}`).get());
  });

  it("Usuário pode ler atividade PRIVATE onde é o user_id (#1017)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`activities/${ACTIVITY_PRIVATE_B_USERID}`).get());
  });

  it("Terceiro NÃO pode ler atividade PRIVATE alheia", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`activities/${ACTIVITY_PRIVATE_A}`).get());
  });

  it("Admin pode ler qualquer atividade (é autenticado)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`activities/${ACTIVITY_PUBLIC}`).get());
  });

  it("Não-autenticado NÃO pode ler atividade", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`activities/${ACTIVITY_PUBLIC}`).get());
  });
});

// ============================================================
// CRIAÇÃO — activities
// ============================================================

describe("activities — criação", () => {
  it("Autenticado pode criar atividade com todos os campos obrigatórios", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("activities/activity-create-valid").set({
        created_by: UID_PLAYER_A,
        user_id: UID_PLAYER_A,
        type: "GAME_JOINED",
        visibility: "PUBLIC",
        created_at: new Date(),
      })
    );
  });

  it("Criação falha se created_by != uid do usuário autenticado", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("activities/activity-create-wrong-owner").set({
        created_by: UID_PLAYER_B,
        user_id: UID_PLAYER_A,
        type: "GAME_JOINED",
        visibility: "PUBLIC",
        created_at: new Date(),
      })
    );
  });

  it("Criação falha se visibility é inválida (não PUBLIC nem PRIVATE)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("activities/activity-create-bad-visibility").set({
        created_by: UID_PLAYER_A,
        user_id: UID_PLAYER_A,
        type: "GAME_JOINED",
        visibility: "FRIENDS_ONLY",
        created_at: new Date(),
      })
    );
  });

  it("Criação falha se campo obrigatório 'type' está ausente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("activities/activity-create-missing-type").set({
        created_by: UID_PLAYER_A,
        user_id: UID_PLAYER_A,
        visibility: "PUBLIC",
        created_at: new Date(),
      })
    );
  });

  it("Criação falha se campo obrigatório 'user_id' está ausente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("activities/activity-create-missing-userid").set({
        created_by: UID_PLAYER_A,
        type: "GAME_JOINED",
        visibility: "PUBLIC",
        created_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar atividade", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("activities/activity-anon-create").set({
        created_by: "anon",
        user_id: "anon",
        type: "GAME_JOINED",
        visibility: "PUBLIC",
        created_at: new Date(),
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO — activities
// ============================================================

describe("activities — atualização", () => {
  it("Dono pode atualizar campo permitido (visibility)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`activities/${ACTIVITY_TO_UPDATE}`).update({
        visibility: "PRIVATE",
        updated_at: new Date(),
      })
    );
  });

  it("Atualização falha se tenta modificar campo created_by (imutável)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`activities/${ACTIVITY_TO_UPDATE}`).update({
        created_by: UID_PLAYER_B,
        updated_at: new Date(),
      })
    );
  });

  it("Terceiro NÃO pode atualizar atividade alheia", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`activities/${ACTIVITY_TO_UPDATE}`).update({
        visibility: "PRIVATE",
      })
    );
  });

  it("Não-autenticado NÃO pode atualizar atividade", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`activities/${ACTIVITY_TO_UPDATE}`).update({
        visibility: "PRIVATE",
      })
    );
  });
});

// ============================================================
// DELEÇÃO — activities
// ============================================================

describe("activities — deleção", () => {
  it("Dono pode deletar própria atividade", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`activities/${ACTIVITY_TO_DELETE}`).delete());
  });

  it("Terceiro NÃO pode deletar atividade alheia", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`activities/${ACTIVITY_TO_UPDATE}`).delete());
  });

  it("Não-autenticado NÃO pode deletar atividade", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`activities/${ACTIVITY_PUBLIC}`).delete());
  });
});
