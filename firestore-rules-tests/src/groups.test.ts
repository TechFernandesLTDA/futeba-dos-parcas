/**
 * Testes de Firestore Security Rules — Coleção: groups + cashbox
 *
 * Cobre:
 * - groups: owner/admin edita, member só lê, não-member negado
 * - groups/members: subcoleção de membros
 * - groups/cashbox: apenas group admin cria/atualiza, member apenas lê
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

// IDs de grupos
const GROUP_PUBLIC = "group-public-001";
const GROUP_PRIVATE = "group-private-001";
const GROUP_FOR_CASHBOX = "group-cashbox-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Grupo público — owner é player A, membro player B, player C não é membro
  await seedDoc(testEnv, `groups/${GROUP_PUBLIC}`, {
    name: "Grupo Público",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "Grupo de teste público",
    member_count: 2,
  });
  // Membro: player A (OWNER)
  await seedDoc(testEnv, `groups/${GROUP_PUBLIC}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  // Membro: player B (MEMBER)
  await seedDoc(testEnv, `groups/${GROUP_PUBLIC}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
    status: "ACTIVE",
  });

  // Grupo privado — apenas owner e membros podem ler
  await seedDoc(testEnv, `groups/${GROUP_PRIVATE}`, {
    name: "Grupo Privado",
    owner_id: UID_PLAYER_A,
    is_public: false,
    status: "ACTIVE",
    description: "Grupo privado de teste",
    member_count: 1,
  });
  await seedDoc(testEnv, `groups/${GROUP_PRIVATE}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });

  // Grupo para testes de cashbox
  await seedDoc(testEnv, `groups/${GROUP_FOR_CASHBOX}`, {
    name: "Grupo Cashbox",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "Grupo para cashbox",
    member_count: 2,
  });
  await seedDoc(testEnv, `groups/${GROUP_FOR_CASHBOX}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_FOR_CASHBOX}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
    status: "ACTIVE",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA — grupos
// ============================================================

describe("groups — leitura", () => {
  it("Qualquer autenticado pode ler grupo público", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`groups/${GROUP_PUBLIC}`).get());
  });

  it("Owner pode ler grupo privado", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`groups/${GROUP_PRIVATE}`).get());
  });

  it("Não-membro NÃO pode ler grupo privado", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`groups/${GROUP_PRIVATE}`).get());
  });

  // FIX issue #511: isAdmin() agora incluido no bloco de visibilidade da rule.
  // Admin pode ler qualquer grupo (publico, privado, soft-deleted) para suporte/recuperacao.
  it("Admin pode ler grupo privado mesmo sem ser membro", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`groups/${GROUP_PRIVATE}`).get());
  });

  it("Não-autenticado NÃO pode ler grupos", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`groups/${GROUP_PUBLIC}`).get());
  });
});

// ============================================================
// LEITURA — members (subcoleção) — #1035
// ============================================================

describe("groups/members — leitura", () => {
  it("Membro pode ler membros do próprio grupo", async () => {
    // PlayerB é membro de GROUP_PUBLIC
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`groups/${GROUP_PUBLIC}/members/${UID_PLAYER_A}`).get());
  });

  it("Admin pode ler membros de qualquer grupo", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`groups/${GROUP_PUBLIC}/members/${UID_PLAYER_A}`).get());
  });

  it("Não-membro NÃO pode ler membros de grupo alheio (#1035)", async () => {
    // PlayerC não é membro de GROUP_PUBLIC
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`groups/${GROUP_PUBLIC}/members/${UID_PLAYER_A}`).get());
  });

  it("Não-autenticado NÃO pode ler membros", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`groups/${GROUP_PUBLIC}/members/${UID_PLAYER_A}`).get());
  });
});

// ============================================================
// ATUALIZAÇÃO — grupos
// ============================================================

describe("groups — atualização", () => {
  it("Owner pode atualizar nome e descrição do grupo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        name: "Grupo Público Atualizado",
        description: "Nova descrição",
      })
    );
  });

  it("Admin pode atualizar qualquer grupo", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_PUBLIC}`).update({ name: "Admin Changed" })
    );
  });

  it("Membro simples NÃO pode atualizar nome do grupo", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_PUBLIC}`).update({ name: "Invasão" })
    );
  });

  it("Não-autenticado NÃO pode atualizar grupo", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_PUBLIC}`).update({ name: "Anon" })
    );
  });

  // ==========================================
  // FIX issue #515: updates parciais (sem name/description no payload)
  // Antes do fix, qualquer update sem name+description falhava porque
  // a rule exigia validacao mesmo quando o campo nao era alterado.
  // ==========================================

  it("Owner pode atualizar SOMENTE photo_url (sem mexer em name/description)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        photo_url: "https://cdn.example.com/photo.jpg",
        updated_at: new Date(),
      })
    );
  });

  it("Owner pode toggle is_public sem alterar nome", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        is_public: false,
        type: "PRIVATE",
        updated_at: new Date(),
      })
    );
  });

  it("Owner pode atualizar SOMENTE description", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        description: "Apenas a descricao",
        updated_at: new Date(),
      })
    );
  });

  it("Grupo legacy SEM campo description: owner pode atualizar nome (sem o description undefined quebrar)", async () => {
    // Cenario real do bug: grupo criado antes da rule existir, sem campo description.
    await seedDoc(testEnv, "groups/legacy-no-desc", {
      name: "Grupo Legacy",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "ACTIVE",
      // INTENCIONAL: sem campo `description`
    });

    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("groups/legacy-no-desc").update({
        name: "Grupo Legacy Atualizado",
        updated_at: new Date(),
      })
    );
  });

  it("Grupo legacy: owner pode atualizar SOMENTE photo_url (description undefined nao deve falhar)", async () => {
    await seedDoc(testEnv, "groups/legacy-no-desc-2", {
      name: "Outro Legacy",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "ACTIVE",
    });

    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("groups/legacy-no-desc-2").update({
        photo_url: "https://x.com/foto.png",
        updated_at: new Date(),
      })
    );
  });

  it("Owner com name vazio (length < 3) é rejeitado", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        name: "AB",
        updated_at: new Date(),
      })
    );
  });

  it("Owner com name > 50 caracteres é rejeitado", async () => {
    const db = asPlayerA(testEnv);
    const longName = "A".repeat(51);
    await assertFails(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        name: longName,
        updated_at: new Date(),
      })
    );
  });

  it("Owner com description > 500 caracteres é rejeitado", async () => {
    const db = asPlayerA(testEnv);
    const longDesc = "x".repeat(501);
    await assertFails(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        description: longDesc,
        updated_at: new Date(),
      })
    );
  });
});

// ============================================================
// DELEÇÃO — grupos
// ============================================================

describe("groups — deleção", () => {
  // Issue #516: owner NAO pode mais hard-delete. Soft delete via update
  // (set deleted_at) e o caminho correto. Hard delete fica reservado
  // para ADMIN (cleanup/recovery final).
  it("Owner NAO pode hard-delete (deve usar soft delete via update)", async () => {
    await seedDoc(testEnv, "groups/group-owner-hard-delete-blocked", {
      name: "Tentativa Hard Delete",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "ACTIVE",
      description: "",
    });
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("groups/group-owner-hard-delete-blocked").delete()
    );
  });

  it("Owner pode SOFT delete via update (set deleted_at + deleted_by)", async () => {
    await seedDoc(testEnv, "groups/group-soft-delete", {
      name: "Para Soft Deletar",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "ACTIVE",
      description: "",
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("groups/group-soft-delete").update({
        deleted_at: new Date(),
        deleted_by: UID_PLAYER_A,
        status: "DELETED",
        updated_at: new Date(),
      })
    );
  });

  it("Admin pode RESTAURAR grupo soft-deletado (clear deleted_at)", async () => {
    await seedDoc(testEnv, "groups/group-soft-deleted-for-restore", {
      name: "Soft Deleted",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "DELETED",
      description: "",
      deleted_at: new Date(),
      deleted_by: UID_PLAYER_A,
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("groups/group-soft-deleted-for-restore").update({
        deleted_at: null,
        status: "ACTIVE",
        updated_at: new Date(),
      })
    );
  });

  it("Membro simples NÃO pode deletar grupo", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`groups/${GROUP_PUBLIC}`).delete());
  });

  it("Admin pode deletar qualquer grupo", async () => {
    await seedDoc(testEnv, "groups/group-admin-delete", {
      name: "Admin Delete",
      owner_id: UID_PLAYER_B,
      is_public: true,
      status: "ACTIVE",
      description: "",
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("groups/group-admin-delete").delete());
  });
});

// ============================================================
// CASHBOX — subcoleção groups/{groupId}/cashbox
// ============================================================

describe("groups/cashbox — permissões", () => {
  it("Membro do grupo pode ler cashbox", async () => {
    await seedDoc(testEnv, `groups/${GROUP_FOR_CASHBOX}/cashbox/entry-001`, {
      type: "INCOME",
      amount: 50,
      status: "ACTIVE",
      created_at: new Date(),
    });
    const db = asPlayerB(testEnv); // member
    await assertSucceeds(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-001`).get()
    );
  });

  it("Não-membro NÃO pode ler cashbox", async () => {
    const db = asPlayerC(testEnv); // não é membro
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-001`).get()
    );
  });

  it("Group admin (owner) pode criar entrada de cashbox", async () => {
    const db = asPlayerA(testEnv); // owner = group admin
    await assertSucceeds(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-new`).set({
        type: "INCOME",
        amount: 100,
        description: "Mensalidade",
        category: "MONTHLY_FEE",
        status: "ACTIVE",
        created_at: new Date(),
      })
    );
  });

  it("Membro simples NÃO pode criar entrada de cashbox", async () => {
    const db = asPlayerB(testEnv); // MEMBER, não admin
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-member-hack`).set({
        type: "INCOME",
        amount: 50,
        status: "ACTIVE",
        created_at: new Date(),
      })
    );
  });

  it("Cashbox NÃO permite deleção (delete=false nas rules)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-001`).delete()
    );
  });

  it("Não-autenticado NÃO pode acessar cashbox", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-001`).get()
    );
  });

  it("Valor de cashbox > 100000 é rejeitado", async () => {
    const db = asPlayerA(testEnv); // owner
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-huge`).set({
        type: "INCOME",
        amount: 200000, // acima do limite
        status: "ACTIVE",
        created_at: new Date(),
      })
    );
  });

  it("Cashbox com amount=0 é rejeitado (deve ser > 0)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-zero`).set({
        type: "EXPENSE",
        amount: 0, // inválido
        status: "ACTIVE",
        created_at: new Date(),
      })
    );
  });
});
