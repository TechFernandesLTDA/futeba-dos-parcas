/**
 * Testes de Firestore Security Rules — Coleção: groups/{groupId}/cashbox/{entryId}
 *
 * Complementa groups.test.ts (que cobre 8 casos básicos de cashbox).
 * Foco aqui: casos de borda, shape enforcement no update, grupo inativo,
 * cashbox_summary, fallback de owner_id legado, e ausência de bypass isAdmin() na leitura.
 *
 * Rule (resumo):
 *   read:   isAuthenticated() && (isGroupMember(groupId) || isGroupOwnerById(groupId)) ← sem isAdmin() bypass
 *   create: (isAdmin() || isVerifiedOrGrace()) && admin/owner && isGroupActive() && shape/auditoria travados
 *   update: (isGroupAdmin() || isGroupOwnerById()) && isGroupActive() && affectedKeys hasOnly [status,voided_at,voided_by,updated_at] && status==VOIDED && voided_by==userId() && voided_at==request.time
 *   delete: false
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
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

// IDs fixos para evitar colisão com groups.test.ts
const GROUP_CASHBOX = "group-cashbox-ext-001";
const GROUP_INACTIVE = "group-cashbox-inactive-001";
const GROUP_OWNER_ONLY = "group-cashbox-owner-only-001";
const ENTRY_EXISTING = "cashbox-entry-existing-ext";
const ENTRY_OWNER_ONLY = "cashbox-entry-owner-only-ext";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Grupo ativo — owner é player A, player B é membro, player C não é membro
  await seedDoc(testEnv, `groups/${GROUP_CASHBOX}`, {
    name: "Grupo Cashbox Extended",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "Grupo para testes avançados de cashbox",
    member_count: 2,
  });
  await seedDoc(testEnv, `groups/${GROUP_CASHBOX}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_CASHBOX}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
    status: "ACTIVE",
  });

  // Entrada existente para testes de update/delete
  await seedDoc(
    testEnv,
    `groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`,
    {
      type: "INCOME",
      amount: 75,
      status: "ACTIVE",
      created_by: UID_PLAYER_A,
      created_at: new Date(),
    }
  );

  // Grupo inativo — para testar bloqueio de isGroupActive()
  await seedDoc(testEnv, `groups/${GROUP_INACTIVE}`, {
    name: "Grupo Inativo Cashbox",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "INACTIVE",
    description: "Grupo inativo para teste",
    member_count: 1,
  });
  await seedDoc(testEnv, `groups/${GROUP_INACTIVE}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });

  // Grupo legado: owner_id aponta para player A, mas nao ha doc members/{uid}.
  // A rota web permite esse owner; as rules precisam permitir o mesmo.
  await seedDoc(testEnv, `groups/${GROUP_OWNER_ONLY}`, {
    name: "Grupo Cashbox Owner Only",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "Grupo legado sem members para o owner",
    member_count: 0,
  });
  await seedDoc(
    testEnv,
    `groups/${GROUP_OWNER_ONLY}/cashbox/${ENTRY_OWNER_ONLY}`,
    {
      type: "EXPENSE",
      amount: 40,
      status: "ACTIVE",
      created_by: UID_PLAYER_A,
      created_at: new Date(),
    }
  );
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA — cashbox (sem bypass isAdmin)
// ============================================================

describe("cashbox — leitura: ausência de bypass isAdmin()", () => {
  it("Admin NÃO pode ler cashbox de grupo do qual não é membro (sem bypass isAdmin na rule)", async () => {
    // Rule: allow read: if isAuthenticated() && isGroupMember(groupId)
    // Diferente de grupos (que tem bypass admin), cashbox leitura exige membership
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`).get()
    );
  });

  it("Não-autenticado NÃO pode ler cashbox", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`).get()
    );
  });

  it("Owner legado pode ler cashbox mesmo sem doc members/{uid}", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_OWNER_ONLY}/cashbox/${ENTRY_OWNER_ONLY}`).get()
    );
  });
});

// ============================================================
// CRIAÇÃO — cashbox: validações de campo e grupo inativo
// ============================================================

describe("cashbox — create: validações de campo", () => {
  it("Type inválido ('TRANSFER') é rejeitado", async () => {
    // Rule: type == 'INCOME' || type == 'EXPENSE'
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/entry-bad-type`).set({
        type: "TRANSFER",
        amount: 50,
        status: "ACTIVE",
        created_at: new Date(),
      })
    );
  });

  it("Amount negativo é rejeitado (deve ser > 0)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/entry-negative`).set({
        type: "EXPENSE",
        amount: -10,
        status: "ACTIVE",
        created_at: new Date(),
      })
    );
  });

  it("Owner não pode criar entrada em grupo inativo (isGroupActive falha)", async () => {
    // Rule: isGroupActive(groupId) — status deve ser 'ACTIVE'
    const db = asPlayerA(testEnv);
    await assertFails(
      db
        .doc(`groups/${GROUP_INACTIVE}/cashbox/entry-inactive-group`)
        .set({
          group_id: GROUP_INACTIVE,
          type: "INCOME",
          amount: 50,
          description: "Entrada em grupo inativo",
          category: "OTHER",
          status: "ACTIVE",
          created_by: UID_PLAYER_A,
          created_at: serverTimestamp(),
        })
    );
  });

  it("Owner legado pode criar entrada mesmo sem doc members/{uid}", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_OWNER_ONLY}/cashbox/entry-owner-only-create`).set({
        group_id: GROUP_OWNER_ONLY,
        type: "INCOME",
        amount: 120,
        status: "ACTIVE",
        description: "Mensalidade",
        category: "OTHER",
        created_by: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("Create rejeita spoof de created_by", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/entry-spoof-author`).set({
        group_id: GROUP_CASHBOX,
        type: "INCOME",
        amount: 10,
        description: "Autor falso",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_PLAYER_B,
        created_at: serverTimestamp(),
      })
    );
  });

  it("Create rejeita created_at de cliente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/entry-client-date`).set({
        group_id: GROUP_CASHBOX,
        type: "INCOME",
        amount: 10,
        description: "Data cliente",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_PLAYER_A,
        created_at: new Date(),
      })
    );
  });

  it("Create rejeita status diferente de ACTIVE", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/entry-invalid-status`).set({
        group_id: GROUP_CASHBOX,
        type: "EXPENSE",
        amount: 10,
        description: "Status invalido",
        category: "OTHER",
        status: "VOIDED",
        created_by: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("Create rejeita campo extra fora da whitelist", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/entry-extra-field`).set({
        group_id: GROUP_CASHBOX,
        type: "EXPENSE",
        amount: 10,
        description: "Campo extra",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_PLAYER_A,
        created_at: serverTimestamp(),
        approved_by: UID_PLAYER_A,
      })
    );
  });

  it("Create rejeita group_id divergente do path", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/entry-wrong-group`).set({
        group_id: GROUP_OWNER_ONLY,
        type: "INCOME",
        amount: 10,
        description: "Grupo divergente",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO — cashbox: void com shape enforcement
// ============================================================

describe("cashbox — update: void (shape enforcement)", () => {
  it("Group admin (owner) pode fazer void com shape correta", async () => {
    // Campos permitidos: ['status', 'voided_at', 'voided_by', 'updated_at']
    // status == 'VOIDED', voided_by == userId(), voided_at == request.time
    // FIX: voided_at DEVE ser serverTimestamp() pra match com request.time na rule
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`).update({
        status: "VOIDED",
        voided_at: serverTimestamp(),
        voided_by: UID_PLAYER_A,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("Update com campo extra rejeitado mesmo para group admin (shape enforcement)", async () => {
    // Campo 'amount' não está na whitelist de campos permitidos
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`).update({
        status: "VOIDED",
        voided_at: new Date(),
        voided_by: UID_PLAYER_A,
        updated_at: new Date(),
        amount: 999, // campo extra não permitido
      })
    );
  });

  it("Membro simples (não-admin do grupo) NÃO pode fazer update", async () => {
    // Rule: isGroupAdmin(groupId) — player B é MEMBER, não OWNER/ADMIN
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`).update({
        status: "VOIDED",
        voided_at: new Date(),
        voided_by: UID_PLAYER_B,
        updated_at: new Date(),
      })
    );
  });

  it("Update em grupo inativo é rejeitado para group admin", async () => {
    await seedDoc(
      testEnv,
      `groups/${GROUP_INACTIVE}/cashbox/inactive-entry`,
      {
        type: "INCOME",
        amount: 30,
        status: "ACTIVE",
        created_at: new Date(),
      }
    );
    const db = asPlayerA(testEnv);
    await assertFails(
      db
        .doc(`groups/${GROUP_INACTIVE}/cashbox/inactive-entry`)
        .update({
          status: "VOIDED",
          voided_at: new Date(),
          voided_by: UID_PLAYER_A,
          updated_at: new Date(),
        })
    );
  });

  it("Owner legado pode fazer void mesmo sem doc members/{uid}", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_OWNER_ONLY}/cashbox/${ENTRY_OWNER_ONLY}`).update({
        status: "VOIDED",
        voided_at: serverTimestamp(),
        voided_by: UID_PLAYER_A,
        updated_at: serverTimestamp(),
      })
    );
  });
});

// ============================================================
// DELEÇÃO — cashbox: sempre false (inclusive para admin)
// ============================================================

describe("cashbox — delete: sempre negado (delete=false)", () => {
  it("Group admin (owner) NÃO pode deletar entrada de cashbox", async () => {
    // Rule: allow delete: if false;
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`).delete()
    );
  });

  it("Admin global NÃO pode deletar entrada de cashbox (delete=false é absoluto)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox/${ENTRY_EXISTING}`).delete()
    );
  });
});

// ============================================================
// CASHBOX SUMMARY — subcoleção groups/{groupId}/cashbox_summary
// ============================================================

describe("cashbox_summary — permissões", () => {
  it("Membro do grupo pode ler cashbox_summary", async () => {
    await seedDoc(
      testEnv,
      `groups/${GROUP_CASHBOX}/cashbox_summary/current`,
      {
        balance: 100,
        total_income: 150,
        total_expense: 50,
        updated_at: new Date(),
      }
    );
    const db = asPlayerB(testEnv); // membro
    await assertSucceeds(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox_summary/current`).get()
    );
  });

  it("Não-membro NÃO pode ler cashbox_summary", async () => {
    const db = asPlayerC(testEnv); // não é membro
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox_summary/current`).get()
    );
  });

  it("Owner legado pode ler cashbox_summary mesmo sem doc members/{uid}", async () => {
    await seedDoc(
      testEnv,
      `groups/${GROUP_OWNER_ONLY}/cashbox_summary/current`,
      {
        balance: 80,
        total_income: 120,
        total_expense: 40,
        updated_at: new Date(),
      }
    );
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_OWNER_ONLY}/cashbox_summary/current`).get()
    );
  });

  it("Group admin pode criar/atualizar cashbox_summary", async () => {
    const db = asPlayerA(testEnv); // owner = group admin
    await assertSucceeds(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox_summary/current`).set({
        balance: 200,
        total_income: 250,
        total_expense: 50,
        period_start: "2026-05-01",
        period_end: "2026-05-31",
        updated_at: new Date(),
      })
    );
  });

  it("Membro simples NÃO pode criar/atualizar cashbox_summary", async () => {
    const db = asPlayerB(testEnv); // MEMBER
    await assertFails(
      db.doc(`groups/${GROUP_CASHBOX}/cashbox_summary/current`).set({
        balance: 999,
        updated_at: new Date(),
      })
    );
  });

  it("Owner legado pode criar/atualizar cashbox_summary", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_OWNER_ONLY}/cashbox_summary/current`).set({
        balance: 300,
        total_income: 350,
        total_expense: 50,
        period_start: "2026-07-01",
        period_end: "2026-07-31",
        updated_at: new Date(),
      })
    );
  });
});
