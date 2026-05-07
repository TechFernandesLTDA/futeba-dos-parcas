/**
 * Testes de Firestore Security Rules — sub-colecao: groups/{gid}/join_requests
 *
 * Issue #517 Phase 2 — Request to join em grupos publicos.
 *
 * Cobertura:
 * - Read: requester ve proprio, owner/admin ve todos, outros negados
 * - Create: nao-membro pede em publico; rejeita: privado, ja-membro, doc id != uid
 * - Update: owner/admin transiciona PENDING->APPROVED|REJECTED; rejeita: outros, transicoes invalidas
 * - Delete: requester ou owner/admin
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
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

// IDs unicos pra esta suite (evita colisao com outras suites em paralelo)
const GROUP_PUBLIC = "group-public-jr-suite";
const GROUP_PRIVATE = "group-private-jr-suite";
// Request docId varia por teste pra evitar conflito intra-suite
let testCounter = 0;

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Seed groups uma vez (compartilhados entre todos os testes)
  await seedDoc(testEnv, `groups/${GROUP_PUBLIC}`, {
    name: "Grupo Publico JR",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    member_count: 1,
  });
  await seedDoc(testEnv, `groups/${GROUP_PUBLIC}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });

  await seedDoc(testEnv, `groups/${GROUP_PRIVATE}`, {
    name: "Grupo Privado JR",
    owner_id: UID_PLAYER_A,
    is_public: false,
    status: "ACTIVE",
    member_count: 1,
  });
  await seedDoc(testEnv, `groups/${GROUP_PRIVATE}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// Limpa apenas a subcolecao de join_requests dos grupos desta suite,
// preservando dados de outras suites em paralelo.
async function cleanupJoinRequests() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const groupId of [GROUP_PUBLIC, GROUP_PRIVATE]) {
      const snap = await db.collection(`groups/${groupId}/join_requests`).get();
      for (const doc of snap.docs) {
        await doc.ref.delete();
      }
    }
  });
}

// ============================================================
// READ
// ============================================================
describe("join_requests — READ", () => {
  beforeEach(async () => {
    // Seed: playerB pediu entrada no grupo publico
    await seedDoc(testEnv, `groups/${GROUP_PUBLIC}/join_requests/${UID_PLAYER_B}`, {
      user_id: UID_PLAYER_B,
      user_name: "Player B",
      status: "PENDING",
      requested_at: new Date(),
    });
  });

  afterEach(cleanupJoinRequests);

  it("requester pode ler proprio request", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).get()
    );
  });

  it("owner do grupo pode ler request de qualquer requester", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).get()
    );
  });

  it("admin global pode ler request de qualquer requester", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).get()
    );
  });

  it("outro player nao pode ler request alheio", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).get()
    );
  });

  it("nao-autenticado e negado", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).get()
    );
  });
});

// ============================================================
// CREATE
// ============================================================
describe("join_requests — CREATE", () => {
  afterEach(cleanupJoinRequests);

  it("nao-membro pode criar request em grupo publico", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).set({
        user_id: UID_PLAYER_B,
        user_name: "Player B",
        status: "PENDING",
        requested_at: new Date(),
      })
    );
  });

  it("rejeita request em grupo PRIVADO", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PRIVATE}/join_requests`).doc(UID_PLAYER_B).set({
        user_id: UID_PLAYER_B,
        user_name: "Player B",
        status: "PENDING",
        requested_at: new Date(),
      })
    );
  });

  it("rejeita se requester ja eh membro do grupo", async () => {
    // PlayerA ja eh OWNER de GROUP_PUBLIC (seed em beforeEach)
    const db = asPlayerA(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_A).set({
        user_id: UID_PLAYER_A,
        user_name: "Player A",
        status: "PENDING",
        requested_at: new Date(),
      })
    );
  });

  it("rejeita se docId != auth.uid (impede pedir em nome de outro)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_C).set({
        user_id: UID_PLAYER_C,
        user_name: "Player C",
        status: "PENDING",
        requested_at: new Date(),
      })
    );
  });

  it("rejeita se status inicial nao eh PENDING (ex: tentar criar APPROVED direto)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).set({
        user_id: UID_PLAYER_B,
        user_name: "Player B",
        status: "APPROVED", // tentativa de auto-aprovar
        requested_at: new Date(),
      })
    );
  });

  it("rejeita se user_id no doc != docId (impede mismatch)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).set({
        user_id: UID_PLAYER_C, // mismatch
        user_name: "Player B",
        status: "PENDING",
        requested_at: new Date(),
      })
    );
  });

  it("nao-autenticado nao pode criar", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).set({
        user_id: UID_PLAYER_B,
        user_name: "Player B",
        status: "PENDING",
        requested_at: new Date(),
      })
    );
  });
});

// ============================================================
// UPDATE (transicao de status)
// ============================================================
describe("join_requests — UPDATE", () => {
  beforeEach(async () => {
    await seedDoc(testEnv, `groups/${GROUP_PUBLIC}/join_requests/${UID_PLAYER_B}`, {
      user_id: UID_PLAYER_B,
      user_name: "Player B",
      status: "PENDING",
      requested_at: new Date(),
    });
  });

  afterEach(cleanupJoinRequests);

  it("owner do grupo pode aprovar (PENDING -> APPROVED)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).update({
        status: "APPROVED",
        responded_at: new Date(),
        responded_by: UID_PLAYER_A,
      })
    );
  });

  it("owner pode rejeitar (PENDING -> REJECTED)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).update({
        status: "REJECTED",
        responded_at: new Date(),
        responded_by: UID_PLAYER_A,
      })
    );
  });

  it("requester nao pode mudar proprio status", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).update({
        status: "APPROVED",
        responded_at: new Date(),
        responded_by: UID_PLAYER_B,
      })
    );
  });

  it("outro player (nao-owner) nao pode aprovar", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).update({
        status: "APPROVED",
        responded_at: new Date(),
        responded_by: UID_PLAYER_C,
      })
    );
  });

  it("rejeita transicao para status invalido (ex: PENDING -> CANCELED)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).update({
        status: "CANCELED",
        responded_at: new Date(),
        responded_by: UID_PLAYER_A,
      })
    );
  });

  it("rejeita re-aprovacao (status nao eh mais PENDING)", async () => {
    // Primeiro aprovar (admin via privileged)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection(`groups/${GROUP_PUBLIC}/join_requests`)
        .doc(UID_PLAYER_B)
        .update({ status: "APPROVED" });
    });

    // Tentar re-aprovar (deve falhar pois status nao eh PENDING)
    const db = asPlayerA(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).update({
        status: "APPROVED",
        responded_at: new Date(),
        responded_by: UID_PLAYER_A,
      })
    );
  });

  it("rejeita se responded_by != auth.uid", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).update({
        status: "APPROVED",
        responded_at: new Date(),
        responded_by: UID_PLAYER_C, // tentativa de spoof
      })
    );
  });
});

// ============================================================
// DELETE
// ============================================================
describe("join_requests — DELETE", () => {
  beforeEach(async () => {
    await seedDoc(testEnv, `groups/${GROUP_PUBLIC}/join_requests/${UID_PLAYER_B}`, {
      user_id: UID_PLAYER_B,
      user_name: "Player B",
      status: "PENDING",
      requested_at: new Date(),
    });
  });

  afterEach(cleanupJoinRequests);

  it("requester pode deletar proprio request (cancelar)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).delete()
    );
  });

  it("owner pode deletar request de qualquer requester", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).delete()
    );
  });

  it("outro player nao pode deletar request alheio", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.collection(`groups/${GROUP_PUBLIC}/join_requests`).doc(UID_PLAYER_B).delete()
    );
  });
});
