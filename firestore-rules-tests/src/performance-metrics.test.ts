/**
 * Testes de Firestore Security Rules — Coleção: performance_metrics (monitoramento client-side)
 *
 * Caracterização do comportamento ATUAL das rules (não altera as rules).
 *
 * Regras lidas em firestore.rules (match /performance_metrics/{metricId}):
 * - read: apenas ADMIN (isAdmin() já exige autenticação)
 * - write (create/update/delete): false (telemetria persistente deve vir do backend)
 *
 * Não há dono/autor no documento: o bloco "dono" não se aplica.
 * Os testes de escrita negam também o admin: é o desenho, não "HOJE NEGA".
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

const PERF_ID = "perf-001";

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, `performance_metrics/${PERF_ID}`, {
    screen: "home",
    duration_ms: 340,
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("performance_metrics — leitura", () => {
  it("Não-autenticado NÃO pode ler métrica de performance", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`performance_metrics/${PERF_ID}`).get());
  });

  it("Não-autenticado NÃO pode listar métricas de performance", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("performance_metrics").get());
  });

  it("Jogador autenticado (PlayerA) NÃO pode ler métrica de performance", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`performance_metrics/${PERF_ID}`).get());
  });

  it("Jogador autenticado (PlayerA) NÃO pode listar métricas de performance", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.collection("performance_metrics").get());
  });

  it("Admin pode ler e listar métricas de performance", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`performance_metrics/${PERF_ID}`).get());
    await assertSucceeds(db.collection("performance_metrics").get());
  });
});

describe("performance_metrics — escrita (bloqueada para todos)", () => {
  it("Não-autenticado NÃO pode criar métrica, mesmo com payload válido", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("performance_metrics/perf-anon").set({ screen: "home", duration_ms: 1, created_at: new Date() })
    );
  });

  it("Jogador autenticado NÃO pode criar métrica, mesmo com payload válido", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("performance_metrics/perf-a").set({ screen: "home", duration_ms: 1, created_at: new Date() })
    );
  });

  it("Admin NÃO pode criar métrica (escrita client-side bloqueada)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("performance_metrics/perf-admin").set({ screen: "home", duration_ms: 1, created_at: new Date() })
    );
  });

  it("Admin NÃO pode criar métrica com payload inválido (vazio)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc("performance_metrics/perf-vazia").set({}));
  });

  it("Admin NÃO pode atualizar métrica existente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`performance_metrics/${PERF_ID}`).update({ duration_ms: 0 }));
  });

  it("Jogador autenticado NÃO pode atualizar métrica existente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`performance_metrics/${PERF_ID}`).update({ duration_ms: 0 }));
  });

  it("Admin NÃO pode excluir métrica existente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`performance_metrics/${PERF_ID}`).delete());
  });

  it("Jogador autenticado NÃO pode excluir métrica existente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`performance_metrics/${PERF_ID}`).delete());
  });
});
