/**
 * Testes de Firestore Security Rules — Coleção: app_settings (CMD-12)
 *
 * Caracterização do comportamento ATUAL das rules (não altera as rules).
 *
 * Regras lidas em firestore.rules (match /app_settings/{docId}):
 * - read: qualquer autenticado
 * - create/update/delete: apenas ADMIN (custom claim role == "ADMIN")
 * - Não há validação de campos: o admin grava qualquer payload.
 * - Não há conceito de dono/autor: o bloco "dono" não se aplica.
 *
 * Marcadores:
 * - "HOJE PERMITE (ver DIAGNOSTICO)": a rule permite algo que parece indevido.
 * - "HOJE NEGA (ver DIAGNOSTICO)": a rule nega algo que parece que deveria permitir.
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
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const SETTINGS_XP = "xp_rates";
const SETTINGS_TO_DELETE = "settings_to_delete";

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, `app_settings/${SETTINGS_XP}`, {
    xp_goal: 10,
    xp_win: 20,
    xp_draw: 10,
    updated_at: new Date(),
  });
  await seedDoc(testEnv, `app_settings/${SETTINGS_TO_DELETE}`, {
    xp_goal: 1,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("app_settings — leitura", () => {
  it("Não-autenticado NÃO pode ler um documento de configuração", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`app_settings/${SETTINGS_XP}`).get());
  });

  it("Não-autenticado NÃO pode listar a coleção", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("app_settings").get());
  });

  it("Jogador autenticado (PlayerA) pode ler a configuração", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`app_settings/${SETTINGS_XP}`).get());
  });

  it("Outro jogador autenticado (PlayerB) pode listar a coleção", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.collection("app_settings").get());
  });

  it("Admin pode ler e listar a configuração", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`app_settings/${SETTINGS_XP}`).get());
    await assertSucceeds(db.collection("app_settings").get());
  });
});

describe("app_settings — criação", () => {
  it("Não-autenticado NÃO pode criar configuração", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc("app_settings/novo").set({ xp_goal: 10 }));
  });

  it("Jogador autenticado (PlayerA) NÃO pode criar configuração, mesmo com payload válido", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("app_settings/novo").set({ xp_goal: 10, xp_win: 20 })
    );
  });

  it("Admin pode criar configuração com payload válido", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("app_settings/novo").set({ xp_goal: 10, xp_win: 20 })
    );
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): admin grava taxa de XP negativa sem validacao de campo", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): não há validação de campos nem de intervalo.
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("app_settings/invalido").set({ xp_goal: -999 }));
  });
});

describe("app_settings — atualização", () => {
  it("Não-autenticado NÃO pode atualizar configuração", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`app_settings/${SETTINGS_XP}`).update({ xp_goal: 99 })
    );
  });

  it("Jogador autenticado (PlayerA) NÃO pode atualizar configuração", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`app_settings/${SETTINGS_XP}`).update({ xp_goal: 99 })
    );
  });

  it("Admin pode atualizar configuração existente", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`app_settings/${SETTINGS_XP}`).update({ xp_goal: 12 })
    );
  });
});

describe("app_settings — exclusão", () => {
  it("Não-autenticado NÃO pode excluir configuração", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`app_settings/${SETTINGS_TO_DELETE}`).delete());
  });

  it("Jogador autenticado (PlayerA) NÃO pode excluir configuração", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`app_settings/${SETTINGS_TO_DELETE}`).delete());
  });

  it("Admin pode excluir configuração", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`app_settings/${SETTINGS_TO_DELETE}`).delete());
  });
});
