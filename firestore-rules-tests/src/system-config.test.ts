/**
 * Testes de Firestore Security Rules — Coleção: system_config
 *
 * system_config não tem `match` próprio em firestore.rules: cai no deny-all
 * final (`match /{document=**}`). Só o Admin SDK lê e grava. Isso protege
 * `system_config/play_review_accounts` (lista de UIDs de conta de revisão da
 * Play; spec feat-2026-11-09-conta-revisao-play) e o kill switch
 * `group_wall_media_compat`, que as rules leem via get() sem expor ao cliente.
 *
 * UIDs fictícios; o UID real do revisor nunca entra no repo (público).
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asAnon,
  asUser,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const REVIEW_DOC = "system_config/play_review_accounts";
const REVIEW_UID = "review-uid-test";

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, REVIEW_DOC, { uids: [REVIEW_UID] });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("system_config/play_review_accounts — leitura", () => {
  it("Não-autenticado NÃO lê", async () => {
    await assertFails(asAnon(testEnv).doc(REVIEW_DOC).get());
  });

  it("Jogador autenticado NÃO lê", async () => {
    await assertFails(asPlayerA(testEnv).doc(REVIEW_DOC).get());
  });

  it("A própria conta listada NÃO lê", async () => {
    await assertFails(asUser(testEnv, REVIEW_UID).doc(REVIEW_DOC).get());
  });

  it("Nem ADMIN (claim) lê: só o Admin SDK", async () => {
    await assertFails(asAdmin(testEnv).doc(REVIEW_DOC).get());
  });

  it("Ninguém lista a coleção", async () => {
    await assertFails(asPlayerA(testEnv).collection("system_config").get());
    await assertFails(asAdmin(testEnv).collection("system_config").get());
  });
});

describe("system_config/play_review_accounts — escrita", () => {
  it("Jogador NÃO se coloca na lista (update)", async () => {
    await assertFails(
      asUser(testEnv, "intruso-uid-test")
        .doc(REVIEW_DOC)
        .set({ uids: [REVIEW_UID, "intruso-uid-test"] }),
    );
  });

  it("Jogador NÃO cria o documento do zero", async () => {
    await testEnv.clearFirestore();
    await assertFails(
      asPlayerA(testEnv).doc(REVIEW_DOC).set({ uids: ["intruso-uid-test"] }),
    );
  });

  it("Não-autenticado NÃO grava", async () => {
    await assertFails(
      asAnon(testEnv).doc(REVIEW_DOC).set({ uids: ["intruso-uid-test"] }),
    );
  });

  it("Nem ADMIN (claim) grava nem apaga: só o Admin SDK", async () => {
    await assertFails(
      asAdmin(testEnv).doc(REVIEW_DOC).update({ uids: [] }),
    );
    await assertFails(asAdmin(testEnv).doc(REVIEW_DOC).delete());
  });
});
