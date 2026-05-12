/**
 * Testes de Firestore Security Rules — Coleção: badges
 *
 * Cobre:
 * - Leitura: qualquer autenticado pode ler definições de badges
 * - Escrita (create/update/delete): apenas ADMIN
 * - Não-autenticado: negado em tudo
 * - PLAYER: negado em create, update e delete
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

const BADGE_MVP = "badge-mvp-001";
const BADGE_STREAK = "badge-streak-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `badges/${BADGE_MVP}`, {
    name: "MVP",
    description: "Votado MVP em uma partida",
    icon: "trophy",
    xp_reward: 50,
    category: "PERFORMANCE",
    created_at: new Date(),
  });

  await seedDoc(testEnv, `badges/${BADGE_STREAK}`, {
    name: "Streak Master",
    description: "Série de 5 jogos consecutivos",
    icon: "fire",
    xp_reward: 100,
    category: "ATTENDANCE",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("badges — leitura", () => {
  it("Autenticado pode ler definição de badge", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`badges/${BADGE_MVP}`).get());
  });

  it("Qualquer autenticado pode ler qualquer badge (PlayerB)", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`badges/${BADGE_STREAK}`).get());
  });

  it("Admin também pode ler badges", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`badges/${BADGE_MVP}`).get());
  });

  it("Não-autenticado NÃO pode ler badges", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`badges/${BADGE_MVP}`).get());
  });
});

describe("badges — criação", () => {
  it("Admin pode criar nova definição de badge", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("badges/badge-new-admin").set({
        name: "Artilheiro",
        description: "10 gols em uma temporada",
        icon: "soccer",
        xp_reward: 75,
        category: "GOALS",
        created_at: new Date(),
      })
    );
  });

  it("PLAYER NÃO pode criar badge", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("badges/badge-player-hack").set({
        name: "Badge Hackeada",
        description: "Criada ilegalmente por jogador",
        icon: "bug",
        xp_reward: 99999,
        category: "CHEAT",
        created_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode criar badge", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("badges/badge-anon-hack").set({
        name: "Badge Anon",
        description: "Tentativa anônima",
        icon: "ghost",
        xp_reward: 0,
        category: "NONE",
        created_at: new Date(),
      })
    );
  });
});

describe("badges — atualização", () => {
  it("Admin pode atualizar badge existente", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`badges/${BADGE_MVP}`).update({
        xp_reward: 60,
        updated_at: new Date(),
      })
    );
  });

  it("PLAYER NÃO pode atualizar badge", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`badges/${BADGE_MVP}`).update({
        xp_reward: 999999,
        updated_at: new Date(),
      })
    );
  });

  it("Não-autenticado NÃO pode atualizar badge", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`badges/${BADGE_MVP}`).update({ xp_reward: 1 })
    );
  });
});

describe("badges — deleção", () => {
  it("Admin pode deletar badge", async () => {
    await seedDoc(testEnv, "badges/badge-to-delete", {
      name: "Badge Obsoleta",
      description: "Para remover",
      icon: "trash",
      xp_reward: 0,
      category: "LEGACY",
      created_at: new Date(),
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("badges/badge-to-delete").delete());
  });

  it("PLAYER NÃO pode deletar badge", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`badges/${BADGE_STREAK}`).delete());
  });

  it("Não-autenticado NÃO pode deletar badge", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`badges/${BADGE_MVP}`).delete());
  });
});
