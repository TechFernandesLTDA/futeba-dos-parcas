/**
 * Testes de Firestore Security Rules — Auditoria de permissoes 2026-05-30
 *
 * Cobre os achados de rules confirmados e corrigidos nesta wave
 * (specs/audit-permissions-2026-05-30.md):
 *  - #4  cancellations: o proprio jogador deve ler sua entrada (era lockout)
 *  - #11 confirmations (subcolecao ETA): proprio jogador + admin devem ler
 *  - #5  users.create: bloquear self-injecao de auto_*_rating/samples
 *  - #12 users.update: bloquear spoof de 'verified'
 *
 * Cada bloco documenta o comportamento PÓS-fix; antes do fix as assercoes
 * marcadas "(NOVO)" falhavam (red -> green).
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asUser,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const G1 = "audit-game-1"; // owner = PLAYER_A

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${G1}`, {
    title: "Jogo Auditoria",
    owner_id: UID_PLAYER_A,
    status: "SCHEDULED",
    date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    max_players: 10,
    group_id: null,
    co_organizers: [],
  });

  // #4: cancelamento criado pelo PLAYER_B no jogo do PLAYER_A
  await seedDoc(testEnv, `games/${G1}/cancellations/${G1}_${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    game_id: G1,
    reason: "Imprevisto",
    created_at: new Date(),
  });

  // #11: entrada de ETA na subcolecao confirmations do PLAYER_B
  await seedDoc(testEnv, `games/${G1}/confirmations/${G1}_${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    game_id: G1,
    is_on_the_way: true,
    eta_minutes: 10,
    updated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("#4 cancellations — read pelo proprio jogador", () => {
  it("(NOVO) Proprio jogador le sua entrada de cancelamento", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`games/${G1}/cancellations/${G1}_${UID_PLAYER_B}`).get()
    );
  });

  it("Game owner le cancelamentos do seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`games/${G1}/cancellations/${G1}_${UID_PLAYER_B}`).get()
    );
  });

  it("Admin le qualquer cancelamento", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`games/${G1}/cancellations/${G1}_${UID_PLAYER_B}`).get()
    );
  });

  it("Outro jogador (nao-dono, nao-dono-do-doc) NAO le cancelamento alheio", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`games/${G1}/cancellations/${G1}_${UID_PLAYER_B}`).get()
    );
  });
});

describe("#11 confirmations (subcolecao ETA) — read pelo proprio jogador/admin", () => {
  it("(NOVO) Proprio jogador le sua entrada de ETA", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`games/${G1}/confirmations/${G1}_${UID_PLAYER_B}`).get()
    );
  });

  it("(NOVO) Admin le qualquer entrada de ETA", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`games/${G1}/confirmations/${G1}_${UID_PLAYER_B}`).get()
    );
  });

  it("Game owner le entradas de ETA do seu jogo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`games/${G1}/confirmations/${G1}_${UID_PLAYER_B}`).get()
    );
  });

  it("Outro jogador NAO le ETA alheio", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc(`games/${G1}/confirmations/${G1}_${UID_PLAYER_B}`).get()
    );
  });
});

describe("#5 users.create — bloqueia self-injecao de auto_*_rating", () => {
  const UID_NEW = "uid-audit-create-1";

  function validProfile(extra: Record<string, unknown> = {}) {
    return {
      name: "Novo Jogador",
      email: "novo@test.com",
      role: "PLAYER",
      striker_rating: 3.0,
      mid_rating: 3.0,
      defender_rating: 3.0,
      gk_rating: 3.0,
      created_at: new Date(),
      ...extra,
    };
  }

  it("Create de perfil limpo (sem auto_*) e permitido (controle)", async () => {
    const db = asUser(testEnv, UID_NEW);
    await assertSucceeds(db.doc(`users/${UID_NEW}`).set(validProfile()));
  });

  it("(NOVO) Create com auto_striker_rating injetado e NEGADO", async () => {
    const db = asUser(testEnv, "uid-audit-create-2");
    await assertFails(
      db
        .doc(`users/uid-audit-create-2`)
        .set(validProfile({ auto_striker_rating: 5.0 }))
    );
  });

  it("(NOVO) Create com auto_rating_samples injetado e NEGADO", async () => {
    const db = asUser(testEnv, "uid-audit-create-3");
    await assertFails(
      db
        .doc(`users/uid-audit-create-3`)
        .set(validProfile({ auto_rating_samples: 999 }))
    );
  });
});

describe("#12 users.update — bloqueia spoof de 'verified'", () => {
  const UID_UPD = "uid-audit-upd-1";

  beforeAll(async () => {
    await seedDoc(testEnv, `users/${UID_UPD}`, {
      name: "Jogador Update",
      email: "upd@test.com",
      role: "PLAYER",
      is_searchable: true,
      striker_rating: 3.0,
      mid_rating: 3.0,
      defender_rating: 3.0,
      gk_rating: 3.0,
      created_at: new Date(),
    });
  });

  it("Update de campo basico (name) e permitido (controle)", async () => {
    const db = asUser(testEnv, UID_UPD);
    await assertSucceeds(
      db.doc(`users/${UID_UPD}`).update({ name: "Nome Novo" })
    );
  });

  it("(NOVO) Update setando verified=true e NEGADO", async () => {
    const db = asUser(testEnv, UID_UPD);
    await assertFails(
      db.doc(`users/${UID_UPD}`).update({ verified: true })
    );
  });
});
