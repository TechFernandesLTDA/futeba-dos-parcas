/**
 * Testes de Firestore Security Rules — Colecao: invites
 *
 * Issue #514: collection invites usada pelo web pra codigos de convite
 * compartilhaveis (link /join/:code). Antes do fix, NAO tinha rule —
 * todas writes caiam no catch-all deny.
 *
 * Schema (web/src/hooks/useGroups.ts useInvitePlayers):
 * - code, group_id, group_name, inviter_id, inviter_name,
 *   created_at, expires_at, used
 *
 * Cobertura:
 * - Read: qualquer auth (lookup por code)
 * - Create: apenas group admin (role OWNER/ADMIN no grupo) com inviter_id == self
 * - Update: marcar used=true (qualquer auth, somente campos used/used_by/used_at)
 * - Delete: criador ou admin global
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

const GROUP_ID = "group-with-invites";
const VALID_INVITE = "invite-valid";
const USED_INVITE = "invite-used";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Seed: grupo onde Player A é OWNER, Player B é MEMBER, Player C nao membro
  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    name: "Grupo Convites",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
  });

  // Convite valido criado por Player A
  await seedDoc(testEnv, `invites/${VALID_INVITE}`, {
    code: "ABC123",
    group_id: GROUP_ID,
    group_name: "Grupo Convites",
    inviter_id: UID_PLAYER_A,
    inviter_name: "Player A",
    used: false,
    expires_at: new Date(Date.now() + 86400000),
  });

  // Convite ja usado
  await seedDoc(testEnv, `invites/${USED_INVITE}`, {
    code: "USED01",
    group_id: GROUP_ID,
    group_name: "Grupo Convites",
    inviter_id: UID_PLAYER_A,
    inviter_name: "Player A",
    used: true,
    used_by: UID_PLAYER_C,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// READ
// ============================================================

describe("invites — leitura", () => {
  it("Qualquer auth pode ler invite (lookup por code requer isso)", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(`invites/${VALID_INVITE}`).get());
    await assertSucceeds(asPlayerB(testEnv).doc(`invites/${VALID_INVITE}`).get());
    await assertSucceeds(asPlayerC(testEnv).doc(`invites/${VALID_INVITE}`).get());
    await assertSucceeds(asAdmin(testEnv).doc(`invites/${VALID_INVITE}`).get());
  });

  it("Nao-autenticado NAO pode ler invite", async () => {
    await assertFails(asAnon(testEnv).doc(`invites/${VALID_INVITE}`).get());
  });
});

// ============================================================
// CREATE
// ============================================================

describe("invites — criacao", () => {
  it("Group OWNER pode criar invite com inviter_id == self", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("invites/new-by-owner").set({
        code: "OWN001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Member SIMPLES (sem role admin) NAO pode criar invite", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc("invites/by-member").set({
        code: "MEM001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_B,
        inviter_name: "Player B",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Nao-membro NAO pode criar invite pra grupo", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("invites/by-stranger").set({
        code: "STR001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_C,
        inviter_name: "Player C",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Owner NAO pode criar invite com inviter_id de OUTRO usuario (spoof)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("invites/spoofed").set({
        code: "SPF001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_B, // tenta atribuir a outro
        inviter_name: "Spoofed",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Owner NAO pode criar invite ja marcado como usado", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("invites/already-used").set({
        code: "USD001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: true, // nao pode comecar usado
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });
});

// ============================================================
// UPDATE — marcar como usado
// ============================================================

describe("invites — uso (update)", () => {
  it("Qualquer auth pode marcar invite como usado (used=true + used_by + used_at)", async () => {
    await seedDoc(testEnv, "invites/to-use-1", {
      code: "USE001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });

    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc("invites/to-use-1").update({
        used: true,
        used_by: UID_PLAYER_C,
        used_at: new Date(),
      })
    );
  });

  it("NAO pode reusar invite ja usado", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`invites/${USED_INVITE}`).update({
        used: true,
        used_by: UID_PLAYER_B,
        used_at: new Date(),
      })
    );
  });

  it("NAO pode alterar campos alem de used/used_by/used_at", async () => {
    await seedDoc(testEnv, "invites/to-tamper", {
      code: "TMP001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });

    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("invites/to-tamper").update({
        group_id: "outro-grupo", // tenta redirecionar
        used: true,
        used_by: UID_PLAYER_C,
        used_at: new Date(),
      })
    );
  });
});

// ============================================================
// DELETE
// ============================================================

describe("invites — delecao", () => {
  it("Criador pode deletar proprio invite", async () => {
    await seedDoc(testEnv, "invites/to-delete-by-creator", {
      code: "DEL001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });
    await assertSucceeds(asPlayerA(testEnv).doc("invites/to-delete-by-creator").delete());
  });

  it("Admin global pode deletar qualquer invite", async () => {
    await seedDoc(testEnv, "invites/to-delete-by-admin", {
      code: "ADM001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });
    await assertSucceeds(asAdmin(testEnv).doc("invites/to-delete-by-admin").delete());
  });

  it("Player aleatorio NAO pode deletar invite alheio", async () => {
    await assertFails(asPlayerC(testEnv).doc(`invites/${VALID_INVITE}`).delete());
  });
});
