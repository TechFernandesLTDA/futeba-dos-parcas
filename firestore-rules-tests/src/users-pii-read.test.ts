/**
 * Caracterização das Firestore Security Rules — leitura de users/{userId} com PII
 *
 * Complementa users.test.ts (que já cobre o guard de leitura pública básico,
 * LIST e criação/atualização). Aqui ficam os casos de borda do `allow get`
 * (FIXME STAGE 2 de PII, firestore.rules ~linha 768): aliases camelCase,
 * soft-delete, conta mesclada, tipos inesperados e a matriz de contextos.
 *
 * Descreve o comportamento ATUAL. Casos marcados com
 * "HOJE PERMITE (ver DIAGNOSTICO)" afirmam que a rule permite algo indevido.
 *
 * Nenhuma rule é alterada aqui.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asUser,
  asAnon,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const VIEWER = "uid-pii-viewer-001";
const OWNER = "uid-pii-owner-001";

/** Perfil base: pesquisável e sem nenhum campo de PII. */
const CLEAN = {
  name: "Perfil Limpo",
  email: null,
  role: "PLAYER",
  is_searchable: true,
  experience_points: 10,
  level: 1,
  milestones_achieved: [],
};

/** Recria o estado conhecido antes de cada teste. */
async function resetState() {
  await testEnv.clearFirestore();
  const docs: Record<string, Record<string, unknown>> = {
    // Matriz de contexto
    "users/u-clean": CLEAN,
    "users/u-private": { ...CLEAN, is_searchable: false },
    // Campos de PII / estado com variações
    "users/u-clean-null-pii": {
      ...CLEAN,
      fcm_token: null,
      birth_date: null,
      height_cm: null,
      weight_kg: null,
      gender: null,
      phone: null,
    },
    "users/u-soft-deleted-snake": { ...CLEAN, deleted_at: new Date() },
    // HOJE PERMITE: soft-delete só com alias camelCase não é reconhecido pelo guard
    "users/u-soft-deleted-camel": { ...CLEAN, deletedAt: new Date() },
    // HOJE PERMITE: conta mesclada (account_status == 'merged') continua legível
    "users/u-merged": { ...CLEAN, account_status: "merged" },
    "users/u-camel-searchable-email": { ...CLEAN, is_searchable: undefined, isSearchable: true, email: "x@test.com" },
    "users/u-string-searchable": { ...CLEAN, is_searchable: "true" },
    "users/u-empty-gender": { ...CLEAN, gender: "" },
    "users/u-empty-fcm": { ...CLEAN, fcm_token: "" },
    "users/u-fcm-present": { ...CLEAN, fcm_token: "tok-123" },
    "users/u-soft-deleted-owner": { ...CLEAN, deleted_at: new Date() },
  };
  for (const [path, data] of Object.entries(docs)) {
    // undefined não é aceito pelo SDK: remove a chave antes de gravar
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await seedDoc(testEnv, path, clean);
  }
  // Dono de u-soft-deleted-owner, para o caso de leitura pelo próprio uid
  await seedDoc(testEnv, `users/${OWNER}`, { ...CLEAN, name: "Dono", deleted_at: new Date() });
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await resetState();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================
// Matriz de contexto: perfil pesquisável sem PII (u-clean)
// ============================================
describe("users PII — get, perfil pesquisável limpo (u-clean)", () => {
  it("não autenticado NÃO lê", async () => {
    await assertFails(asAnon(testEnv).doc("users/u-clean").get());
  });

  it("dono lê o próprio perfil", async () => {
    await assertSucceeds(asUser(testEnv, "u-clean").doc("users/u-clean").get());
  });

  it("outro usuário autenticado lê (is_searchable=true, sem PII)", async () => {
    await assertSucceeds(asUser(testEnv, VIEWER).doc("users/u-clean").get());
  });

  it("admin lê", async () => {
    await assertSucceeds(asAdmin(testEnv).doc("users/u-clean").get());
  });
});

// ============================================
// Matriz de contexto: perfil NÃO pesquisável (u-private)
// ============================================
describe("users PII — get, perfil não pesquisável (u-private)", () => {
  it("não autenticado NÃO lê", async () => {
    await assertFails(asAnon(testEnv).doc("users/u-private").get());
  });

  it("dono lê o próprio perfil mesmo sem is_searchable", async () => {
    await assertSucceeds(asUser(testEnv, "u-private").doc("users/u-private").get());
  });

  it("outro usuário autenticado NÃO lê", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-private").get());
  });

  it("admin lê", async () => {
    await assertSucceeds(asAdmin(testEnv).doc("users/u-private").get());
  });
});

