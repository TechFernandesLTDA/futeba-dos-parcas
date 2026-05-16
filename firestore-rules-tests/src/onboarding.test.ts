/**
 * Testes de Firestore Security Rules — Campo `onboarding` no documento users/{uid}.
 *
 * Spec: feat-2026-05-16-modern-onboarding-tour §3.4
 *
 * Garante que:
 * - Usuário pode atualizar seu próprio campo `onboarding` (dot-notation)
 * - Usuário A NÃO pode escrever o campo `onboarding` do usuário B
 * - Admin pode atualizar qualquer campo `onboarding`
 * - Não-autenticado é bloqueado
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
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

/** Dados mínimos para um documento de usuário válido. */
const validUserData = (name: string, email: string, role = "PLAYER") => ({
  name,
  email,
  role,
  is_searchable: true,
  experience_points: 0,
  level: 1,
  milestones_achieved: [],
  created_at: new Date(),
  striker_rating: 2.0,
  mid_rating: 2.0,
  defender_rating: 2.0,
  gk_rating: 2.0,
});

/** Payload mínimo de update para o campo onboarding (dot-notation). */
const onboardingCarouselUpdate = {
  "onboarding.carousel_skipped": true,
  "onboarding.version": 1,
  // Mantém campos obrigatórios para o allow update não falhar nas validações
  name: "Jogador A",
  email: "player.a@onboarding.test.com",
  striker_rating: 2.0,
  mid_rating: 2.0,
  defender_rating: 2.0,
  gk_rating: 2.0,
};

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Seed: Player A
  await seedDoc(testEnv, `users/${UID_PLAYER_A}`, {
    ...validUserData("Jogador A", "player.a@onboarding.test.com"),
    onboarding: {
      carousel_completed_at: null,
      carousel_skipped: false,
      checklist_steps: {},
      checklist_completed_at: null,
      checklist_dismissed: false,
      reward_granted: false,
      version: 1,
    },
  });

  // Seed: Player B
  await seedDoc(testEnv, `users/${UID_PLAYER_B}`, {
    ...validUserData("Jogador B", "player.b@onboarding.test.com"),
    onboarding: {
      carousel_skipped: false,
      version: 1,
    },
  });

  // Seed: Admin
  await seedDoc(testEnv, `users/${UID_ADMIN}`, {
    ...validUserData("Admin", "admin@onboarding.test.com", "ADMIN"),
    role: "ADMIN",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// ESCRITA DO CAMPO ONBOARDING — OWNER
// ============================================================

describe("onboarding — escrita pelo próprio usuário (owner)", () => {
  it("Player A pode atualizar seu próprio campo onboarding.carousel_skipped", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`users/${UID_PLAYER_A}`).update(onboardingCarouselUpdate)
    );
  });

  it("Player A pode atualizar onboarding.checklist_dismissed no seu doc", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`users/${UID_PLAYER_A}`).update({
        ...onboardingCarouselUpdate,
        "onboarding.checklist_dismissed": true,
      })
    );
  });
});

// ============================================================
// ISOLAMENTO — Player A NÃO pode escrever o onboarding do Player B
// ============================================================

describe("onboarding — isolamento entre usuários", () => {
  it("Player A NÃO pode atualizar o onboarding do Player B", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_B}`).update({
        "onboarding.carousel_skipped": true,
        name: "Jogador B",
        email: "player.b@onboarding.test.com",
        striker_rating: 2.0,
        mid_rating: 2.0,
        defender_rating: 2.0,
        gk_rating: 2.0,
      })
    );
  });

  it("Player B NÃO pode atualizar o onboarding do Player A", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({
        "onboarding.carousel_skipped": true,
        name: "Jogador A",
        email: "player.a@onboarding.test.com",
        striker_rating: 2.0,
        mid_rating: 2.0,
        defender_rating: 2.0,
        gk_rating: 2.0,
      })
    );
  });

  it("Não-autenticado NÃO pode atualizar onboarding de nenhum usuário", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc(`users/${UID_PLAYER_A}`).update({
        "onboarding.carousel_skipped": true,
      })
    );
  });
});

// ============================================================
// ADMIN — pode atualizar qualquer campo onboarding
// ============================================================

describe("onboarding — admin", () => {
  it("Admin pode atualizar o campo onboarding de qualquer usuário", async () => {
    const db = asAdmin(testEnv);
    // Admin bypassa todas as validações de campo
    await assertSucceeds(
      db.doc(`users/${UID_PLAYER_A}`).update({
        "onboarding.reward_granted": true,
      })
    );
  });
});
