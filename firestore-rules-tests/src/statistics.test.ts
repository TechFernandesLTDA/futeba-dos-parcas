/**
 * Testes de Firestore Security Rules — Coleção: statistics
 *
 * CARACTERIZAÇÃO: descrevem o comportamento ATUAL das rules em firestore.rules,
 * inclusive o que parece errado. Quando a rule permite algo suspeito, o teste
 * afirma a permissão e leva o marcador "HOJE PERMITE (ver DIAGNOSTICO)".
 *
 * Rules lidas (match /statistics/{statId}):
 * - read: isAuthenticated() (qualquer autenticado lê qualquer doc; não há
 *   checagem de dono nem de verified/profileComplete)
 * - create/update: isAdmin() (claim role == 'ADMIN'; não checa verified)
 * - delete: false (nem admin apaga pelo cliente)
 *
 * Convenção de dono (functions/src/auth/uid-owned-collections.ts): o doc
 * `statistics/{uid}` tem ID = uid. A rule NÃO compara request.auth.uid com o
 * ID do doc, então o "dono" aqui é só a convenção de dados, não a regra.
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
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();
  await testEnv.clearFirestore();

  await seedDoc(testEnv, `statistics/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    totalGames: 12,
    totalGoals: 7,
    totalAssists: 3,
  });

  await seedDoc(testEnv, `statistics/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    totalGames: 4,
    totalGoals: 1,
    totalAssists: 0,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("statistics — leitura (get)", () => {
  it("Não-autenticado NÃO pode ler statistics", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_A}`).get());
  });

  it("Dono (PlayerA) pode ler as próprias statistics", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`statistics/${UID_PLAYER_A}`).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): outro usuário autenticado (PlayerB) lê statistics de PlayerA", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): read não compara request.auth.uid com o ID do doc
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`statistics/${UID_PLAYER_A}`).get());
  });

  it("Admin pode ler statistics", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`statistics/${UID_PLAYER_A}`).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): token sem verified/profileComplete lê statistics", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): read só exige request.auth != null
    const db = asUser(testEnv, UID_PLAYER_C, { verified: false, profileComplete: false });
    await assertSucceeds(db.doc(`statistics/${UID_PLAYER_B}`).get());
  });
});

describe("statistics — listagem (list)", () => {
  it("Não-autenticado NÃO pode listar statistics", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("statistics").get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): autenticado comum (PlayerA) lista statistics de todos os jogadores", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): list sem filtro por dono; devolve docs de outros uids
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.collection("statistics").get());
  });

  it("Admin pode listar statistics", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.collection("statistics").get());
  });
});

describe("statistics — criação (create)", () => {
  it("Não-autenticado NÃO pode criar statistics", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_C}`).set({ totalGames: 999 }));
  });

  it("Dono (PlayerC) NÃO pode criar as próprias statistics", async () => {
    const db = asUser(testEnv, UID_PLAYER_C, {});
    await assertFails(db.doc(`statistics/${UID_PLAYER_C}`).set({ totalGames: 999 }));
  });

  it("Admin pode criar statistics", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`statistics/${UID_PLAYER_C}`).set({
        user_id: UID_PLAYER_C,
        totalGames: 2,
        totalGoals: 0,
      })
    );
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): admin sem verified/profileComplete cria statistics", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): isAdmin() não checa verified
    const db = asUser(testEnv, UID_ADMIN, {
      role: "ADMIN",
      verified: false,
      profileComplete: false,
    });
    await assertSucceeds(
      db.doc("statistics/uid-unverified-admin-target").set({ totalGames: 1 })
    );
  });
});

describe("statistics — atualização (update)", () => {
  it("Não-autenticado NÃO pode atualizar statistics", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_A}`).update({ totalGoals: 999 }));
  });

  it("Dono (PlayerA) NÃO pode atualizar as próprias statistics", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_A}`).update({ totalGoals: 999 }));
  });

  it("Outro usuário autenticado (PlayerB) NÃO pode atualizar statistics de PlayerA", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_A}`).update({ totalGoals: 999 }));
  });

  it("Admin pode atualizar statistics", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`statistics/${UID_PLAYER_A}`).update({ totalGoals: 8 }));
  });
});

describe("statistics — remoção (delete)", () => {
  it("Não-autenticado NÃO pode apagar statistics", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_B}`).delete());
  });

  it("Dono (PlayerB) NÃO pode apagar as próprias statistics", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_B}`).delete());
  });

  it("Admin NÃO pode apagar statistics (delete: if false)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`statistics/${UID_PLAYER_B}`).delete());
  });
});
