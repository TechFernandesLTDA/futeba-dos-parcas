/**
 * Testes de Firestore Security Rules — Coleção: error_logs (captura de erros do cliente web)
 *
 * Caracterização do comportamento ATUAL das rules (não altera as rules).
 *
 * Regras lidas em firestore.rules (match /error_logs/{logId}):
 * - create: autenticado E kind string não vazia E message string <= 1000
 *   E createdAt == request.time E (sem stack OU stack string <= 10240)
 * - read/update/delete: apenas ADMIN
 * - Não há campo de dono/autor: o "autor" é apenas quem gravou; não consta no doc.
 *
 * Marcadores:
 * - "HOJE PERMITE (ver DIAGNOSTICO)": a rule permite algo que parece indevido.
 * - "HOJE NEGA (ver DIAGNOSTICO)": a rule nega algo que parece que deveria permitir.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const SEED_ERR = "seed-error-001";
const OWN_ERR = "own-error-001";

/** Payload válido: kind e message preenchidos, createdAt = timestamp do servidor. */
function validError(extra: Record<string, unknown> = {}) {
  return {
    kind: "web-error",
    message: "Falha ao carregar jogos",
    createdAt: serverTimestamp(),
    ...extra,
  };
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, `error_logs/${SEED_ERR}`, {
    kind: "web-error",
    message: "erro semeado",
    createdAt: new Date(),
  });
  // Log gravado por PlayerA (autor): não há campo de autor, só para o teste de leitura/escrita.
  await seedDoc(testEnv, `error_logs/${OWN_ERR}`, {
    kind: "web-error",
    message: "erro do PlayerA",
    userId: UID_PLAYER_A,
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("error_logs — criação", () => {
  it("Não-autenticado NÃO pode criar log de erro, mesmo com payload válido", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc("error_logs/err-anon").set(validError()));
  });

  it("Jogador autenticado (PlayerA) pode criar log com payload válido", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc("error_logs/err-a-ok").set(validError()));
  });

  it("Admin pode criar log com payload válido", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("error_logs/err-admin-ok").set(validError()));
  });

  it("Negado sem campo kind", async () => {
    const db = asPlayerA(testEnv);
    const { kind: _omit, ...semKind } = validError();
    await assertFails(db.doc("error_logs/err-sem-kind").set(semKind));
  });

  it("Negado com kind vazio", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc("error_logs/err-kind-vazio").set(validError({ kind: "" })));
  });

  it("Negado com kind que não é string", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc("error_logs/err-kind-num").set(validError({ kind: 42 })));
  });

  it("Negado sem campo message", async () => {
    const db = asPlayerA(testEnv);
    const { message: _omit, ...semMessage } = validError();
    await assertFails(db.doc("error_logs/err-sem-message").set(semMessage));
  });

  it("Aceita message com exatamente 1000 caracteres (limite)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("error_logs/err-msg-1000").set(validError({ message: "m".repeat(1000) }))
    );
  });

  it("Negado com message de 1001 caracteres (acima do limite)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("error_logs/err-msg-1001").set(validError({ message: "m".repeat(1001) }))
    );
  });

  it("Aceita stack com exatamente 10240 caracteres (limite)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("error_logs/err-stack-10240").set(validError({ stack: "s".repeat(10240) }))
    );
  });

  it("Negado com stack de 10241 caracteres (acima do limite)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("error_logs/err-stack-10241").set(validError({ stack: "s".repeat(10241) }))
    );
  });

  it("Negado sem createdAt (campo obrigatório)", async () => {
    const db = asPlayerA(testEnv);
    const { createdAt: _omit, ...semCreatedAt } = validError();
    await assertFails(db.doc("error_logs/err-sem-created").set(semCreatedAt));
  });

  it("nega createdAt de cliente (new Date()); a rule exige request.time", async () => {
    // Esperado: o padrão do repo é serverTimestamp() em createdAt (CLAUDE.md, Web App).
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("error_logs/err-client-date").set({
        kind: "web-error",
        message: "Falha",
        createdAt: new Date(),
      })
    );
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): qualquer autenticado grava log com userId de OUTRO usuário e campo extra grande", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): a rule não restringe campos extras nem
    // valida userId contra request.auth.uid; o log pode atribuir erro a outro jogador
    // e carregar conteúdo arbitrário (50 KB de contexto) sem limite de campos.
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("error_logs/err-impersonate").set(
        validError({
          kind: "qualquer-coisa-livre",
          userId: UID_PLAYER_B,
          context: "c".repeat(50_000),
        })
      )
    );
  });
});

describe("error_logs — leitura", () => {
  it("Não-autenticado NÃO pode ler log de erro", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`error_logs/${SEED_ERR}`).get());
  });

  it("Não-autenticado NÃO pode listar logs de erro", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("error_logs").get());
  });

  it("Autor (PlayerA) NÃO pode ler o próprio log de erro (só admin lê)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`error_logs/${OWN_ERR}`).get());
  });

  it("Outro jogador (PlayerB) NÃO pode listar logs de erro", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.collection("error_logs").get());
  });

  it("Admin pode ler e listar logs de erro", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`error_logs/${SEED_ERR}`).get());
    await assertSucceeds(db.collection("error_logs").get());
  });
});

describe("error_logs — atualização e exclusão", () => {
  it("Não-autenticado NÃO pode atualizar log de erro", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`error_logs/${SEED_ERR}`).update({ message: "x" }));
  });

  it("Autor (PlayerA) NÃO pode atualizar o próprio log de erro", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`error_logs/${OWN_ERR}`).update({ message: "x" }));
  });

  it("Admin pode atualizar log de erro", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`error_logs/${SEED_ERR}`).update({ message: "triado" }));
  });

  it("Não-autenticado NÃO pode excluir log de erro", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`error_logs/${SEED_ERR}`).delete());
  });

  it("Autor (PlayerA) NÃO pode excluir o próprio log de erro", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`error_logs/${OWN_ERR}`).delete());
  });

  it("Admin pode excluir log de erro", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`error_logs/${SEED_ERR}`).delete());
  });
});
