/**
 * Testes de Firestore Security Rules — Coleção: notification_settings
 *
 * Caracterização do comportamento ATUAL (a rule não foi alterada).
 *
 * Rule: `allow read, write: if isAuthenticated() && uid == userId()`.
 * O docId é o próprio uid; só o dono lê e escreve. Não há validação de
 * campos, então qualquer payload do dono é aceito.
 *
 * Cobre get, list, create, update e delete para:
 * - não autenticado
 * - dono (PlayerA, docId = PlayerA)
 * - outro autenticado (PlayerB)
 * - admin (a rule não tem exceção para admin)
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const PATH_A = `notification_settings/${UID_PLAYER_A}`;
const PATH_B = `notification_settings/${UID_PLAYER_B}`;
const PATH_C = `notification_settings/${UID_PLAYER_C}`;

const SETTINGS_VALIDOS = {
  push_enabled: true,
  email_enabled: false,
  in_app_enabled: true,
  updated_at: new Date(),
};

// Rule não valida campos: tipos errados e campos extras passam para o dono.
const SETTINGS_INVALIDOS = {
  push_enabled: "talvez",
  email_enabled: 123,
  campo_inexistente: "x",
};

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, PATH_A, SETTINGS_VALIDOS);
  await seedDoc(testEnv, PATH_B, SETTINGS_VALIDOS);
});

describe("notification_settings — leitura", () => {
  it("não autenticado não lê configuração", async () => {
    await assertFails(asAnon(testEnv).doc(PATH_A).get());
  });

  it("dono (PlayerA) lê a própria configuração", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(PATH_A).get());
  });

  it("outro autenticado (PlayerB) não lê a configuração de A", async () => {
    await assertFails(asPlayerB(testEnv).doc(PATH_A).get());
  });

  // HOJE NEGA (ver DIAGNOSTICO): admin não consegue ler configuração de usuário.
  it("HOJE NEGA (ver DIAGNOSTICO): admin não lê a configuração de A", async () => {
    // HOJE NEGA (ver DIAGNOSTICO)
    await assertFails(asAdmin(testEnv).doc(PATH_A).get());
  });

  it("dono (PlayerA) não lista a coleção sem filtro", async () => {
    await assertFails(asPlayerA(testEnv).collection("notification_settings").get());
  });

  it("não autenticado não lista a coleção", async () => {
    await assertFails(asAnon(testEnv).collection("notification_settings").get());
  });
});

describe("notification_settings — criação", () => {
  it("não autenticado não cria configuração", async () => {
    await assertFails(asAnon(testEnv).doc(PATH_C).set(SETTINGS_VALIDOS));
  });

  it("dono (PlayerC) cria a própria configuração com payload válido", async () => {
    await assertSucceeds(asPlayerC(testEnv).doc(PATH_C).set(SETTINGS_VALIDOS));
  });

  // HOJE PERMITE (ver DIAGNOSTICO): a rule não valida tipos nem campos extras.
  it("HOJE PERMITE (ver DIAGNOSTICO): dono cria com payload inválido", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO)
    await assertSucceeds(asPlayerC(testEnv).doc(PATH_C).set(SETTINGS_INVALIDOS));
  });

  it("outro autenticado (PlayerB) não cria configuração no docId de C", async () => {
    await assertFails(asPlayerB(testEnv).doc(PATH_C).set(SETTINGS_VALIDOS));
  });

  it("dono (PlayerA) não cria config no docId de B", async () => {
    await assertFails(asPlayerA(testEnv).doc(PATH_B).set(SETTINGS_VALIDOS));
  });

  it("admin não cria configuração de outro usuário", async () => {
    await assertFails(asAdmin(testEnv).doc(PATH_C).set(SETTINGS_VALIDOS));
  });
});

describe("notification_settings — atualização", () => {
  it("não autenticado não atualiza", async () => {
    await assertFails(asAnon(testEnv).doc(PATH_A).update({ push_enabled: false }));
  });

  it("dono (PlayerA) atualiza a própria configuração", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(PATH_A).update({ push_enabled: false })
    );
  });

  // HOJE PERMITE (ver DIAGNOSTICO): dono grava tipo errado sem ser barrado.
  it("HOJE PERMITE (ver DIAGNOSTICO): dono atualiza com campo de tipo errado", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO)
    await assertSucceeds(
      asPlayerA(testEnv).doc(PATH_A).update({ push_enabled: "sim" })
    );
  });

  it("outro autenticado (PlayerB) não atualiza a configuração de A", async () => {
    await assertFails(asPlayerB(testEnv).doc(PATH_A).update({ push_enabled: false }));
  });

  // HOJE NEGA (ver DIAGNOSTICO): admin não consegue ajustar configuração de usuário.
  it("HOJE NEGA (ver DIAGNOSTICO): admin não atualiza a configuração de A", async () => {
    // HOJE NEGA (ver DIAGNOSTICO)
    await assertFails(asAdmin(testEnv).doc(PATH_A).update({ push_enabled: false }));
  });
});

describe("notification_settings — remoção", () => {
  it("não autenticado não remove", async () => {
    await assertFails(asAnon(testEnv).doc(PATH_A).delete());
  });

  it("dono (PlayerA) remove a própria configuração", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(PATH_A).delete());
  });

  it("outro autenticado (PlayerB) não remove a configuração de A", async () => {
    await assertFails(asPlayerB(testEnv).doc(PATH_A).delete());
  });

  // HOJE NEGA (ver DIAGNOSTICO): admin não consegue remover configuração de usuário.
  it("HOJE NEGA (ver DIAGNOSTICO): admin não remove a configuração de A", async () => {
    // HOJE NEGA (ver DIAGNOSTICO)
    await assertFails(asAdmin(testEnv).doc(PATH_A).delete());
  });
});
