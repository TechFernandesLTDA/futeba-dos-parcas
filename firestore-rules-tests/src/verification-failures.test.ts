/**
 * Testes de Firestore Security Rules — Coleção: verification_failures
 *
 * Caracterização do comportamento ATUAL (a rule não foi alterada).
 *
 * Rule (Fase 6 anti-abuso #449):
 * - read: `isAdmin()` (custom claim role == ADMIN)
 * - write: `false` — só Cloud Functions escrevem.
 *
 * Cobre get, list, create, update e delete para:
 * - não autenticado
 * - dono do registro (user_id = PlayerA), que não tem leitura própria
 * - outro autenticado (PlayerB)
 * - admin
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const FAIL_ID = "fail-001";
const FAIL_PATH = `verification_failures/${FAIL_ID}`;

const PAYLOAD_VALIDO = {
  user_id: UID_PLAYER_A,
  reason: "codigo_expirado",
  attempts: 2,
  created_at: new Date(),
};

const PAYLOAD_INVALIDO = {
  user_id: 99,
  reason: null,
  attempts: "dois",
};

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, FAIL_PATH, PAYLOAD_VALIDO);
});

describe("verification_failures — leitura", () => {
  it("não autenticado não lê registro de falha", async () => {
    await assertFails(asAnon(testEnv).doc(FAIL_PATH).get());
  });

  it("dono do registro (PlayerA) não lê a própria falha", async () => {
    await assertFails(asPlayerA(testEnv).doc(FAIL_PATH).get());
  });

  it("outro autenticado (PlayerB) não lê registro de falha", async () => {
    await assertFails(asPlayerB(testEnv).doc(FAIL_PATH).get());
  });

  it("admin lê registro de falha", async () => {
    await assertSucceeds(asAdmin(testEnv).doc(FAIL_PATH).get());
  });

  it("não autenticado não lista a coleção", async () => {
    await assertFails(asAnon(testEnv).collection("verification_failures").get());
  });

  it("autenticado comum (PlayerA) não lista a coleção", async () => {
    await assertFails(asPlayerA(testEnv).collection("verification_failures").get());
  });

  it("admin lista a coleção", async () => {
    await assertSucceeds(asAdmin(testEnv).collection("verification_failures").get());
  });
});

describe("verification_failures — criação", () => {
  const NOVO = "verification_failures/fail-novo";

  it("não autenticado não cria com payload válido", async () => {
    await assertFails(asAnon(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("dono (PlayerA) não cria com payload válido", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("dono (PlayerA) não cria com payload inválido", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOVO).set(PAYLOAD_INVALIDO));
  });

  it("admin não cria com payload válido (só Cloud Functions escrevem)", async () => {
    await assertFails(asAdmin(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("admin não cria com payload inválido", async () => {
    await assertFails(asAdmin(testEnv).doc(NOVO).set(PAYLOAD_INVALIDO));
  });
});

describe("verification_failures — atualização", () => {
  it("não autenticado não atualiza", async () => {
    await assertFails(asAnon(testEnv).doc(FAIL_PATH).update({ attempts: 0 }));
  });

  it("dono (PlayerA) não zera as próprias tentativas", async () => {
    await assertFails(asPlayerA(testEnv).doc(FAIL_PATH).update({ attempts: 0 }));
  });

  it("outro autenticado (PlayerB) não atualiza", async () => {
    await assertFails(asPlayerB(testEnv).doc(FAIL_PATH).update({ attempts: 0 }));
  });

  it("admin não atualiza registro", async () => {
    await assertFails(asAdmin(testEnv).doc(FAIL_PATH).update({ attempts: 0 }));
  });
});

describe("verification_failures — remoção", () => {
  it("não autenticado não remove", async () => {
    await assertFails(asAnon(testEnv).doc(FAIL_PATH).delete());
  });

  it("dono (PlayerA) não remove", async () => {
    await assertFails(asPlayerA(testEnv).doc(FAIL_PATH).delete());
  });

  it("outro autenticado (PlayerB) não remove", async () => {
    await assertFails(asPlayerB(testEnv).doc(FAIL_PATH).delete());
  });

  it("admin não remove (write é false, inclusive para admin)", async () => {
    await assertFails(asAdmin(testEnv).doc(FAIL_PATH).delete());
  });
});
