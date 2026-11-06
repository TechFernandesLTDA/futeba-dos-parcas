/**
 * Testes de Firestore Security Rules — Coleção: favorite_teams
 *
 * Caracterização do comportamento ATUAL (a rule não foi alterada).
 *
 * Rule: read para qualquer autenticado; create, update e delete `false`.
 * O comentário da rule diz que os dados são "geridos por admin/seed script",
 * mas a rule nega escrita até para admin. Os casos de admin com escrita e
 * também a leitura por não autenticado seguem essa divergência e estão
 * marcados como HOJE NEGA.
 *
 * Cobre get, list, create, update e delete para:
 * - não autenticado
 * - PlayerA (autenticado comum, sem "dono")
 * - PlayerB (outro autenticado)
 * - admin
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

const TEAM_ID = "team-flamengo";
const TEAM_PATH = `favorite_teams/${TEAM_ID}`;

const PAYLOAD_VALIDO = {
  name: "Flamengo",
  short_name: "FLA",
  logo_url: "https://example.com/fla.png",
  created_at: new Date(),
};

const PAYLOAD_INVALIDO = {
  name: 123,
  short_name: null,
};

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, TEAM_PATH, PAYLOAD_VALIDO);
});

describe("favorite_teams — leitura", () => {
  it("não autenticado não lê time favorito", async () => {
    await assertFails(asAnon(testEnv).doc(TEAM_PATH).get());
  });

  it("autenticado (PlayerA) lê time favorito", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(TEAM_PATH).get());
  });

  it("outro autenticado (PlayerB) lê time favorito", async () => {
    await assertSucceeds(asPlayerB(testEnv).doc(TEAM_PATH).get());
  });

  it("admin lê time favorito", async () => {
    await assertSucceeds(asAdmin(testEnv).doc(TEAM_PATH).get());
  });

  it("não autenticado não lista a coleção", async () => {
    await assertFails(asAnon(testEnv).collection("favorite_teams").get());
  });

  it("autenticado (PlayerA) lista a coleção", async () => {
    await assertSucceeds(asPlayerA(testEnv).collection("favorite_teams").get());
  });

  it("admin lista a coleção", async () => {
    await assertSucceeds(asAdmin(testEnv).collection("favorite_teams").get());
  });
});

describe("favorite_teams — criação", () => {
  const NOVO = "favorite_teams/team-novo";

  it("não autenticado não cria com payload válido", async () => {
    await assertFails(asAnon(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("PlayerA não cria com payload válido", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("PlayerA não cria com payload inválido", async () => {
    await assertFails(asPlayerA(testEnv).doc(NOVO).set(PAYLOAD_INVALIDO));
  });

  // HOJE NEGA (ver DIAGNOSTICO): comentário da rule diz "geridos por admin",
  // mas create é `false` para todo cliente, admin incluído.
  it("HOJE NEGA (ver DIAGNOSTICO): admin não cria time com payload válido", async () => {
    // HOJE NEGA (ver DIAGNOSTICO)
    await assertFails(asAdmin(testEnv).doc(NOVO).set(PAYLOAD_VALIDO));
  });

  it("admin não cria com payload inválido", async () => {
    await assertFails(asAdmin(testEnv).doc(NOVO).set(PAYLOAD_INVALIDO));
  });
});

describe("favorite_teams — atualização", () => {
  it("não autenticado não atualiza", async () => {
    await assertFails(asAnon(testEnv).doc(TEAM_PATH).update({ name: "X" }));
  });

  it("PlayerA não atualiza", async () => {
    await assertFails(asPlayerA(testEnv).doc(TEAM_PATH).update({ name: "X" }));
  });

  it("PlayerA não atualiza com campo inválido", async () => {
    await assertFails(asPlayerA(testEnv).doc(TEAM_PATH).update({ name: 1 }));
  });

  // HOJE NEGA (ver DIAGNOSTICO): admin deveria poder manter o catálogo.
  it("HOJE NEGA (ver DIAGNOSTICO): admin não atualiza time", async () => {
    // HOJE NEGA (ver DIAGNOSTICO)
    await assertFails(asAdmin(testEnv).doc(TEAM_PATH).update({ name: "Flamengo RJ" }));
  });
});

describe("favorite_teams — remoção", () => {
  it("não autenticado não remove", async () => {
    await assertFails(asAnon(testEnv).doc(TEAM_PATH).delete());
  });

  it("PlayerA não remove", async () => {
    await assertFails(asPlayerA(testEnv).doc(TEAM_PATH).delete());
  });

  // HOJE NEGA (ver DIAGNOSTICO): admin deveria poder remover entrada do catálogo.
  it("HOJE NEGA (ver DIAGNOSTICO): admin não remove time", async () => {
    // HOJE NEGA (ver DIAGNOSTICO)
    await assertFails(asAdmin(testEnv).doc(TEAM_PATH).delete());
  });
});