// ============================================
// LIST (users): só admin
// ============================================
describe("users PII — list", () => {
  it("não autenticado NÃO faz list de users", async () => {
    await assertFails(asAnon(testEnv).collection("users").limit(2).get());
  });

  it("dono NÃO faz list de users", async () => {
    await assertFails(asUser(testEnv, "u-clean").collection("users").limit(2).get());
  });

  it("outro usuário NÃO faz list de users, mesmo filtrando is_searchable", async () => {
    await assertFails(
      asUser(testEnv, VIEWER).collection("users").where("is_searchable", "==", true).get()
    );
  });

  it("admin faz list de users", async () => {
    await assertSucceeds(asAdmin(testEnv).collection("users").limit(2).get());
  });
});

// ============================================
// Casos de borda do guard de leitura pública (outro usuário autenticado)
// ============================================
describe("users PII — get de terceiros: casos de borda do guard", () => {
  it("lê perfil com todos os campos de PII explicitamente null", async () => {
    await assertSucceeds(asUser(testEnv, VIEWER).doc("users/u-clean-null-pii").get());
  });

  it("NÃO lê perfil soft-deleted (deleted_at preenchido)", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-soft-deleted-snake").get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO): o guard checa só `deleted_at`. Um doc com
  // `deletedAt` (alias camelCase, que a rule de create também bloqueia como
  // server-only) continua legível por qualquer autenticado.
  it("HOJE PERMITE (ver DIAGNOSTICO): lê perfil soft-deleted só com alias deletedAt", async () => {
    await assertSucceeds(asUser(testEnv, VIEWER).doc("users/u-soft-deleted-camel").get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO): o guard não considera account_status.
  // Conta mesclada (account_status == 'merged') segue legível por terceiros,
  // enquanto a rule de update já trata 'merged' como estado bloqueado.
  it("HOJE PERMITE (ver DIAGNOSTICO): lê perfil de conta mesclada (account_status=merged)", async () => {
    await assertSucceeds(asUser(testEnv, VIEWER).doc("users/u-merged").get());
  });

  it("aceita isSearchable=true (camelCase) mas NÃO lê se o doc expõe email", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-camel-searchable-email").get());
  });

  it("NÃO lê com is_searchable como string 'true' (comparação estrita com true)", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-string-searchable").get());
  });

  it("NÃO lê com gender como string vazia (guard exige null, não vazio)", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-empty-gender").get());
  });

  it("NÃO lê com fcm_token como string vazia (guard exige null)", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-empty-fcm").get());
  });

  it("NÃO lê com fcm_token preenchido", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-fcm-present").get());
  });

  it("dono lê o próprio perfil mesmo soft-deleted", async () => {
    await assertSucceeds(asUser(testEnv, OWNER).doc(`users/${OWNER}`).get());
  });

  it("admin lê perfil soft-deleted", async () => {
    await assertSucceeds(asAdmin(testEnv).doc("users/u-soft-deleted-snake").get());
  });
});

// ============================================
// Update (contexto não autenticado e outro usuário): complementa users.test.ts
// ============================================
describe("users PII — update por contexto", () => {
  it("não autenticado NÃO atualiza perfil", async () => {
    await assertFails(asAnon(testEnv).doc("users/u-clean").update({ name: "Hacker" }));
  });

  it("outro usuário NÃO atualiza perfil alheio", async () => {
    await assertFails(asUser(testEnv, VIEWER).doc("users/u-clean").update({ name: "Hacker" }));
  });
});
