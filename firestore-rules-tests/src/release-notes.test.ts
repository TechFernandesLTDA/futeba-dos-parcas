/**
 * Testes de Firestore Security Rules — Coleção: release_notes
 *
 * Cobre:
 * - Leitura: qualquer autenticado pode ler notas de versão ("Novidades")
 * - Escrita (create/update/delete): negada para TODOS — `allow write: if false`.
 *   A coleção é populada exclusivamente via Admin SDK na CI (release.yml),
 *   que ignora as Security Rules.
 * - Não-autenticado: negado em tudo.
 * - ADMIN: negado em escrita também (rules não abrem exceção para ADMIN).
 */

import { describe, it, beforeAll, afterAll } from "vitest";
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

const NOTE_ANDROID = "android_1.26.0";
const NOTE_WEB = "web_1.26.0";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `release_notes/${NOTE_ANDROID}`, {
    platform: "android",
    version: "1.26.0",
    buildNumber: 50,
    type: "minor",
    published: true,
    technicalSummary: "Pipeline de release notes.",
    created_at: new Date(),
  });

  await seedDoc(testEnv, `release_notes/${NOTE_WEB}`, {
    platform: "web",
    version: "1.26.0",
    buildNumber: 1,
    type: "minor",
    published: true,
    technicalSummary: "App web mais polido.",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("release_notes — leitura", () => {
  it("Autenticado pode ler nota de versão", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`release_notes/${NOTE_ANDROID}`).get());
  });

  it("Qualquer autenticado pode ler qualquer nota (PlayerB)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`release_notes/${NOTE_WEB}`).get());
  });

  it("Admin também pode ler notas", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`release_notes/${NOTE_ANDROID}`).get());
  });

  it("Não-autenticado NÃO pode ler notas", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`release_notes/${NOTE_ANDROID}`).get());
  });
});

describe("release_notes — criação (negada para todos)", () => {
  it("Admin NÃO pode criar nota (escrita só via Admin SDK na CI)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("release_notes/android_9.9.9").set({
        platform: "android",
        version: "9.9.9",
        buildNumber: 999,
        type: "minor",
        published: true,
      })
    );
  });

  it("PLAYER NÃO pode criar nota", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("release_notes/android_hack").set({
        platform: "android",
        version: "0.0.1",
        buildNumber: 1,
        type: "patch",
        published: true,
      })
    );
  });

  it("Não-autenticado NÃO pode criar nota", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("release_notes/anon_hack").set({
        platform: "web",
        version: "0.0.1",
        buildNumber: 1,
        type: "patch",
        published: true,
      })
    );
  });
});

describe("release_notes — atualização (negada para todos)", () => {
  it("Admin NÃO pode atualizar nota existente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`release_notes/${NOTE_ANDROID}`).update({ buildNumber: 51 })
    );
  });

  it("PLAYER NÃO pode atualizar nota", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`release_notes/${NOTE_ANDROID}`).update({ buildNumber: 99999 })
    );
  });

  it("Não-autenticado NÃO pode atualizar nota", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`release_notes/${NOTE_ANDROID}`).update({ buildNumber: 1 })
    );
  });
});

describe("release_notes — deleção (negada para todos)", () => {
  it("Admin NÃO pode deletar nota", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`release_notes/${NOTE_WEB}`).delete());
  });

  it("PLAYER NÃO pode deletar nota", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`release_notes/${NOTE_WEB}`).delete());
  });

  it("Não-autenticado NÃO pode deletar nota", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`release_notes/${NOTE_ANDROID}`).delete());
  });
});
