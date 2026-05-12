/**
 * Testes de Firestore Security Rules — Coleção: schedules/{scheduleId}
 *
 * Regras:
 * - read: owner_id == uid OU isAdmin() OU (group_id != null && isGroupMember(group_id))
 * - create: isAuthenticated() && (owner_id == userId() || isAdmin()) && (group_id == null || isGroupMember(group_id))
 * - update: isAdmin() OU (owner_id == userId() && fieldUnchanged(owner_id, group_id, created_at))
 * - delete: owner_id == userId() || isAdmin()
 *
 * Nota: Não há bypass especial de FIELD_OWNER — acesso baseado em ownership.
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

const GROUP_ID = "group-schedule-001";
const SCHEDULE_PLAYER_A = "schedule-player-a-001";
const SCHEDULE_WITH_GROUP = "schedule-with-group-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Grupo com player A como owner e player B como membro
  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    name: "Grupo Schedules",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "Grupo para testes de schedules",
    member_count: 2,
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
    status: "ACTIVE",
  });

  // Schedule de player A sem group_id
  await seedDoc(testEnv, `schedules/${SCHEDULE_PLAYER_A}`, {
    owner_id: UID_PLAYER_A,
    group_id: null,
    title: "Treino semanal",
    recurrence: "WEEKLY",
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Schedule vinculado ao grupo (owner = player A)
  await seedDoc(testEnv, `schedules/${SCHEDULE_WITH_GROUP}`, {
    owner_id: UID_PLAYER_A,
    group_id: GROUP_ID,
    title: "Pelada do grupo",
    recurrence: "WEEKLY",
    created_at: new Date(),
    updated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA — schedules
// ============================================================

describe("schedules — leitura", () => {
  it("Owner pode ler seu próprio schedule", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`schedules/${SCHEDULE_PLAYER_A}`).get());
  });

  it("Admin pode ler qualquer schedule", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`schedules/${SCHEDULE_PLAYER_A}`).get());
  });

  it("Membro do grupo pode ler schedule vinculado ao grupo", async () => {
    // Rule: group_id != null && isGroupMember(group_id)
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`schedules/${SCHEDULE_WITH_GROUP}`).get());
  });

  it("Não-membro NÃO pode ler schedule vinculado a grupo alheio", async () => {
    // player C não é membro do grupo
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`schedules/${SCHEDULE_WITH_GROUP}`).get());
  });

  it("Player B NÃO pode ler schedule privado de player A (sem group_id)", async () => {
    // player B não é owner e o schedule não tem group_id
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`schedules/${SCHEDULE_PLAYER_A}`).get());
  });

  it("Não-autenticado NÃO pode ler schedules", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`schedules/${SCHEDULE_PLAYER_A}`).get());
  });
});

// ============================================================
// CRIAÇÃO — schedules
// ============================================================

describe("schedules — create", () => {
  it("Player pode criar schedule com owner_id == self (sem group_id)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`schedules/schedule-new-no-group`).set({
        owner_id: UID_PLAYER_A,
        group_id: null,
        title: "Novo treino",
        recurrence: "WEEKLY",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("Player pode criar schedule vinculado a grupo do qual é membro", async () => {
    // player B é membro do GROUP_ID
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`schedules/schedule-b-with-group`).set({
        owner_id: UID_PLAYER_B,
        group_id: GROUP_ID,
        title: "Jogo do grupo player B",
        recurrence: "WEEKLY",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("owner_id diferente de userId() é rejeitado (sem ser admin)", async () => {
    // Rule: owner_id == userId() || isAdmin()
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`schedules/schedule-b-fake-owner`).set({
        owner_id: UID_PLAYER_A, // tenta se passar por player A
        group_id: null,
        title: "Hack",
        recurrence: "WEEKLY",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("Admin pode criar schedule para qualquer owner_id", async () => {
    // Rule: isAdmin()
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`schedules/schedule-admin-for-a`).set({
        owner_id: UID_PLAYER_A, // owner diferente do admin
        group_id: null,
        title: "Admin schedule",
        recurrence: "MONTHLY",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("Player NÃO pode criar schedule vinculado a grupo do qual não é membro", async () => {
    // Rule: group_id != null → isGroupMember(group_id)
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`schedules/schedule-c-hack-group`).set({
        owner_id: UID_PLAYER_C,
        group_id: GROUP_ID, // C não é membro
        title: "Invasão",
        recurrence: "WEEKLY",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar schedule", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`schedules/schedule-anon`).set({
        owner_id: "anon",
        group_id: null,
        title: "Anon",
        recurrence: "WEEKLY",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO — schedules
// ============================================================

describe("schedules — update", () => {
  it("Owner pode atualizar campos permitidos (title, recurrence, updated_at)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`schedules/${SCHEDULE_PLAYER_A}`).update({
        title: "Treino atualizado",
        recurrence: "BIWEEKLY",
        updated_at: new Date(),
      })
    );
  });

  it("Owner NÃO pode alterar owner_id (fieldUnchanged — SECFIX #863)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`schedules/${SCHEDULE_PLAYER_A}`).update({
        owner_id: UID_PLAYER_B,
        updated_at: new Date(),
      })
    );
  });

  it("Owner NÃO pode alterar group_id (fieldUnchanged — SECFIX #863)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`schedules/${SCHEDULE_PLAYER_A}`).update({
        group_id: GROUP_ID,
        updated_at: new Date(),
      })
    );
  });

  it("Admin pode atualizar schedule de outro owner", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`schedules/${SCHEDULE_PLAYER_A}`).update({
        title: "Admin editou",
        updated_at: new Date(),
      })
    );
  });

  it("Não-owner (player B) NÃO pode atualizar schedule de player A", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`schedules/${SCHEDULE_PLAYER_A}`).update({
        title: "Hack",
        updated_at: new Date(),
      })
    );
  });
});

// ============================================================
// DELEÇÃO — schedules
// ============================================================

describe("schedules — delete", () => {
  it("Owner pode deletar seu próprio schedule", async () => {
    await seedDoc(testEnv, `schedules/schedule-delete-by-owner`, {
      owner_id: UID_PLAYER_A,
      group_id: null,
      title: "Para deletar",
      recurrence: "WEEKLY",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`schedules/schedule-delete-by-owner`).delete()
    );
  });

  it("Admin pode deletar schedule de qualquer owner", async () => {
    await seedDoc(testEnv, `schedules/schedule-admin-delete`, {
      owner_id: UID_PLAYER_B,
      group_id: null,
      title: "Para admin deletar",
      recurrence: "MONTHLY",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`schedules/schedule-admin-delete`).delete());
  });

  it("Não-owner NÃO pode deletar schedule alheio", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`schedules/${SCHEDULE_PLAYER_A}`).delete());
  });

  it("Não-autenticado NÃO pode deletar schedule", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`schedules/${SCHEDULE_PLAYER_A}`).delete());
  });
});
