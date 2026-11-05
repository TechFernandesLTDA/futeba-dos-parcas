/**
 * Caracterização das Firestore Security Rules — Coleção: challenge_progress
 *
 * Estes testes descrevem o comportamento ATUAL das rules (ver firestore.rules,
 * `match /challenge_progress/{progressId}`), inclusive o que parece indevido.
 * Casos marcados com "HOJE PERMITE (ver DIAGNOSTICO)" afirmam que a rule
 * permite hoje algo que não deveria; quando a rule for corrigida, o teste
 * correspondente deve passar a falhar e ser invertido.
 *
 * Cobre, para get / list / create / update / delete:
 * - não autenticado, dono (userId == uid), outro usuário autenticado e admin
 *
 * Nenhuma rule é alterada aqui.
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
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const CHALLENGE_OK = "ch-cp-exists-001";
const CHALLENGE_MISSING = "ch-cp-missing-999";
const DOC_A = "cp-owner-a-001";
const DOC_B = "cp-owner-b-001";

/** Dados válidos de progresso para um dono. */
function progressOf(userId: string, extra: Record<string, unknown> = {}) {
  return {
    userId,
    challengeId: CHALLENGE_OK,
    progress: 1,
    completed: false,
    ...extra,
  };
}

/** Recria o estado conhecido antes de cada teste (isolamento entre casos). */
async function resetState() {
  await testEnv.clearFirestore();
  await seedDoc(testEnv, `challenges/${CHALLENGE_OK}`, {
    title: "Desafio existente",
    active: true,
  });
  await seedDoc(testEnv, `challenge_progress/${DOC_A}`, progressOf(UID_PLAYER_A, { progress: 2 }));
  await seedDoc(testEnv, `challenge_progress/${DOC_B}`, progressOf(UID_PLAYER_B, { progress: 1 }));
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await resetState();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================
// READ (get)
// ============================================
describe("challenge_progress — get", () => {
  it("não autenticado NÃO lê progresso", async () => {
    await assertFails(asAnon(testEnv).doc(`challenge_progress/${DOC_A}`).get());
  });

  it("dono (userId == uid) lê o próprio progresso", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(`challenge_progress/${DOC_A}`).get());
  });

  it("outro usuário autenticado NÃO lê progresso alheio", async () => {
    await assertFails(asPlayerB(testEnv).doc(`challenge_progress/${DOC_A}`).get());
  });

  it("admin lê progresso de qualquer usuário", async () => {
    await assertSucceeds(asAdmin(testEnv).doc(`challenge_progress/${DOC_A}`).get());
  });
});

// ============================================
// LIST (query)
// ============================================
describe("challenge_progress — list", () => {
  it("não autenticado NÃO faz list filtrado por userId", async () => {
    await assertFails(
      asAnon(testEnv).collection("challenge_progress").where("userId", "==", UID_PLAYER_A).get()
    );
  });

  it("dono faz list filtrado pelo próprio userId", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).collection("challenge_progress").where("userId", "==", UID_PLAYER_A).get()
    );
  });

  it("dono NÃO faz list sem filtro (coleção inteira)", async () => {
    await assertFails(asPlayerA(testEnv).collection("challenge_progress").get());
  });

  it("outro usuário NÃO faz list filtrado pelo userId alheio", async () => {
    await assertFails(
      asPlayerB(testEnv).collection("challenge_progress").where("userId", "==", UID_PLAYER_A).get()
    );
  });

  it("admin faz list sem filtro", async () => {
    await assertSucceeds(asAdmin(testEnv).collection("challenge_progress").get());
  });
});

