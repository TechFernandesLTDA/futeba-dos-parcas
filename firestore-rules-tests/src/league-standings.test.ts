/**
 * Testes de Firestore Security Rules — Subcoleção: groups/{groupId}/league_standings
 *
 * CARACTERIZAÇÃO: descrevem o comportamento ATUAL das rules em firestore.rules,
 * inclusive o que parece errado. Quando a rule permite algo suspeito, o teste
 * afirma a permissão e leva o marcador "HOJE PERMITE (ver DIAGNOSTICO)".
 *
 * Rules lidas (match /groups/{groupId} > match /league_standings/{docId}):
 * - read: isAuthenticated() && isGroupMember(groupId)
 *   isGroupMember: doc groups/{g}/members/{uid} existe, user_id == uid, e
 *   (sem campo status OU status == 'ACTIVE'). Não exige verified.
 * - write: false (nem admin global pelo cliente; só Admin SDK)
 *
 * Papéis usados: "dono" = membro OWNER do grupo (PlayerA); "membro" = PlayerB
 * ACTIVE; INACTIVE = PlayerC; não-membro = FIELD_OWNER; admin global sem vínculo.
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
  asFieldOwner,
  asUser,
  seedDocs,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GRUPO_A = "grp-liga-a";
const GRUPO_B = "grp-liga-b";
const UID_LEGADO = "uid-membro-legado-001";
const DOC_LIGA = "2026-10";

beforeAll(async () => {
  testEnv = await initTestEnv();
  await testEnv.clearFirestore();

  await seedDocs(testEnv, [
    { path: `groups/${GRUPO_A}`, data: { name: "Grupo A", owner_id: UID_PLAYER_A, status: "ACTIVE" } },
    { path: `groups/${GRUPO_B}`, data: { name: "Grupo B", owner_id: UID_PLAYER_B, status: "ACTIVE" } },

    // Grupo A: dono, membro ativo, membro inativo, membro legado sem status
    { path: `groups/${GRUPO_A}/members/${UID_PLAYER_A}`, data: { user_id: UID_PLAYER_A, role: "OWNER", status: "ACTIVE" } },
    { path: `groups/${GRUPO_A}/members/${UID_PLAYER_B}`, data: { user_id: UID_PLAYER_B, role: "PLAYER", status: "ACTIVE" } },
    { path: `groups/${GRUPO_A}/members/${UID_PLAYER_C}`, data: { user_id: UID_PLAYER_C, role: "PLAYER", status: "INACTIVE" } },
    { path: `groups/${GRUPO_A}/members/${UID_LEGADO}`, data: { user_id: UID_LEGADO, role: "PLAYER" } },

    // Grupo B: só PlayerB é membro
    { path: `groups/${GRUPO_B}/members/${UID_PLAYER_B}`, data: { user_id: UID_PLAYER_B, role: "OWNER", status: "ACTIVE" } },

    { path: `groups/${GRUPO_A}/league_standings/${DOC_LIGA}`, data: { season_id: DOC_LIGA, ranking: [{ user_id: UID_PLAYER_A, position: 1 }] } },
    { path: `groups/${GRUPO_B}/league_standings/${DOC_LIGA}`, data: { season_id: DOC_LIGA, ranking: [{ user_id: UID_PLAYER_B, position: 1 }] } },
  ]);
});

afterAll(async () => {
  await testEnv.cleanup();
});

const docA = () => `groups/${GRUPO_A}/league_standings/${DOC_LIGA}`;
const docB = () => `groups/${GRUPO_B}/league_standings/${DOC_LIGA}`;

describe("league_standings — leitura (get)", () => {
  it("Não-autenticado NÃO pode ler standings da liga", async () => {
    await assertFails(asAnon(testEnv).doc(docA()).get());
  });

  it("Dono do grupo (membro OWNER, PlayerA) pode ler standings", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(docA()).get());
  });

  it("Membro ACTIVE (PlayerB) pode ler standings", async () => {
    await assertSucceeds(asPlayerB(testEnv).doc(docA()).get());
  });

  it("Membro com status INACTIVE (PlayerC) NÃO pode ler standings", async () => {
    await assertFails(asUser(testEnv, UID_PLAYER_C).doc(docA()).get());
  });

  it("Não-membro autenticado (FIELD_OWNER) NÃO pode ler standings", async () => {
    await assertFails(asFieldOwner(testEnv).doc(docA()).get());
  });

  it("Membro de outro grupo (PlayerA, só do Grupo A) NÃO pode ler standings do Grupo B", async () => {
    await assertFails(asPlayerA(testEnv).doc(docB()).get());
  });

  // HOJE NEGA (ver DIAGNOSTICO): admin global sem vínculo ao grupo é negado
  it("HOJE NEGA (ver DIAGNOSTICO): admin global sem vínculo ao grupo NÃO lê standings", async () => {
    await assertFails(asAdmin(testEnv).doc(docA()).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): membro legado sem campo status lê standings", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): sem status, a existência do doc vale como vínculo ativo
    await assertSucceeds(asUser(testEnv, UID_LEGADO).doc(docA()).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): membro ACTIVE sem verified/profileComplete lê standings", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): isGroupMember não exige verified nem profileComplete
    await assertSucceeds(
      asUser(testEnv, UID_PLAYER_B, { verified: false, profileComplete: false }).doc(docA()).get()
    );
  });
});

describe("league_standings — listagem (list)", () => {
  it("Não-autenticado NÃO pode listar standings", async () => {
    await assertFails(asAnon(testEnv).collection(`groups/${GRUPO_A}/league_standings`).get());
  });

  it("Membro ACTIVE (PlayerB) pode listar standings do próprio grupo", async () => {
    await assertSucceeds(asPlayerB(testEnv).collection(`groups/${GRUPO_A}/league_standings`).get());
  });

  it("Não-membro (FIELD_OWNER) NÃO pode listar standings do grupo", async () => {
    await assertFails(asFieldOwner(testEnv).collection(`groups/${GRUPO_A}/league_standings`).get());
  });
});

// Escrita: `allow write: if false`. Vale para todos os papéis, inclusive admin e dono.
const escritores = [
  ["admin global", () => asAdmin(testEnv)],
  ["dono do grupo (OWNER)", () => asPlayerA(testEnv)],
  ["membro ACTIVE", () => asPlayerB(testEnv)],
  ["anônimo", () => asAnon(testEnv)],
] as const;

describe("league_standings — escrita (write: if false)", () => {
  for (const [papel, contexto] of escritores) {
    it(`${papel} NÃO pode criar standings`, async () => {
      await assertFails(contexto().doc(`groups/${GRUPO_A}/league_standings/2026-11`).set({ ranking: [] }));
    });

    it(`${papel} NÃO pode atualizar standings existentes`, async () => {
      await assertFails(contexto().doc(docA()).update({ ranking: [] }));
    });

    it(`${papel} NÃO pode apagar standings`, async () => {
      await assertFails(contexto().doc(docA()).delete());
    });
  }
});
