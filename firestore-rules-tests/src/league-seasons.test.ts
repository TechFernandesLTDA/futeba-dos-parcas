/**
 * Testes de Firestore Security Rules — Subcoleção: groups/{groupId}/league_seasons
 *
 * CARACTERIZAÇÃO: descrevem o comportamento ATUAL das rules em firestore.rules,
 * inclusive o que parece errado. Quando a rule permite algo suspeito, o teste
 * afirma a permissão e leva o marcador "HOJE PERMITE (ver DIAGNOSTICO)".
 *
 * Rules lidas (match /groups/{groupId} > match /league_seasons/{docId}):
 * - read: isAuthenticated() && isGroupMember(groupId)
 *   isGroupMember: doc groups/{g}/members/{uid} existe, user_id == uid, e
 *   (sem campo status OU status == 'ACTIVE'). Não exige verified.
 * - write: false (nem admin global pelo cliente; só Admin SDK)
 *
 * Mesma matriz de papéis de league_standings: dono = OWNER (PlayerA), membro
 * ACTIVE = PlayerB, INACTIVE = PlayerC, não-membro = FIELD_OWNER, admin global
 * sem vínculo.
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

const GRUPO_A = "grp-temp-a";
const GRUPO_B = "grp-temp-b";
const UID_LEGADO = "uid-membro-legado-002";
const TEMPORADA = "season-2026-10";

beforeAll(async () => {
  testEnv = await initTestEnv();
  await testEnv.clearFirestore();

  await seedDocs(testEnv, [
    { path: `groups/${GRUPO_A}`, data: { name: "Grupo A", owner_id: UID_PLAYER_A, status: "ACTIVE" } },
    { path: `groups/${GRUPO_B}`, data: { name: "Grupo B", owner_id: UID_PLAYER_B, status: "ACTIVE" } },

    { path: `groups/${GRUPO_A}/members/${UID_PLAYER_A}`, data: { user_id: UID_PLAYER_A, role: "OWNER", status: "ACTIVE" } },
    { path: `groups/${GRUPO_A}/members/${UID_PLAYER_B}`, data: { user_id: UID_PLAYER_B, role: "PLAYER", status: "ACTIVE" } },
    { path: `groups/${GRUPO_A}/members/${UID_PLAYER_C}`, data: { user_id: UID_PLAYER_C, role: "PLAYER", status: "INACTIVE" } },
    { path: `groups/${GRUPO_A}/members/${UID_LEGADO}`, data: { user_id: UID_LEGADO, role: "PLAYER" } },

    { path: `groups/${GRUPO_B}/members/${UID_PLAYER_B}`, data: { user_id: UID_PLAYER_B, role: "OWNER", status: "ACTIVE" } },

    {
      path: `groups/${GRUPO_A}/league_seasons/${TEMPORADA}`,
      data: { season_id: TEMPORADA, name: "Liga Outubro 2026", status: "ACTIVE", group_id: GRUPO_A },
    },
    {
      path: `groups/${GRUPO_B}/league_seasons/${TEMPORADA}`,
      data: { season_id: TEMPORADA, name: "Liga Outubro 2026 (B)", status: "ACTIVE", group_id: GRUPO_B },
    },
  ]);
});

afterAll(async () => {
  await testEnv.cleanup();
});

const docA = () => `groups/${GRUPO_A}/league_seasons/${TEMPORADA}`;
const docB = () => `groups/${GRUPO_B}/league_seasons/${TEMPORADA}`;

describe("league_seasons — leitura (get)", () => {
  it("Não-autenticado NÃO pode ler league_seasons", async () => {
    await assertFails(asAnon(testEnv).doc(docA()).get());
  });

  it("Dono do grupo (membro OWNER, PlayerA) pode ler league_seasons", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(docA()).get());
  });

  it("Membro ACTIVE (PlayerB) pode ler league_seasons", async () => {
    await assertSucceeds(asPlayerB(testEnv).doc(docA()).get());
  });

  it("Membro com status INACTIVE (PlayerC) NÃO pode ler league_seasons", async () => {
    await assertFails(asUser(testEnv, UID_PLAYER_C).doc(docA()).get());
  });

  it("Não-membro autenticado (FIELD_OWNER) NÃO pode ler league_seasons", async () => {
    await assertFails(asFieldOwner(testEnv).doc(docA()).get());
  });

  it("Membro de outro grupo (PlayerA, só do Grupo A) NÃO pode ler league_seasons do Grupo B", async () => {
    await assertFails(asPlayerA(testEnv).doc(docB()).get());
  });

  // HOJE NEGA (ver DIAGNOSTICO): admin global sem vínculo ao grupo é negado
  it("HOJE NEGA (ver DIAGNOSTICO): admin global sem vínculo ao grupo NÃO lê league_seasons", async () => {
    await assertFails(asAdmin(testEnv).doc(docA()).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): membro legado sem campo status lê league_seasons", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): sem status, a existência do doc vale como vínculo ativo
    await assertSucceeds(asUser(testEnv, UID_LEGADO).doc(docA()).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): membro ACTIVE sem verified/profileComplete lê league_seasons", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): isGroupMember não exige verified nem profileComplete
    await assertSucceeds(
      asUser(testEnv, UID_PLAYER_B, { verified: false, profileComplete: false }).doc(docA()).get()
    );
  });
});

describe("league_seasons — listagem (list)", () => {
  it("Não-autenticado NÃO pode listar league_seasons", async () => {
    await assertFails(asAnon(testEnv).collection(`groups/${GRUPO_A}/league_seasons`).get());
  });

  it("Membro ACTIVE (PlayerB) pode listar league_seasons do próprio grupo", async () => {
    await assertSucceeds(asPlayerB(testEnv).collection(`groups/${GRUPO_A}/league_seasons`).get());
  });

  it("Não-membro (FIELD_OWNER) NÃO pode listar league_seasons do grupo", async () => {
    await assertFails(asFieldOwner(testEnv).collection(`groups/${GRUPO_A}/league_seasons`).get());
  });
});

// Escrita: `allow write: if false`. Vale para todos os papéis, inclusive admin e dono.
const escritores = [
  ["admin global", () => asAdmin(testEnv)],
  ["dono do grupo (OWNER)", () => asPlayerA(testEnv)],
  ["membro ACTIVE", () => asPlayerB(testEnv)],
  ["anônimo", () => asAnon(testEnv)],
] as const;

describe("league_seasons — escrita (write: if false)", () => {
  for (const [papel, contexto] of escritores) {
    it(`${papel} NÃO pode criar league_seasons`, async () => {
      await assertFails(
        contexto().doc(`groups/${GRUPO_A}/league_seasons/season-2026-11`).set({ status: "ACTIVE" })
      );
    });

    it(`${papel} NÃO pode atualizar league_seasons existente`, async () => {
      await assertFails(contexto().doc(docA()).update({ status: "FINISHED" }));
    });

    it(`${papel} NÃO pode apagar league_seasons`, async () => {
      await assertFails(contexto().doc(docA()).delete());
    });
  }
});
