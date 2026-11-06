/**
 * Testes de Firestore Security Rules — Coleção: seasons (Controle de Ligas)
 *
 * CARACTERIZAÇÃO: descrevem o comportamento ATUAL das rules em firestore.rules,
 * inclusive o que parece errado. Quando a rule permite algo suspeito, o teste
 * afirma a permissão e leva o marcador "HOJE PERMITE (ver DIAGNOSTICO)".
 *
 * Rules lidas (match /seasons/{seasonId}):
 * - read: isAuthenticated() (não exige verified nem profileComplete)
 * - create/update/delete: isAdmin() (claim role == 'ADMIN'; não checa verified)
 *
 * Não há conceito de dono ou participante nesta coleção: o eixo de permissão
 * é anônimo x autenticado x admin.
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
  asUser,
  seedDoc,
  UID_ADMIN,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const SEASON_ATIVA = "season-2026-10";
const SEASON_ANTIGA = "season-2026-09";

beforeAll(async () => {
  testEnv = await initTestEnv();
  await testEnv.clearFirestore();

  await seedDoc(testEnv, `seasons/${SEASON_ATIVA}`, {
    name: "Liga Outubro 2026",
    status: "ACTIVE",
    start_date: new Date("2026-10-01T00:00:00Z"),
    end_date: new Date("2026-10-31T23:59:59Z"),
  });

  await seedDoc(testEnv, `seasons/${SEASON_ANTIGA}`, {
    name: "Liga Setembro 2026",
    status: "FINISHED",
    start_date: new Date("2026-09-01T00:00:00Z"),
    end_date: new Date("2026-09-30T23:59:59Z"),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("seasons — leitura (get)", () => {
  it("Não-autenticado NÃO pode ler season", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`seasons/${SEASON_ATIVA}`).get());
  });

  it("Autenticado comum (PlayerA) pode ler season (sem conceito de dono)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`seasons/${SEASON_ATIVA}`).get());
  });

  it("Outro usuário autenticado (PlayerB) pode ler season", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`seasons/${SEASON_ATIVA}`).get());
  });

  it("Admin pode ler season", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`seasons/${SEASON_ATIVA}`).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO): read só exige request.auth != null
  it("HOJE PERMITE (ver DIAGNOSTICO): token sem verified/profileComplete lê season", async () => {
    const db = asUser(testEnv, UID_PLAYER_C, { verified: false, profileComplete: false });
    await assertSucceeds(db.doc(`seasons/${SEASON_ATIVA}`).get());
  });
});

describe("seasons — listagem (list)", () => {
  it("Não-autenticado NÃO pode listar seasons", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("seasons").get());
  });

  it("Autenticado (PlayerA) pode listar seasons", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.collection("seasons").get());
  });

  it("Admin pode listar seasons", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.collection("seasons").get());
  });
});

describe("seasons — criação (create)", () => {
  it("Não-autenticado NÃO pode criar season", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("seasons/season-anon-hack").set({ name: "Hack", status: "ACTIVE" })
    );
  });

  it("PlayerA (autenticado comum) NÃO pode criar season", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("seasons/season-playera-hack").set({ name: "Hack", status: "ACTIVE" })
    );
  });

  it("Admin pode criar season", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("seasons/season-2026-11").set({
        name: "Liga Novembro 2026",
        status: "ACTIVE",
        start_date: new Date("2026-11-01T00:00:00Z"),
      })
    );
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): admin sem verified/profileComplete cria season", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): isAdmin() não checa verified
    const db = asUser(testEnv, UID_ADMIN, {
      role: "ADMIN",
      verified: false,
      profileComplete: false,
    });
    await assertSucceeds(
      db.doc("seasons/season-2026-12-unverified-admin").set({
        name: "Liga Dezembro 2026",
        status: "ACTIVE",
      })
    );
  });
});

describe("seasons — atualização (update)", () => {
  it("Não-autenticado NÃO pode atualizar season", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`seasons/${SEASON_ATIVA}`).update({ status: "FINISHED" }));
  });

  it("PlayerA NÃO pode atualizar season", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`seasons/${SEASON_ATIVA}`).update({ status: "FINISHED" }));
  });

  it("PlayerB (outro autenticado) NÃO pode atualizar season", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`seasons/${SEASON_ATIVA}`).update({ name: "Hack" }));
  });

  it("Admin pode atualizar season", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`seasons/${SEASON_ATIVA}`).update({ status: "FINISHED" }));
  });
});

describe("seasons — remoção (delete)", () => {
  it("Não-autenticado NÃO pode apagar season", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`seasons/${SEASON_ANTIGA}`).delete());
  });

  it("PlayerA NÃO pode apagar season", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`seasons/${SEASON_ANTIGA}`).delete());
  });

  it("Admin pode apagar season", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`seasons/${SEASON_ANTIGA}`).delete());
  });
});
