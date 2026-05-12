/**
 * Testes de Firestore Security Rules — Coleção: user_badges
 *
 * user_badges são badges desbloqueadas por usuário, geradas EXCLUSIVAMENTE
 * por Cloud Functions (onGameFinished, MVP vote, etc.).
 * Clientes NÃO devem conseguir criar, atualizar ou deletar — prevenção de
 * auto-atribuição fraudulenta de badges.
 *
 * Regra atual: `allow read: if isAuthenticated(); allow create: if isAdmin();`
 * → update e delete NÃO estão definidos = bloqueados para todos (incluindo ADMIN)
 *
 * Cobre:
 * - Leitura: qualquer autenticado pode ler (exibição de badges)
 * - Criação: apenas ADMIN (Cloud Functions usam Admin SDK, que bypass rules)
 * - Atualização: ninguém pode atualizar (rule não define allow update)
 * - Deleção: ninguém pode deletar (rule não define allow delete)
 * - PLAYER: negado em todo tipo de escrita
 * - Não-autenticado: negado em tudo
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
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const BADGE_PLAYER_A_MVP = "user-badge-player-a-mvp-001";
const BADGE_PLAYER_B_STREAK = "user-badge-player-b-streak-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `user_badges/${BADGE_PLAYER_A_MVP}`, {
    user_id: UID_PLAYER_A,
    badge_id: "badge-mvp-001",
    badge_name: "MVP",
    unlocked_at: new Date(),
    game_id: "game-abc-001",
    season_id: "season-2026-05",
  });

  await seedDoc(testEnv, `user_badges/${BADGE_PLAYER_B_STREAK}`, {
    user_id: UID_PLAYER_B,
    badge_id: "badge-streak-001",
    badge_name: "Streak Master",
    unlocked_at: new Date(),
    season_id: "season-2026-05",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("user_badges — leitura", () => {
  it("Autenticado pode ler própria badge desbloqueada", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`user_badges/${BADGE_PLAYER_A_MVP}`).get());
  });

  it("Autenticado pode ler badge desbloqueada de outro (perfis públicos)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`user_badges/${BADGE_PLAYER_B_STREAK}`).get());
  });

  it("Admin pode ler user_badge", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`user_badges/${BADGE_PLAYER_A_MVP}`).get());
  });

  it("Não-autenticado NÃO pode ler user_badges", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`user_badges/${BADGE_PLAYER_A_MVP}`).get());
  });
});

describe("user_badges — criação", () => {
  it("Admin pode criar user_badge (operação de recuperação/correção)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("user_badges/user-badge-admin-grant").set({
        user_id: UID_PLAYER_A,
        badge_id: "badge-mvp-001",
        badge_name: "MVP",
        unlocked_at: new Date(),
        game_id: "game-abc-002",
        season_id: "season-2026-05",
      })
    );
  });

  it("PLAYER NÃO pode criar user_badge para si mesmo — auto-atribuição fraudulenta", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("user_badges/user-badge-player-a-hack").set({
        user_id: UID_PLAYER_A,
        badge_id: "badge-mvp-001",
        badge_name: "MVP",
        unlocked_at: new Date(),
        game_id: "game-fake-001",
        season_id: "season-2026-05",
      })
    );
  });

  it("PLAYER NÃO pode criar user_badge para outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("user_badges/user-badge-player-b-hack").set({
        user_id: UID_PLAYER_B,
        badge_id: "badge-streak-001",
        badge_name: "Streak Master",
        unlocked_at: new Date(),
        season_id: "season-2026-05",
      })
    );
  });

  it("Não-autenticado NÃO pode criar user_badge", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("user_badges/user-badge-anon-hack").set({
        user_id: "anon",
        badge_id: "badge-mvp-001",
        badge_name: "MVP",
        unlocked_at: new Date(),
        season_id: "season-2026-05",
      })
    );
  });
});

describe("user_badges — atualização", () => {
  it("Admin NÃO pode atualizar user_badge (rule não define allow update)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc(`user_badges/${BADGE_PLAYER_A_MVP}`).update({
        badge_name: "MVP Atualizado",
        updated_at: new Date(),
      })
    );
  });

  it("PLAYER NÃO pode atualizar user_badge alheia", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`user_badges/${BADGE_PLAYER_B_STREAK}`).update({
        badge_name: "Badge Hackeada",
      })
    );
  });

  it("PLAYER NÃO pode atualizar própria user_badge", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`user_badges/${BADGE_PLAYER_A_MVP}`).update({
        unlocked_at: new Date(0),
      })
    );
  });
});

describe("user_badges — deleção", () => {
  it("Admin NÃO pode deletar user_badge (rule não define allow delete)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`user_badges/${BADGE_PLAYER_A_MVP}`).delete());
  });

  it("PLAYER NÃO pode deletar própria user_badge", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`user_badges/${BADGE_PLAYER_A_MVP}`).delete());
  });

  it("Não-autenticado NÃO pode deletar user_badge", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`user_badges/${BADGE_PLAYER_B_STREAK}`).delete());
  });
});
