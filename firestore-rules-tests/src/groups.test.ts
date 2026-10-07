/**
 * Testes de Firestore Security Rules — Coleção: groups + cashbox
 *
 * Cobre:
 * - groups: owner/admin edita, member só lê, não-member negado
 * - groups/members: subcoleção de membros
 * - groups/cashbox: member autorizado lê; writes são somente via callable/Admin SDK
 * - Não-autenticado: negado em tudo
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
  asUser,
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
const GROUP_MEMBER_SECURITY = "group-member-security";
const GROUP_BLOCKED_REJOIN = "group-blocked-rejoin";
const GROUP_CORRUPT_MEMBER = "group-corrupt-member";
const UID_MEMBERSHIP_OUTSIDER = "uid-membership-outsider";

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

  await seedDoc(testEnv, `groups/${GROUP_MEMBER_SECURITY}`, {
    name: "Segurança de membros",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_MEMBER_SECURITY}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_MEMBER_SECURITY}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "ADMIN",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_MEMBER_SECURITY}/members/${UID_MEMBERSHIP_OUTSIDER}`, {
    user_id: UID_MEMBERSHIP_OUTSIDER,
    role: "MEMBER",
    status: "BANNED",
  });

  await seedDoc(testEnv, `groups/${GROUP_BLOCKED_REJOIN}`, {
    name: "Bloqueio persistente",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_BLOCKED_REJOIN}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_BLOCKED_REJOIN}/blocked_players/${UID_MEMBERSHIP_OUTSIDER}`, {
    user_id: UID_MEMBERSHIP_OUTSIDER,
    blocked_by: UID_PLAYER_A,
    user_name: "Outsider",
    reason: "Banimento de teste",
  });

  await seedDoc(testEnv, `groups/${GROUP_CORRUPT_MEMBER}`, {
    name: "Vínculo corrompido",
    owner_id: UID_PLAYER_A,
    is_public: false,
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_CORRUPT_MEMBER}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_CORRUPT_MEMBER}/members/${UID_MEMBERSHIP_OUTSIDER}`, {
    user_id: UID_PLAYER_B,
    role: "ADMIN",
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

describe("groups — criação e contador server-authoritative", () => {
  const validGroup = (overrides: Record<string, unknown> = {}) => ({
    name: "Novo Grupo Seguro",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "Grupo criado nos testes de segurança",
    ...overrides,
  });

  it("permite criar com contador zero ou omitido", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("groups/group-create-counter-zero").set(
        validGroup({member_count: 0})
      )
    );
    await assertSucceeds(
      db.doc("groups/group-create-counter-omitted").set(validGroup())
    );
  });

  it("rejeita contador positivo ou negativo controlado pelo cliente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("groups/group-create-counter-five").set(
        validGroup({member_count: 5})
      )
    );
    await assertFails(
      db.doc("groups/group-create-counter-negative").set(
        validGroup({member_count: -1})
      )
    );
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

describe("groups/members — invariantes de identidade e saída", () => {
  it("vínculo com user_id divergente NÃO concede membership nem administração", async () => {
    const db = asUser(testEnv, UID_MEMBERSHIP_OUTSIDER);
    await assertFails(db.doc(`groups/${GROUP_CORRUPT_MEMBER}`).get());
    await assertFails(
      db.doc(`groups/${GROUP_CORRUPT_MEMBER}`).update({name: "Tomada de grupo"})
    );
  });

  it("admin do grupo NÃO pode criar membro com memberId divergente do user_id", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_MEMBER_SECURITY}/members/uid-path-target`).set({
        user_id: UID_MEMBERSHIP_OUTSIDER,
        role: "MEMBER",
        status: "ACTIVE",
      })
    );
  });

  it("admin do grupo NÃO pode remover o vínculo do owner atual", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_MEMBER_SECURITY}/members/${UID_PLAYER_A}`).delete()
    );
  });

  it("owner atual NÃO pode apagar o próprio vínculo antes de transferir", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_MEMBER_SECURITY}/members/${UID_PLAYER_A}`).delete()
    );
  });

  it("usuário BANNED NÃO pode apagar o vínculo e contornar o ban", async () => {
    const db = asUser(testEnv, UID_MEMBERSHIP_OUTSIDER);
    await assertFails(
      db.doc(`groups/${GROUP_MEMBER_SECURITY}/members/${UID_MEMBERSHIP_OUTSIDER}`).delete()
    );
  });

  it("usuário em blocked_players NÃO pode recriar membership em grupo público", async () => {
    const db = asUser(testEnv, UID_MEMBERSHIP_OUTSIDER);
    await assertFails(
      db.doc(`groups/${GROUP_BLOCKED_REJOIN}/members/${UID_MEMBERSHIP_OUTSIDER}`).set({
        user_id: UID_MEMBERSHIP_OUTSIDER,
        role: "MEMBER",
        status: "ACTIVE",
      })
    );
  });

  it("membro ativo comum ainda pode sair do grupo", async () => {
    const uid = "uid-member-can-leave";
    await seedDoc(testEnv, `groups/${GROUP_MEMBER_SECURITY}/members/${uid}`, {
      user_id: uid,
      role: "MEMBER",
      status: "ACTIVE",
    });
    await assertSucceeds(
      asUser(testEnv, uid).doc(`groups/${GROUP_MEMBER_SECURITY}/members/${uid}`).delete()
    );
  });
});

// ============================================================
// BLOCKED_PLAYERS — leitura do próprio doc
// O fluxo de entrada por convite (#3391) e o self-create em grupo
// público (#2153) leem blocked_players/{self} ANTES de haver
// membership — a rule precisa permitir read do próprio doc.
// ============================================================

describe("groups/blocked_players — leitura do próprio doc", () => {
  it("não-membro PODE ler o PRÓPRIO doc (inexistente) em blocked_players", async () => {
    // Read de doc inexistente ainda avalia a rule — é o caso da
    // transação de join para quem NUNCA foi bloqueado.
    await assertSucceeds(
      asPlayerC(testEnv)
        .doc(`groups/${GROUP_PUBLIC}/blocked_players/${UID_PLAYER_C}`)
        .get()
    );
  });

  it("não-membro bloqueado PODE ler o próprio doc em blocked_players", async () => {
    await assertSucceeds(
      asUser(testEnv, UID_MEMBERSHIP_OUTSIDER)
        .doc(`groups/${GROUP_BLOCKED_REJOIN}/blocked_players/${UID_MEMBERSHIP_OUTSIDER}`)
        .get()
    );
  });

  it("não-membro NÃO pode ler doc de OUTRO jogador em blocked_players", async () => {
    await assertFails(
      asPlayerC(testEnv)
        .doc(`groups/${GROUP_PUBLIC}/blocked_players/${UID_MEMBERSHIP_OUTSIDER}`)
        .get()
    );
  });

  it("membro do grupo continua podendo ler blocked_players", async () => {
    await assertSucceeds(
      asPlayerA(testEnv)
        .doc(`groups/${GROUP_BLOCKED_REJOIN}/blocked_players/${UID_MEMBERSHIP_OUTSIDER}`)
        .get()
    );
  });

  it("não-autenticado NÃO lê blocked_players", async () => {
    await assertFails(
      asAnon(testEnv)
        .doc(`groups/${GROUP_BLOCKED_REJOIN}/blocked_players/${UID_MEMBERSHIP_OUTSIDER}`)
        .get()
    );
  });
});

// ============================================================
// PAPÉIS E OWNERSHIP — #3589, #3592, #3601
// ============================================================

describe("groups/members — papéis e ownership atômico", () => {
  async function seedRoleGroup(
    groupId: string,
    playerBRole: "MEMBER" | "ADMIN" = "MEMBER",
    playerCRole: "MEMBER" | "ADMIN" = "MEMBER"
  ) {
    await seedDoc(testEnv, `groups/${groupId}`, {
      name: "Grupo de papéis",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "ACTIVE",
      description: "Fixture isolada para gestão de papéis",
      member_count: 3,
    });
    await seedDoc(testEnv, `groups/${groupId}/members/${UID_PLAYER_A}`, {
      user_id: UID_PLAYER_A,
      role: "OWNER",
      status: "ACTIVE",
    });
    await seedDoc(testEnv, `groups/${groupId}/members/${UID_PLAYER_B}`, {
      user_id: UID_PLAYER_B,
      role: playerBRole,
      status: "ACTIVE",
    });
    await seedDoc(testEnv, `groups/${groupId}/members/${UID_PLAYER_C}`, {
      user_id: UID_PLAYER_C,
      role: playerCRole,
      status: "ACTIVE",
    });
  }

  it("OWNER pode promover MEMBER para ADMIN", async () => {
    const groupId = "group-role-promote-3589";
    await seedRoleGroup(groupId);

    await assertSucceeds(
      asPlayerA(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_B}`)
        .update({role: "ADMIN"})
    );
  });

  it("OWNER pode rebaixar ADMIN para MEMBER", async () => {
    const groupId = "group-role-demote-3589";
    await seedRoleGroup(groupId, "ADMIN");

    await assertSucceeds(
      asPlayerA(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_B}`)
        .update({role: "MEMBER"})
    );
  });

  it("transfere ownership apenas com grupo, novo OWNER e antigo OWNER no mesmo batch", async () => {
    const groupId = "group-role-transfer-3601";
    await seedRoleGroup(groupId);
    await seedDoc(testEnv, `users/${UID_PLAYER_A}/groups/${groupId}`, {
      role: "OWNER",
      group_name: "Grupo de papéis",
    });
    await seedDoc(testEnv, `users/${UID_PLAYER_B}/groups/${groupId}`, {
      role: "MEMBER",
      group_name: "Grupo de papéis",
    });
    const db = asPlayerA(testEnv);
    const batch = db.batch();
    batch.update(db.doc(`groups/${groupId}`), {
      owner_id: UID_PLAYER_B,
      owner_name: "Player B",
    });
    batch.update(db.doc(`groups/${groupId}/members/${UID_PLAYER_A}`), {role: "ADMIN"});
    batch.update(db.doc(`users/${UID_PLAYER_A}/groups/${groupId}`), {role: "ADMIN"});
    batch.update(db.doc(`groups/${groupId}/members/${UID_PLAYER_B}`), {role: "OWNER"});
    batch.update(db.doc(`users/${UID_PLAYER_B}/groups/${groupId}`), {role: "OWNER"});

    await assertSucceeds(batch.commit());
  });

  it("NÃO permite trocar owner_id sem atualizar os dois memberships", async () => {
    const groupId = "group-role-owner-id-only-3601";
    await seedRoleGroup(groupId);

    await assertFails(
      asPlayerA(testEnv).doc(`groups/${groupId}`).update({owner_id: UID_PLAYER_B})
    );
  });

  it("ADMIN global NÃO pode pivotar owner_id isoladamente pelo cliente", async () => {
    const groupId = "group-role-global-admin-owner-pivot-3601";
    await seedRoleGroup(groupId);

    await assertFails(
      asAdmin(testEnv).doc(`groups/${groupId}`).update({owner_id: UID_PLAYER_B})
    );
  });

  it("NÃO permite transferência parcial que mantém o antigo OWNER", async () => {
    const groupId = "group-role-old-owner-stays-3601";
    await seedRoleGroup(groupId);
    const db = asPlayerA(testEnv);
    const batch = db.batch();
    batch.update(db.doc(`groups/${groupId}`), {owner_id: UID_PLAYER_B});
    batch.update(db.doc(`groups/${groupId}/members/${UID_PLAYER_B}`), {role: "OWNER"});

    await assertFails(batch.commit());
  });

  it("NÃO permite transferência parcial sem promover o novo OWNER", async () => {
    const groupId = "group-role-new-owner-stays-member-3601";
    await seedRoleGroup(groupId);
    const db = asPlayerA(testEnv);
    const batch = db.batch();
    batch.update(db.doc(`groups/${groupId}`), {owner_id: UID_PLAYER_B});
    batch.update(db.doc(`groups/${groupId}/members/${UID_PLAYER_A}`), {role: "ADMIN"});

    await assertFails(batch.commit());
  });

  it("NÃO permite criar segundo OWNER sem transferir owner_id", async () => {
    const groupId = "group-role-second-owner-3601";
    await seedRoleGroup(groupId);

    await assertFails(
      asPlayerA(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_B}`)
        .update({role: "OWNER"})
    );
  });

  it("NÃO permite ao OWNER se rebaixar sem transferir owner_id", async () => {
    const groupId = "group-role-owner-self-demote-3601";
    await seedRoleGroup(groupId);

    await assertFails(
      asPlayerA(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_A}`)
        .update({role: "ADMIN"})
    );
  });

  it("MEMBER NÃO pode se autoelevar para ADMIN", async () => {
    const groupId = "group-role-self-elevation-3589";
    await seedRoleGroup(groupId);

    await assertFails(
      asPlayerB(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_B}`)
        .update({role: "ADMIN"})
    );
  });

  it("ADMIN não-owner pode remover MEMBER comum", async () => {
    const groupId = "group-role-admin-removes-member-3592";
    await seedRoleGroup(groupId, "ADMIN", "MEMBER");

    await assertSucceeds(
      asPlayerB(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_C}`)
        .update({status: "REMOVED"})
    );
  });

  it("ADMIN não-owner NÃO pode remover outro ADMIN", async () => {
    const groupId = "group-role-admin-removes-admin-3592";
    await seedRoleGroup(groupId, "ADMIN", "ADMIN");

    await assertFails(
      asPlayerB(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_C}`)
        .update({status: "REMOVED"})
    );
  });

  it("ADMIN não-owner NÃO pode remover o OWNER", async () => {
    const groupId = "group-role-admin-removes-owner-3592";
    await seedRoleGroup(groupId, "ADMIN");

    await assertFails(
      asPlayerB(testEnv)
        .doc(`groups/${groupId}/members/${UID_PLAYER_A}`)
        .update({status: "REMOVED"})
    );
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

  // Fase 4b: default_gender do grupo (mesmo conjunto válido do jogo).
  it("Owner pode definir default_gender válido (MALE)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        default_gender: "MALE",
        updated_at: new Date(),
      })
    );
  });

  it("Owner NÃO pode definir default_gender inválido (OTHER)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_PUBLIC}`).update({
        default_gender: "OTHER", // inválido
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

  it("Group admin (owner) NÃO pode criar entrada diretamente", async () => {
    const db = asPlayerA(testEnv); // owner = group admin
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-new`).set({
        group_id: GROUP_FOR_CASHBOX,
        type: "INCOME",
        amount: 100,
        description: "Mensalidade",
        category: "MONTHLY_FEE",
        status: "ACTIVE",
        created_by: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("Admin global NÃO pode criar entrada diretamente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-admin-direct`).set({
        group_id: GROUP_FOR_CASHBOX,
        type: "INCOME",
        amount: 100,
        description: "Tentativa admin direta",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_ADMIN,
        created_at: serverTimestamp(),
      })
    );
  });

  it("Membro simples NÃO pode criar entrada de cashbox", async () => {
    const db = asPlayerB(testEnv); // MEMBER, não admin
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-member-hack`).set({
        group_id: GROUP_FOR_CASHBOX,
        type: "INCOME",
        amount: 50,
        description: "Tentativa indevida",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_PLAYER_B,
        created_at: serverTimestamp(),
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
        group_id: GROUP_FOR_CASHBOX,
        type: "INCOME",
        amount: 200000, // acima do limite
        description: "Valor alto",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("Cashbox com amount=0 é rejeitado (deve ser > 0)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`groups/${GROUP_FOR_CASHBOX}/cashbox/entry-zero`).set({
        group_id: GROUP_FOR_CASHBOX,
        type: "EXPENSE",
        amount: 0, // inválido
        description: "Valor zero",
        category: "OTHER",
        status: "ACTIVE",
        created_by: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });
});

// ============================================================
// DESCOBRIR GRUPOS — list query de grupos públicos (#2522)
// ============================================================
//
// Contexto do bug (#2522):
// A tela "Descobrir Grupos" no web faz uma LIST query:
//   query(groups, where('is_public','==',true), orderBy('created_at','desc'), limit(100))
// Num list query, o Firestore avalia a read-rule contra CADA doc retornado e
// NEGA a query INTEIRA se qualquer doc não satisfaz a rule (não há "skip").
//
// A read-rule antiga tinha 3 cláusulas ANDed, sendo que:
//   - cláusula de deleted_at (gate de soft-delete)
//   - cláusula isGroupActive(groupId) — get()-based (status == 'ACTIVE')
// NÃO são satisfeitas pela query (que só filtra is_public==true). Assim, quando
// um grupo público no top-100 está SUSPENDED/ARCHIVED ou soft-deleted, a
// discovery quebrava com PERMISSION_DENIED para TODO MUNDO (bug data-dependente).
//
// Fix (#2522): o ramo PÚBLICO da read-rule virou satisfazível por list query —
// sem get() e sem gate de deleted_at (o cliente já filtra deleted/DELETED após
// o fetch). Os gates estritos (deleted_at + isGroupActive + membership) ficam
// APENAS no ramo PRIVADO. Não-regressão de #511/#1035 (privado alheio segue
// protegido) coberta abaixo.
describe("groups — descobrir (list query pública #2522)", () => {
  const GROUP_PUB_SUSPENDED = "group-pub-suspended-2522";
  const GROUP_PUB_SOFT_DELETED = "group-pub-softdel-2522";
  const GROUP_PRIV_SOFT_DELETED = "group-priv-softdel-2522";

  beforeAll(async () => {
    // Grupo PÚBLICO porém SUSPENDED — quebra cláusula isGroupActive() no list
    await seedDoc(testEnv, `groups/${GROUP_PUB_SUSPENDED}`, {
      name: "Público Suspenso",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "SUSPENDED",
      description: "Grupo público mas suspenso",
      member_count: 1,
    });
    // Grupo PÚBLICO porém soft-deleted — quebra cláusula deleted_at no list
    await seedDoc(testEnv, `groups/${GROUP_PUB_SOFT_DELETED}`, {
      name: "Público Soft-Deletado",
      owner_id: UID_PLAYER_A,
      is_public: true,
      status: "DELETED",
      description: "Grupo público soft-deletado",
      deleted_at: new Date(),
      deleted_by: UID_PLAYER_A,
      member_count: 1,
    });
    // Grupo PRIVADO soft-deleted — não deve vazar para não-membro
    await seedDoc(testEnv, `groups/${GROUP_PRIV_SOFT_DELETED}`, {
      name: "Privado Soft-Deletado",
      owner_id: UID_PLAYER_A,
      is_public: false,
      status: "DELETED",
      description: "Grupo privado soft-deletado",
      deleted_at: new Date(),
      deleted_by: UID_PLAYER_A,
      member_count: 1,
    });
  });

  // (a) DISCOVERY: a list query da tela "Descobrir Grupos" passa para um
  // não-membro autenticado MESMO com grupos públicos SUSPENDED/soft-deleted no
  // resultado. Antes do fix #2522 esta query falhava (PERMISSION_DENIED).
  it("Não-membro pode listar grupos públicos (discovery) mesmo com público suspenso/soft-deletado", async () => {
    const db = asPlayerC(testEnv); // PlayerC não é membro de nenhum grupo
    await assertSucceeds(
      db.collection("groups").where("is_public", "==", true).get()
    );
  });

  // (b) NÃO-REGRESSÃO (#511/#1035): grupo PRIVADO alheio NÃO é legível por
  // não-membro — single get.
  it("Não-membro NÃO pode ler grupo privado alheio (single get) — #511/#1035", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`groups/${GROUP_PRIVATE}`).get());
  });

  // (b') NÃO-REGRESSÃO: list query de grupos PRIVADOS por não-membro falha
  // (o ramo público da rule não cobre is_public==false).
  it("Não-membro NÃO pode listar grupos privados (list query)", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.collection("groups").where("is_public", "==", false).get()
    );
  });

  // (c) NÃO-REGRESSÃO: grupo PRIVADO soft-deleted não vaza para não-membro.
  it("Não-membro NÃO pode ler grupo privado soft-deletado", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(db.doc(`groups/${GROUP_PRIV_SOFT_DELETED}`).get());
  });

  // (d) Membro lê seu próprio grupo (público) normalmente — single get.
  it("Membro lê seu próprio grupo normalmente (single get)", async () => {
    const db = asPlayerB(testEnv); // membro de GROUP_PUBLIC
    await assertSucceeds(db.doc(`groups/${GROUP_PUBLIC}`).get());
  });

  // (d') Owner lê seu grupo PRIVADO normalmente.
  it("Owner lê seu grupo privado normalmente (single get)", async () => {
    const db = asPlayerA(testEnv); // owner de GROUP_PRIVATE
    await assertSucceeds(db.doc(`groups/${GROUP_PRIVATE}`).get());
  });

  // Qualquer autenticado pode ler um grupo público suspenso/soft-deletado via
  // single get (consistente com o ramo público da rule). O cliente filtra
  // estado pós-fetch; metadata de grupo público archived ser legível é o
  // tradeoff aceito (baixa sensibilidade — já era público).
  it("Qualquer autenticado pode ler grupo público suspenso (single get)", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`groups/${GROUP_PUB_SUSPENDED}`).get());
  });
});