// ============================================
// CREATE
// ============================================
describe("challenge_progress — create", () => {
  it("não autenticado NÃO cria progresso", async () => {
    await assertFails(
      asAnon(testEnv).doc("challenge_progress/cp-new-anon").set(progressOf(UID_PLAYER_A))
    );
  });

  it("dono cria progresso próprio com challenge existente", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc("challenge_progress/cp-new-a").set(progressOf(UID_PLAYER_A))
    );
  });

  it("dono NÃO cria progresso apontando para challenge inexistente", async () => {
    await assertFails(
      asPlayerA(testEnv)
        .doc("challenge_progress/cp-new-missing")
        .set(progressOf(UID_PLAYER_A, { challengeId: CHALLENGE_MISSING }))
    );
  });

  it("dono NÃO cria progresso em nome de outro userId", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("challenge_progress/cp-new-for-b").set(progressOf(UID_PLAYER_B))
    );
  });

  it("outro usuário NÃO cria progresso com userId alheio", async () => {
    await assertFails(
      asPlayerB(testEnv).doc("challenge_progress/cp-new-steal").set(progressOf(UID_PLAYER_A))
    );
  });

  it("dono NÃO cria progresso com progress negativo", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("challenge_progress/cp-new-neg").set(progressOf(UID_PLAYER_A, { progress: -1 }))
    );
  });

  it("dono NÃO cria progresso com progress não numérico", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("challenge_progress/cp-new-str").set(progressOf(UID_PLAYER_A, { progress: "3" }))
    );
  });

  it("dono NÃO cria progresso já marcado como completed=true", async () => {
    await assertFails(
      asPlayerA(testEnv)
        .doc("challenge_progress/cp-new-completed")
        .set(progressOf(UID_PLAYER_A, { completed: true }))
    );
  });

  // HOJE PERMITE (ver DIAGNOSTICO): não há teto superior para `progress`.
  // O FIXME #2627 diz que a escrita deveria migrar para Cloud Function com
  // validação server-side; hoje o cliente pode gravar progresso arbitrariamente alto.
  it("HOJE PERMITE (ver DIAGNOSTICO): dono cria progress absurdamente alto (sem teto)", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc("challenge_progress/cp-new-huge").set(progressOf(UID_PLAYER_A, { progress: 999999 }))
    );
  });

  it("outro usuário autenticado cria o PRÓPRIO progresso (userId == uid)", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc("challenge_progress/cp-new-b").set(progressOf(UID_PLAYER_B))
    );
  });

  it("admin cria progresso de outro usuário", async () => {
    await assertSucceeds(
      asAdmin(testEnv).doc("challenge_progress/cp-new-admin").set(progressOf(UID_PLAYER_B, { completed: true }))
    );
  });

  it("admin NÃO cria progresso com challenge inexistente", async () => {
    await assertFails(
      asAdmin(testEnv)
        .doc("challenge_progress/cp-new-admin-missing")
        .set(progressOf(UID_PLAYER_B, { challengeId: CHALLENGE_MISSING }))
    );
  });
});

// ============================================
// UPDATE
// ============================================
describe("challenge_progress — update", () => {
  it("não autenticado NÃO atualiza progresso", async () => {
    await assertFails(
      asAnon(testEnv).doc(`challenge_progress/${DOC_A}`).update({ progress: 3 })
    );
  });

  it("dono atualiza o próprio progresso (progress)", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`challenge_progress/${DOC_A}`).update({ progress: 3 })
    );
  });

  it("dono NÃO marca o próprio progresso como completed=true", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`challenge_progress/${DOC_A}`).update({ completed: true })
    );
  });

  it("dono NÃO atualiza progress negativo", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`challenge_progress/${DOC_A}`).update({ progress: -5 })
    );
  });

  it("dono NÃO atualiza apontando para challenge inexistente", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`challenge_progress/${DOC_A}`).update({ challengeId: CHALLENGE_MISSING })
    );
  });

  it("outro usuário NÃO atualiza progresso alheio mantendo userId do dono", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`challenge_progress/${DOC_A}`).update({ progress: 3 })
    );
  });

  // HOJE PERMITE (ver DIAGNOSTICO): a rule de update valida só
  // request.resource.data.userId, nunca resource.data.userId. Um usuário
  // consegue "roubar" o documento de outro regravando o userId com o próprio uid.
  it("HOJE PERMITE (ver DIAGNOSTICO): outro usuário assume progresso alheio regravando userId", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`challenge_progress/${DOC_A}`).update({ userId: UID_PLAYER_B })
    );
  });

  it("HOJE PERMITE (ver DIAGNOSTICO): dono 'puxa' progresso de outro usuário para si", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`challenge_progress/${DOC_B}`).update({ userId: UID_PLAYER_A })
    );
  });

  it("admin atualiza qualquer progresso, inclusive completed=true", async () => {
    await assertSucceeds(
      asAdmin(testEnv).doc(`challenge_progress/${DOC_A}`).update({ completed: true, progress: 10 })
    );
  });
});

// ============================================
// DELETE
// ============================================
describe("challenge_progress — delete", () => {
  it("não autenticado NÃO deleta progresso", async () => {
    await assertFails(asAnon(testEnv).doc(`challenge_progress/${DOC_A}`).delete());
  });

  it("dono NÃO deleta o próprio progresso (apenas admin)", async () => {
    await assertFails(asPlayerA(testEnv).doc(`challenge_progress/${DOC_A}`).delete());
  });

  it("outro usuário NÃO deleta progresso alheio", async () => {
    await assertFails(asPlayerB(testEnv).doc(`challenge_progress/${DOC_A}`).delete());
  });

  it("admin deleta progresso", async () => {
    await assertSucceeds(asAdmin(testEnv).doc(`challenge_progress/${DOC_A}`).delete());
  });
});
