/**
 * Testes de Firestore Security Rules — Coleção: metrics (métricas de performance/monitoramento)
 *
 * Caracterização do comportamento ATUAL das rules (não altera as rules).
 *
 * Regras lidas em firestore.rules (match /metrics/{metricId}):
 * - read: autenticado E admin
 * - create/update/delete: false (escrita só por Cloud Functions, via Admin SDK)
 *
 * Não há dono/autor no documento: o bloco "dono" não se aplica.
 * Os testes de escrita negam também o admin: é o desenho (telemetria só do backend),
 * não é "HOJE NEGA", então não recebe marcador.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asAnon,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const METRIC_ID = "metric-001";

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, `metrics/${METRIC_ID}`, {
    name: "function_latency",
    value: 120,
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("metrics — leitura", () => {
  it("Não-autenticado NÃO pode ler métrica", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`metrics/${METRIC_ID}`).get());
  });

  it("Não-autenticado NÃO pode listar métricas", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("metrics").get());
  });

  it("Jogador autenticado (PlayerA) NÃO pode ler métrica", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`metrics/${METRIC_ID}`).get());
  });

  it("Jogador autenticado (PlayerA) NÃO pode listar métricas", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.collection("metrics").get());
  });

  it("Admin pode ler e listar métricas", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`metrics/${METRIC_ID}`).get());
    await assertSucceeds(db.collection("metrics").get());
  });
});

describe("metrics — escrita (só Cloud Functions)", () => {
  it("Não-autenticado NÃO pode criar métrica, mesmo com payload válido", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("metrics/metric-anon").set({ name: "x", value: 1, created_at: new Date() })
    );
  });

  it("Jogador autenticado NÃO pode criar métrica, mesmo com payload válido", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("metrics/metric-a").set({ name: "x", value: 1, created_at: new Date() })
    );
  });

  it("Admin NÃO pode criar métrica (escrita só via Admin SDK)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("metrics/metric-admin").set({ name: "x", value: 1, created_at: new Date() })
    );
  });

  it("Admin NÃO pode criar métrica com payload inválido (vazio)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc("metrics/metric-vazia").set({}));
  });

  it("Admin NÃO pode atualizar métrica existente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`metrics/${METRIC_ID}`).update({ value: 0 }));
  });

  it("Jogador autenticado NÃO pode atualizar métrica existente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`metrics/${METRIC_ID}`).update({ value: 0 }));
  });

  it("Admin NÃO pode excluir métrica existente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`metrics/${METRIC_ID}`).delete());
  });

  it("Jogador autenticado NÃO pode excluir métrica existente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`metrics/${METRIC_ID}`).delete());
  });
});
