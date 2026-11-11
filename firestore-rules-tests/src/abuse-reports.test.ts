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

const SEED = "seed-report-001";

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
    target_id: UID_PLAYER_B,
    reason: "spam",
    status: "OPEN",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("abuse_reports — criação", () => {
  it("Não autenticado não cria", async () => {
    await assertFails(asAnon(testEnv).doc("abuse_reports/r-anon").set(validReport()));
  });

  it("Autor autenticado cria denúncia de jogador", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc("abuse_reports/r-ok").set(validReport()));
  });

  it("Autor autenticado cria denúncia de grupo, com group_id", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc("abuse_reports/r-grupo").set(
        validReport({ target_type: "group", target_id: "grupo-1", group_id: "grupo-1" })
      )
    );
  });

  it("Negado em nome de outro usuário (reporter_id diferente do uid)", async () => {
    await assertFails(
      asPlayerB(testEnv).doc("abuse_reports/r-outro").set(validReport())
    );
  });

  it("Negado com target_type fora da lista", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("abuse_reports/r-tipo").set(validReport({ target_type: "game" }))
    );
  });

  it("Negado com motivo fora da lista", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("abuse_reports/r-motivo").set(validReport({ reason: "qualquer" }))
    );
  });

  it("Negado com status diferente de OPEN", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("abuse_reports/r-status").set(validReport({ status: "RESOLVED" }))
    );
  });

  it("Negado com created_at do cliente (não é o horário do servidor)", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("abuse_reports/r-data").set(validReport({ created_at: new Date() }))
    );
  });

  it("Negado com campo desconhecido", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("abuse_reports/r-extra").set(validReport({ admin: true }))
    );
  });

  it("Negado sem target_id", async () => {
    const { target_id: _omit, ...sem } = validReport();
    await assertFails(asPlayerA(testEnv).doc("abuse_reports/r-sem-alvo").set(sem));
  });

  it("Negado com target_name acima de 120 caracteres", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("abuse_reports/r-nome").set(validReport({ target_name: "n".repeat(121) }))
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
