/**
 * Testes de Firestore Security Rules — Coleção: notification_queue
 *
 * Caracterização do comportamento ATUAL (a rule não foi alterada).
 *
 * Rule: `allow read, write: if false` — a fila é gerida só por Cloud
 * Functions (Admin SDK). Não existe "dono": a fila não é por usuário.
 *
 * Cobre get, list, create, update e delete para:
 * - não autenticado
 * - PlayerA (documento com user_id = PlayerA, mesmo assim negado)
 * - PlayerB (outro autenticado)
 * - admin (rule não dá exceção para admin)
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

const NOTIF_ID = "notif-queue-001";
const NOTIF_PATH = `notification_queue/${NOTIF_ID}`;

const PAYLOAD_VALIDO = {
  user_id: UID_PLAYER_A,
  title: "Jogo confirmado",
  body: "Sua pelada é amanhã às 20h",
  status: "pending",
  created_at: new Date(),
};

// Sem validação de campos na rule, mas como write é `false`, o resultado é
// o mesmo: negado. Mantido para cobrir "payload inválido" pedido no lote.
const PAYLOAD_INVALIDO = {
  user_id: 12345,
  title: "",
  status: "qualquer-coisa",
};

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, NOTIF_PATH, PAYLOAD_VALIDO);
});

describe("notification_queue — leitura", () => {
  it("não autenticado não lê documento da fila", async () => {
    await assertFails(asAnon(testEnv).doc(NOTIF_PATH).get());
  });

  it("dono do registro (PlayerA) não lê a própria notificação na fila", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOTIF_PATH).get());
  });

  it("outro autenticado (PlayerB) não lê documento da fila", async () => {
    await assertFails(asPlayerB(testEnv).doc(NOTIF_PATH).get());
  });

  it("admin não lê documento da fila (sem exceção na rule)", async () => {
    await assertFails(asAdmin(testEnv).doc(NOTIF_PATH).get());
  });

  it("não autenticado não lista a coleção", async () => {
    await assertFails(asAnon(testEnv).collection("notification_queue").get());
  });

  it("autenticado (PlayerA) não lista a coleção", async () => {
    await assertFails(asPlayerA(testEnv).collection("notification_queue").get());
  });

  it("admin não lista a coleção", async () => {
    await assertFails(asAdmin(testEnv).collection("notification_queue").get());
  });
});

describe("notification_queue — criação", () => {
  it("não autenticado não cria com payload válido", async () => {
    await assertFails(
      asAnon(testEnv).doc("notification_queue/novo-anon").set(PAYLOAD_VALIDO)
    );
  });

  it("PlayerA não cria com payload válido", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("notification_queue/novo-a").set(PAYLOAD_VALIDO)
    );
  });

  it("PlayerA não cria com payload inválido", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("notification_queue/novo-a-inv").set(PAYLOAD_INVALIDO)
    );
  });

  it("admin não cria com payload válido", async () => {
    await assertFails(
      asAdmin(testEnv).doc("notification_queue/novo-admin").set(PAYLOAD_VALIDO)
    );
  });

  it("admin não cria com payload inválido", async () => {
    await assertFails(
      asAdmin(testEnv).doc("notification_queue/novo-admin-inv").set(PAYLOAD_INVALIDO)
    );
  });
});

describe("notification_queue — atualização", () => {
  it("não autenticado não atualiza", async () => {
    await assertFails(asAnon(testEnv).doc(NOTIF_PATH).update({ status: "sent" }));
  });

  it("PlayerA (dono do user_id) não atualiza o status", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOTIF_PATH).update({ status: "sent" }));
  });

  it("PlayerA não atualiza com campo inválido", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOTIF_PATH).update({ status: 42 }));
  });

  it("PlayerB não atualiza", async () => {
    await assertFails(asPlayerB(testEnv).doc(NOTIF_PATH).update({ status: "sent" }));
  });

  it("admin não atualiza", async () => {
    await assertFails(asAdmin(testEnv).doc(NOTIF_PATH).update({ status: "sent" }));
  });
});

describe("notification_queue — remoção", () => {
  it("não autenticado não remove", async () => {
    await assertFails(asAnon(testEnv).doc(NOTIF_PATH).delete());
  });

  it("PlayerA (dono do user_id) não remove", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOTIF_PATH).delete());
  });

  it("PlayerB não remove", async () => {
    await assertFails(asPlayerB(testEnv).doc(NOTIF_PATH).delete());
  });

  it("admin não remove", async () => {
    await assertFails(asAdmin(testEnv).doc(NOTIF_PATH).delete());
  });
});
