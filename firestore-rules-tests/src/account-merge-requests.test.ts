/**
 * Testes de Firestore Security Rules — account_merge_requests.
 *
 * Pedidos de unificação revelam vínculo entre duas contas, então clientes
 * comuns nunca podem ler/listar/escrever. A criação acontece via Admin SDK nas
 * Cloud Functions; admins leem apenas para revisão operacional.
 */

import {describe, it, beforeAll, afterAll} from "vitest";
import {assertFails, assertSucceeds} from "@firebase/rules-unit-testing";
import type {RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asAnon,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const REQUEST_ID = "source-uid_target-uid";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `account_merge_requests/${REQUEST_ID}`, {
    sourceUid: "source-uid",
    targetUid: "target-uid",
    status: "pending_review",
    cpfRelation: "matched",
    requestedBy: "target-uid",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("account_merge_requests — leitura", () => {
  it("Admin pode ler pedido de unificação", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`account_merge_requests/${REQUEST_ID}`).get(),
    );
  });

  it("Player não pode ler pedido de unificação", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`account_merge_requests/${REQUEST_ID}`).get(),
    );
  });

  it("Anônimo não pode ler pedido de unificação", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`account_merge_requests/${REQUEST_ID}`).get(),
    );
  });
});

describe("account_merge_requests — escrita", () => {
  it("Admin não escreve direto; criação é só via Cloud Functions", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("account_merge_requests/admin-write").set({
        sourceUid: "source",
        targetUid: "target",
        status: "pending_review",
      }),
    );
  });

  it("Player não pode criar pedido de unificação direto", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("account_merge_requests/player-write").set({
        sourceUid: "source",
        targetUid: "target",
        status: "pending_review",
      }),
    );
  });
});

describe("índices privados de identidade", () => {
  for (const collection of ["cpf_index", "phone_index", "account_aliases"]) {
    it(`${collection}: nem admin lê diretamente`, async () => {
      await seedDoc(testEnv, `${collection}/opaque-id`, {uid: "target-uid"});
      await assertFails(asAdmin(testEnv).doc(`${collection}/opaque-id`).get());
    });

    it(`${collection}: player não cria nem altera`, async () => {
      const ref = asPlayerA(testEnv).doc(`${collection}/client-write`);
      await assertFails(ref.set({uid: "player-a"}));
    });
  }
});
