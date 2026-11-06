/**
 * Testes de Firestore Security Rules — Coleção: season_final_standings
 *
 * CARACTERIZAÇÃO: descrevem o comportamento ATUAL das rules em firestore.rules,
 * inclusive o que parece errado. Quando a rule permite algo suspeito, o teste
 * afirma a permissão e leva o marcador "HOJE PERMITE (ver DIAGNOSTICO)".
 *
 * Rules lidas (match /season_final_standings/{standingId}):
 * - read: isAuthenticated() (histórico público para qualquer autenticado,
 *   conforme comentário CMD-12; não exige verified nem profileComplete)
 * - create/update/delete: isAdmin() (claim role == 'ADMIN'; não checa verified)
 *
 * Não há conceito de dono ou participante: o eixo é anônimo x autenticado x admin.
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

const STANDING_SETEMBRO = "season-2026-09_uid-player-a-001";
const STANDING_AGOSTO = "season-2026-08_uid-player-b-001";

beforeAll(async () => {
  testEnv = await initTestEnv();
  await testEnv.clearFirestore();

  await seedDoc(testEnv, `season_final_standings/${STANDING_SETEMBRO}`, {
    season_id: "season-2026-09",
    user_id: "uid-player-a-001",
    position: 1,
    xp: 1250,
    final_division: "GOLD",
  });

  await seedDoc(testEnv, `season_final_standings/${STANDING_AGOSTO}`, {
    season_id: "season-2026-08",
    user_id: "uid-player-b-001",
    position: 2,
    xp: 980,
    final_division: "SILVER",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("season_final_standings — leitura (get)", () => {
  it("Não-autenticado NÃO pode ler standing final", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).get());
  });

  it("Dono do registro (PlayerA) pode ler o próprio standing", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).get());
  });

  it("Outro usuário autenticado (PlayerB) pode ler standing de outro jogador", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).get());
  });

  it("Admin pode ler standing final", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).get());
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): token sem verified/profileComplete lê standing final", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): read só exige request.auth != null
    const db = asUser(testEnv, UID_PLAYER_C, { verified: false, profileComplete: false });
    await assertSucceeds(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).get());
  });
});

describe("season_final_standings — listagem (list)", () => {
  it("Não-autenticado NÃO pode listar standings finais", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("season_final_standings").get());
  });

  it("Autenticado (PlayerA) pode listar standings finais", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.collection("season_final_standings").get());
  });

  it("Admin pode listar standings finais", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.collection("season_final_standings").get());
  });
});

describe("season_final_standings — criação (create)", () => {
  it("Não-autenticado NÃO pode criar standing final", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("season_final_standings/hack-anon").set({ user_id: "x", position: 1, xp: 99999 })
    );
  });

  it("PlayerA (dono do próprio registro) NÃO pode criar standing final", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("season_final_standings/hack-playera").set({
        user_id: "uid-player-a-001",
        position: 1,
        xp: 99999,
      })
    );
  });

  it("Admin pode criar standing final", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("season_final_standings/season-2026-07_uid-player-c-001").set({
        season_id: "season-2026-07",
        user_id: "uid-player-c-001",
        position: 3,
        xp: 700,
      })
    );
  });

  // HOJE PERMITE (ver DIAGNOSTICO)
  it("HOJE PERMITE (ver DIAGNOSTICO): admin sem verified/profileComplete cria standing final", async () => {
    // HOJE PERMITE (ver DIAGNOSTICO): isAdmin() não checa verified
    const db = asUser(testEnv, UID_ADMIN, {
      role: "ADMIN",
      verified: false,
      profileComplete: false,
    });
    await assertSucceeds(
      db.doc("season_final_standings/season-2026-06_unverified-admin").set({
        season_id: "season-2026-06",
        user_id: "uid-player-c-001",
        position: 4,
        xp: 500,
      })
    );
  });
});

describe("season_final_standings — atualização (update)", () => {
  it("Não-autenticado NÃO pode atualizar standing final", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).update({ xp: 9999 }));
  });

  it("Dono do registro (PlayerA) NÃO pode atualizar o próprio standing", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).update({ xp: 9999 }));
  });

  it("Outro usuário autenticado (PlayerB) NÃO pode atualizar standing", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).update({ position: 1 }));
  });

  it("Admin pode atualizar standing final", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`season_final_standings/${STANDING_SETEMBRO}`).update({ xp: 1260 }));
  });
});

describe("season_final_standings — remoção (delete)", () => {
  it("Não-autenticado NÃO pode apagar standing final", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`season_final_standings/${STANDING_AGOSTO}`).delete());
  });

  it("Dono do registro (PlayerB) NÃO pode apagar o próprio standing", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`season_final_standings/${STANDING_AGOSTO}`).delete());
  });

  it("Admin pode apagar standing final", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`season_final_standings/${STANDING_AGOSTO}`).delete());
  });
});
