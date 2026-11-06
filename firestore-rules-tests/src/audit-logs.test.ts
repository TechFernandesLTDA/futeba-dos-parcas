/**
 * Testes de Firestore Security Rules — Coleção: audit_logs (ROOT LEVEL)
 *
 * Caracterização do comportamento ATUAL das rules (não altera as rules).
 * Não confundir com `locations/{id}/audit_logs` (outra regra, outro escopo).
 *
 * Regras lidas em firestore.rules (match /audit_logs/{logId}, root):
 * - read: autenticado E admin
 * - create/update/delete: false (imutável; escrita só via Admin SDK / Cloud Functions)
 *
 * Não há dono/autor no documento: o bloco "dono" não se aplica.
 * Os testes de escrita negam também o admin: é o desenho (imutabilidade),
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
  UID_PLAYER_A,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const LOG_ID = "audit-log-001";

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, `audit_logs/${LOG_ID}`, {
    action: "XP_CHANGE",
    actor_id: UID_PLAYER_A,
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("audit_logs (root) — leitura", () => {
  it("Não-autenticado NÃO pode ler log de auditoria", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`audit_logs/${LOG_ID}`).get());
  });

  it("Não-autenticado NÃO pode listar logs de auditoria", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("audit_logs").get());
  });

  it("Jogador autenticado (PlayerA), inclusive o ator do log, NÃO pode ler", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`audit_logs/${LOG_ID}`).get());
  });

  it("Jogador autenticado (PlayerA) NÃO pode listar logs", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.collection("audit_logs").get());
  });

  it("Admin pode ler e listar logs de auditoria", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`audit_logs/${LOG_ID}`).get());
    await assertSucceeds(db.collection("audit_logs").get());
  });
});

describe("audit_logs (root) — escrita (imutável)", () => {
  it("Não-autenticado NÃO pode criar log, mesmo com payload válido", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("audit_logs/audit-log-novo").set({ action: "X", created_at: new Date() })
    );
  });

  it("Jogador autenticado NÃO pode criar log, mesmo com payload válido", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("audit_logs/audit-log-novo").set({ action: "X", created_at: new Date() })
    );
  });

  it("Admin NÃO pode criar log (escrita só via Admin SDK)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("audit_logs/audit-log-admin").set({ action: "X", created_at: new Date() })
    );
  });

  it("Admin NÃO pode criar log com payload inválido (vazio)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc("audit_logs/audit-log-vazio").set({}));
  });

  it("Admin NÃO pode atualizar log existente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`audit_logs/${LOG_ID}`).update({ action: "ALTERADO" }));
  });

  it("Jogador autenticado NÃO pode atualizar log existente", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`audit_logs/${LOG_ID}`).update({ action: "ALTERADO" }));
  });

  it("Admin NÃO pode excluir log existente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`audit_logs/${LOG_ID}`).delete());
  });

  it("Não-autenticado NÃO pode excluir log existente", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`audit_logs/${LOG_ID}`).delete());
  });
});
