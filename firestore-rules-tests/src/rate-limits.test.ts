/**
 * Testes de Firestore Security Rules — Coleção: rate_limits
 *
 * Caracterização do comportamento ATUAL (a rule não foi alterada).
 *
 * Rule: `allow read, write: if false` — o rate limit é gerido só por Cloud
 * Functions (Admin SDK). Clientes não podem ler nem escrever, nem o próprio
 * bucket. Documentos têm o formato `{userId}_{action}`.
 *
 * Cobre get, list, create, update e delete para:
 * - não autenticado
 * - dono do bucket (PlayerA)
 * - outro autenticado (PlayerB)
 * - admin
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails } from "@firebase/rules-unit-testing";
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

const BUCKET_ID = `${UID_PLAYER_A}_create_game`;
const BUCKET_PATH = `rate_limits/${BUCKET_ID}`;

const PAYLOAD_VALIDO = {
  count: 3,
  window_start: new Date(),
  updated_at: new Date(),
};

// Rule não valida campos (write é false), então ambos são negados.
const PAYLOAD_INVALIDO = {
  count: "muitos",
  window_start: "ontem",
};

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, BUCKET_PATH, PAYLOAD_VALIDO);
});

describe("rate_limits — leitura", () => {
  it("não autenticado não lê bucket", async () => {
    await assertFails(asAnon(testEnv).doc(BUCKET_PATH).get());
  });

  it("dono do bucket (PlayerA) não lê o próprio rate limit", async () => {
    await assertFails(asPlayerA(testEnv).doc(BUCKET_PATH).get());
  });

  it("outro autenticado (PlayerB) não lê bucket", async () => {
    await assertFails(asPlayerB(testEnv).doc(BUCKET_PATH).get());
  });

  it("admin não lê bucket (Cloud Functions only)", async () => {
    await assertFails(asAdmin(testEnv).doc(BUCKET_PATH).get());
  });

  it("não autenticado não lista a coleção", async () => {
    await assertFails(asAnon(testEnv).collection("rate_limits").get());
  });

  it("autenticado (PlayerA) não lista a coleção", async () => {
    await assertFails(asPlayerA(testEnv).collection("rate_limits").get());
  });

  it("admin não lista a coleção", async () => {
    await assertFails(asAdmin(testEnv).collection("rate_limits").get());
  });
});

describe("rate_limits — criação", () => {
  const NOVO = "rate_limits/uid-novo_send_message";

  it("não autenticado não cria com payload válido", async () => {
    await assertFails(asAnon(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("dono (PlayerA) não cria com payload válido", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("dono (PlayerA) não cria com payload inválido", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOVO).set(PAYLOAD_INVALIDO));
  });

  it("admin não cria com payload válido", async () => {
    await assertFails(asAdmin(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("admin não cria com payload inválido", async () => {
    await assertFails(asAdmin(testEnv).doc(NOVO).set(PAYLOAD_INVALIDO));
  });
});

describe("rate_limits — atualização", () => {
  it("não autenticado não atualiza bucket", async () => {
    await assertFails(asAnon(testEnv).doc(BUCKET_PATH).update({ count: 0 }));
  });

  it("dono (PlayerA) não zera o próprio contador", async () => {
    await assertFails(asPlayerA(testEnv).doc(BUCKET_PATH).update({ count: 0 }));
  });

  it("dono (PlayerA) não atualiza com campo inválido", async () => {
    await assertFails(asPlayerA(testEnv).doc(BUCKET_PATH).update({ count: "zero" }));
  });

  it("outro autenticado (PlayerB) não atualiza", async () => {
    await assertFails(asPlayerB(testEnv).doc(BUCKET_PATH).update({ count: 0 }));
  });

  it("admin não atualiza bucket", async () => {
    await assertFails(asAdmin(testEnv).doc(BUCKET_PATH).update({ count: 0 }));
  });
});

describe("rate_limits — remoção", () => {
  it("não autenticado não remove bucket", async () => {
    await assertFails(asAnon(testEnv).doc(BUCKET_PATH).delete());
  });

  it("dono (PlayerA) não remove o próprio bucket", async () => {
    await assertFails(asPlayerA(testEnv).doc(BUCKET_PATH).delete());
  });

  it("outro autenticado (PlayerB) não remove bucket", async () => {
    await assertFails(asPlayerB(testEnv).doc(BUCKET_PATH).delete());
  });

  it("admin não remove bucket", async () => {
    await assertFails(asAdmin(testEnv).doc(BUCKET_PATH).delete());
  });
});
