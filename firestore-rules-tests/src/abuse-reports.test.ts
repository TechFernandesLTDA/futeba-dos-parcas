/**
 * Testes de Firestore Security Rules — Coleção: abuse_reports
 * (denúncia de jogador ou de grupo, diretriz 1.2 da App Store).
 *
 * Regras lidas em firestore.rules (match /abuse_reports/{reportId}):
 * - create: autenticado, reporter_id == uid, target_type player|group, reason da lista,
 *   status OPEN, created_at == request.time, só os campos conhecidos.
 * - read/update/delete: ninguém pelo cliente (nem admin; a moderação lê pelo Admin SDK).
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
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

const SEED = `${UID_PLAYER_A}_player_seed-alvo`;

/** ID determinístico exigido pelas regras: {uid}_{tipo}_{alvo}. */
const OK_ID = `${UID_PLAYER_A}_player_${UID_PLAYER_B}`;

function validReport(extra: Record<string, unknown> = {}) {
  return {
    reporter_id: UID_PLAYER_A,
    target_type: "player",
    target_id: UID_PLAYER_B,
    target_name: "Jogador B",
    reason: "harassment",
    status: "OPEN",
    created_at: serverTimestamp(),
    ...extra,
  };
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, `abuse_reports/${SEED}`, {
    reporter_id: UID_PLAYER_A,
    target_type: "player",
    target_id: "seed-alvo",
    reason: "spam",
    status: "OPEN",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("abuse_reports — criação", () => {
  it("Sem login não cria", async () => {
    await assertFails(asAnon(testEnv).doc(`abuse_reports/${OK_ID}`).set(validReport()));
  });

  it("Autor autenticado cria denúncia de jogador com o ID determinístico", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(`abuse_reports/${OK_ID}`).set(validReport()));
  });

  it("Autor autenticado cria denúncia de grupo, com group_id", async () => {
    await assertSucceeds(
      asPlayerA(testEnv)
        .doc(`abuse_reports/${UID_PLAYER_A}_group_grupo-1`)
        .set(validReport({ target_type: "group", target_id: "grupo-1", group_id: "grupo-1" }))
    );
  });

  it("Outro uid: não cria em nome de outra pessoa", async () => {
    // PlayerB tenta gravar uma denúncia com reporter_id de PlayerA.
    await assertFails(asPlayerB(testEnv).doc(`abuse_reports/${OK_ID}`).set(validReport()));
  });

  it("Outro uid: não cria nem com o próprio ID se reporter_id for de outra pessoa", async () => {
    await assertFails(
      asPlayerB(testEnv)
        .doc(`abuse_reports/${UID_PLAYER_B}_player_${UID_PLAYER_B}x`)
        .set(validReport({ target_id: `${UID_PLAYER_B}x` }))
    );
  });

  it("Denúncia repetida do mesmo alvo é negada (só criar, uma vez)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`abuse_reports/${OK_ID}`).set(validReport()));
    await assertFails(db.doc(`abuse_reports/${OK_ID}`).set(validReport({ reason: "spam" })));
  });

  it("Autodenúncia é negada", async () => {
    await assertFails(
      asPlayerA(testEnv)
        .doc(`abuse_reports/${UID_PLAYER_A}_player_${UID_PLAYER_A}`)
        .set(validReport({ target_id: UID_PLAYER_A }))
    );
  });

  it("Campo extra é negado", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`abuse_reports/${OK_ID}`).set(validReport({ admin: true }))
    );
  });

  it("ID de documento fora do padrão é negado (burla do limite)", async () => {
    await assertFails(asPlayerA(testEnv).doc("abuse_reports/qualquer-id").set(validReport()));
  });

  it("Negado com target_type fora da lista", async () => {
    await assertFails(
      asPlayerA(testEnv)
        .doc(`abuse_reports/${UID_PLAYER_A}_game_${UID_PLAYER_B}`)
        .set(validReport({ target_type: "game" }))
    );
  });

  it("Negado com motivo fora da lista", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`abuse_reports/${OK_ID}`).set(validReport({ reason: "qualquer" }))
    );
  });

  it("Negado com status diferente de OPEN", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`abuse_reports/${OK_ID}`).set(validReport({ status: "RESOLVED" }))
    );
  });

  it("Negado com created_at do cliente (não é o horário do servidor)", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`abuse_reports/${OK_ID}`).set(validReport({ created_at: new Date() }))
    );
  });

  it("Negado sem target_id", async () => {
    const { target_id: _omit, ...sem } = validReport();
    await assertFails(asPlayerA(testEnv).doc(`abuse_reports/${OK_ID}`).set(sem));
  });

  it("Negado com target_name acima de 120 caracteres", async () => {
    await assertFails(
      asPlayerA(testEnv)
        .doc(`abuse_reports/${OK_ID}`)
        .set(validReport({ target_name: "n".repeat(121) }))
    );
  });
});

describe("abuse_reports — leitura e alteração", () => {
  it("O autor não lê a própria denúncia", async () => {
    await assertFails(asPlayerA(testEnv).doc(`abuse_reports/${SEED}`).get());
  });

  it("Outro jogador não lê", async () => {
    await assertFails(asPlayerB(testEnv).doc(`abuse_reports/${SEED}`).get());
  });

  it("Admin não lê pelo cliente", async () => {
    await assertFails(asAdmin(testEnv).doc(`abuse_reports/${SEED}`).get());
  });

  it("Ninguém lista a coleção", async () => {
    await assertFails(asPlayerA(testEnv).collection("abuse_reports").get());
  });

  it("O autor não altera nem apaga", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`abuse_reports/${SEED}`).update({ reason: "other" }));
    await assertFails(db.doc(`abuse_reports/${SEED}`).delete());
  });

  it("Admin não altera nem apaga pelo cliente", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`abuse_reports/${SEED}`).update({ status: "RESOLVED" }));
    await assertFails(db.doc(`abuse_reports/${SEED}`).delete());
  });
});
