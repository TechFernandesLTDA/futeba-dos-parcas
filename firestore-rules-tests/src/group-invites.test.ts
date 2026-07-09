/**
 * Testes de Firestore Security Rules — Coleção: group_invites
 *
 * Regras (firestore.rules, linha 1162):
 * - read: destinatário, remetente ou admin do grupo
 * - create: remetente == caller + owner_id do grupo
 * - update: destinatário ou remetente
 * - delete: remetente ou canManageInvites
 *
 * Cobre:
 * - Apenas dono do grupo pode criar invite
 * - MEMBER simples NÃO pode criar invite
 * - Destinatário pode ler/atualizar próprio invite
 * - Player aleatório NÃO tem acesso
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

// IDs
const INVITE_GROUP = "group-for-invites-001";
const INVITE_A_TO_C = "invite-a-to-c-001"; // player A (OWNER) convida player C

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Grupo: player A é OWNER, player B é MEMBER
  await seedDoc(testEnv, `groups/${INVITE_GROUP}`, {
    name: "Grupo de Convites",
    owner_id: UID_PLAYER_A,
    is_public: false,
    status: "ACTIVE",
    description: "Teste de invites",
  });
  await seedDoc(testEnv, `groups/${INVITE_GROUP}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${INVITE_GROUP}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${INVITE_GROUP}/members/${UID_ADMIN}`, {
    user_id: UID_ADMIN,
    role: "ADMIN",
    status: "ACTIVE",
  });

  // Invite de A para C (seed direto)
  await seedDoc(testEnv, `group_invites/${INVITE_A_TO_C}`, {
    group_id: INVITE_GROUP,
    invited_by_id: UID_PLAYER_A,
    invited_user_id: UID_PLAYER_C,
    status: "PENDING",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA (READ)
// ============================================================

describe("group_invites — leitura", () => {
  it("Destinatário do invite pode ler o próprio invite", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(db.doc(`group_invites/${INVITE_A_TO_C}`).get());
  });

  it("Remetente do invite pode ler o invite enviado", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`group_invites/${INVITE_A_TO_C}`).get());
  });

  it("Player aleatório (não destinatário, não remetente, não admin do grupo) NÃO pode ler", async () => {
    // Player B é member do grupo mas não é destinatário nem remetente
    // canManageInvites(groupId) verifica role OWNER ou ADMIN
    // Player B é MEMBER — não passa
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`group_invites/${INVITE_A_TO_C}`).get());
  });

  it("Não-autenticado NÃO pode ler invite", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`group_invites/${INVITE_A_TO_C}`).get());
  });
});

// ============================================================
// CRIAÇÃO (CREATE)
// ============================================================

describe("group_invites — criação", () => {
  it("Dono do grupo pode criar invite", async () => {
    const db = asPlayerA(testEnv);
	    await assertSucceeds(
	      db.doc("group_invites/invite-a-creates").set({
	        group_id: INVITE_GROUP,
	        group_name: "Grupo de Convites",
	        invited_by_id: UID_PLAYER_A,
	        invited_user_id: UID_PLAYER_C,
	        invited_user_name: "Jogador C",
	        status: "PENDING",
	        created_at: new Date(),
	        updated_at: new Date(),
	        expires_at: new Date(Date.now() + 60_000),
	      })
	    );
	  });

  it("Administrador do grupo NÃO pode criar invite", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("group_invites/invite-admin-denied").set({
        group_id: INVITE_GROUP,
        group_name: "Grupo de Convites",
        invited_by_id: UID_ADMIN,
        invited_user_id: UID_PLAYER_C,
        invited_user_name: "Jogador C",
        status: "PENDING",
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
      })
    );
  });

  it("Owner legado pelo owner_id pode criar invite mesmo sem member doc", async () => {
    const legacyGroup = "group-legacy-owner-invites";
    await seedDoc(testEnv, `groups/${legacyGroup}`, {
      name: "Grupo legado",
      owner_id: UID_PLAYER_C,
      is_public: false,
      status: "ACTIVE",
    });

    const db = asPlayerC(testEnv);
	    await assertSucceeds(
	      db.doc("group_invites/invite-legacy-owner-creates").set({
	        group_id: legacyGroup,
	        group_name: "Grupo legado",
	        invited_by_id: UID_PLAYER_C,
	        invited_user_id: UID_PLAYER_B,
	        invited_user_name: "Jogador B",
	        status: "PENDING",
	        created_at: new Date(),
	        updated_at: new Date(),
	        expires_at: new Date(Date.now() + 60_000),
	      })
	    );
	  });

	  it("NÃO permite criar invite sem expires_at", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("group_invites/invite-missing-expiry").set({
	        group_id: INVITE_GROUP,
	        group_name: "Grupo de Convites",
	        invited_by_id: UID_PLAYER_A,
	        invited_user_id: UID_PLAYER_C,
	        invited_user_name: "Jogador C",
	        status: "PENDING",
	        created_at: new Date(),
	        updated_at: new Date(),
	      })
	    );
	  });

	  it("NÃO permite auto-convite", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("group_invites/invite-self").set({
	        group_id: INVITE_GROUP,
	        group_name: "Grupo de Convites",
	        invited_by_id: UID_PLAYER_A,
	        invited_user_id: UID_PLAYER_A,
	        invited_user_name: "Jogador A",
	        status: "PENDING",
	        created_at: new Date(),
	        updated_at: new Date(),
	        expires_at: new Date(Date.now() + 60_000),
	      })
	    );
	  });

  it("Membro simples (MEMBER) NÃO pode criar invite", async () => {
    const db = asPlayerB(testEnv); // role MEMBER
    await assertFails(
      db.doc("group_invites/invite-b-hack").set({
        group_id: INVITE_GROUP,
        invited_by_id: UID_PLAYER_B,
        invited_user_id: UID_PLAYER_C,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Player NÃO pode criar invite com invited_by_id de outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("group_invites/invite-fraud-sender").set({
        group_id: INVITE_GROUP,
        invited_by_id: UID_PLAYER_B, // falsificação do remetente
        invited_user_id: UID_PLAYER_C,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar invite", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("group_invites/invite-anon").set({
        group_id: INVITE_GROUP,
        invited_by_id: "anon",
        invited_user_id: UID_PLAYER_C,
        status: "PENDING",
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO (UPDATE)
// ============================================================

describe("group_invites — atualização", () => {
  it("Destinatário pode atualizar o invite (ex: aceitar)", async () => {
    await seedDoc(testEnv, "group_invites/invite-accept-success", {
      group_id: INVITE_GROUP,
      invited_by_id: UID_PLAYER_A,
      invited_user_id: UID_PLAYER_C,
      status: "PENDING",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 60_000),
    });
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc("group_invites/invite-accept-success").update({ status: "ACCEPTED" })
    );
  });

  it("Remetente pode atualizar o invite", async () => {
    await seedDoc(testEnv, "group_invites/invite-cancel-success", {
      group_id: INVITE_GROUP,
      invited_by_id: UID_PLAYER_A,
      invited_user_id: UID_PLAYER_C,
      status: "PENDING",
      created_at: new Date(),
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("group_invites/invite-cancel-success").update({ status: "CANCELLED" })
    );
  });

  it("Destinatário NÃO pode aceitar invite expirado", async () => {
    await seedDoc(testEnv, "group_invites/invite-expired-accept", {
      group_id: INVITE_GROUP,
      invited_by_id: UID_PLAYER_A,
      invited_user_id: UID_PLAYER_C,
      status: "PENDING",
      created_at: new Date(Date.now() - 120_000),
      expires_at: new Date(Date.now() - 60_000),
    });

    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("group_invites/invite-expired-accept").update({ status: "ACCEPTED" })
    );
  });

  it("Destinatário NÃO pode reabrir invite já cancelado", async () => {
    await seedDoc(testEnv, "group_invites/invite-cancelled-reopen", {
      group_id: INVITE_GROUP,
      invited_by_id: UID_PLAYER_A,
      invited_user_id: UID_PLAYER_C,
      status: "CANCELLED",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 60_000),
    });

    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("group_invites/invite-cancelled-reopen").update({ status: "ACCEPTED" })
    );
  });

  it("Não-membro/não-remetente/não-destinatário NÃO pode atualizar invite", async () => {
    // Admin não é explicitamente autorizado no update — apenas destinatário e remetente
    // rule: allow update: if isAuthenticated() && (resource.data.invited_user_id == userId() || resource.data.invited_by_id == userId())
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`group_invites/${INVITE_A_TO_C}`).update({ status: "REJECTED" })
    );
  });

  // ============================================================
  // FIX #577: Field-restriction tests
  // Antes: invitee podia overwrite group_id/invited_by_id arbitrariamente
  // ============================================================
  it("FIX #577: Destinatário NÃO pode pivotar invite pra outro grupo", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`group_invites/${INVITE_A_TO_C}`).update({
        status: "ACCEPTED",
        group_id: "outro-grupo-arbitrario",
      })
    );
  });

  it("FIX #577: Destinatário NÃO pode mudar invited_by_id", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`group_invites/${INVITE_A_TO_C}`).update({
        status: "ACCEPTED",
        invited_by_id: UID_PLAYER_C, // tenta se atribuir como inviter
      })
    );
  });

  it("FIX #577: Destinatário NÃO pode CANCELLED (só inviter pode)", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`group_invites/${INVITE_A_TO_C}`).update({ status: "CANCELLED" })
    );
  });

  it("FIX #577: Destinatário NÃO pode setar status arbitrário (ex: APPROVED_PARALLEL)", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`group_invites/${INVITE_A_TO_C}`).update({ status: "APPROVED_PARALLEL" })
    );
  });
});

// ============================================================
// DELEÇÃO (DELETE)
// ============================================================

describe("group_invites — deleção", () => {
  it("Remetente pode deletar o invite", async () => {
    await seedDoc(testEnv, "group_invites/invite-for-delete", {
      group_id: INVITE_GROUP,
      invited_by_id: UID_PLAYER_A,
      invited_user_id: UID_PLAYER_C,
      status: "PENDING",
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc("group_invites/invite-for-delete").delete());
  });

  it("Destinatário NÃO pode deletar invite (apenas remetente ou group admin)", async () => {
    await seedDoc(testEnv, "group_invites/invite-dest-delete-test", {
      group_id: INVITE_GROUP,
      invited_by_id: UID_PLAYER_A,
      invited_user_id: UID_PLAYER_C,
      status: "PENDING",
    });
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("group_invites/invite-dest-delete-test").delete()
    );
  });
});
