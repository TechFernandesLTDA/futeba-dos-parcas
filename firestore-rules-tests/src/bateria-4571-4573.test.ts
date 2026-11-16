/**
 * Regressões achadas pela bateria de testes (scripts/bateria):
 *  - #4571: filas do admin em `games` (sem filtro de visibility/owner/grupo)
 *    eram negadas porque `isAdmin()` vinha depois de um ramo que estourava.
 *  - #4573: membro ativo do grupo do jogo não conseguia listar as confirmações
 *    antes de confirmar a própria presença.
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
  seedDocs,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GROUP = "bat-rules-grupo";
const GAME_RETIDO = "bat-rules-jogo-retido";
const GAME_SEM_GRUPO = "bat-rules-jogo-sem-grupo";
const UID_INATIVO = "bat-rules-membro-inativo";

function jogo(extra: Record<string, unknown>) {
  return {
    title: "Jogo da bateria",
    status: "FINISHED",
    visibility: "GROUP_ONLY",
    date_time: new Date(Date.now() - 24 * 60 * 60 * 1000),
    co_organizers: [],
    ...extra,
  };
}

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDocs(testEnv, [
    { path: `groups/${GROUP}`, data: { name: "Grupo da bateria", owner_id: UID_PLAYER_A, status: "ACTIVE" } },
    { path: `groups/${GROUP}/members/${UID_PLAYER_A}`, data: { user_id: UID_PLAYER_A, role: "OWNER", status: "ACTIVE" } },
    // Membro legado, sem `status`: a existência do documento é o vínculo ativo.
    { path: `groups/${GROUP}/members/${UID_PLAYER_B}`, data: { user_id: UID_PLAYER_B, role: "MEMBER" } },
    { path: `groups/${GROUP}/members/${UID_INATIVO}`, data: { user_id: UID_INATIVO, role: "MEMBER", status: "REMOVED" } },
    {
      path: `games/${GAME_RETIDO}`,
      data: jogo({ owner_id: UID_PLAYER_A, group_id: GROUP, xp_reward_status: "HELD_FOR_REVIEW" }),
    },
    // Documento sem `group_id`: era o que estourava a avaliação antes do admin.
    {
      path: `games/${GAME_SEM_GRUPO}`,
      data: jogo({ owner_id: UID_PLAYER_A, xp_reward_status: "HELD_FOR_REVIEW", auto_close_review_required: true }),
    },
    {
      path: `confirmations/${GAME_RETIDO}_${UID_PLAYER_A}`,
      data: { game_id: GAME_RETIDO, user_id: UID_PLAYER_A, status: "CONFIRMED" },
    },
    {
      path: `confirmations/${GAME_SEM_GRUPO}_${UID_PLAYER_A}`,
      data: { game_id: GAME_SEM_GRUPO, user_id: UID_PLAYER_A, status: "CONFIRMED" },
    },
  ]);
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("#4571 games: filas de revisão do admin", () => {
  it("ADMIN lista jogos por xp_reward_status sem filtrar visibility/owner/grupo", async () => {
    await assertSucceeds(
      asAdmin(testEnv).collection("games").where("xp_reward_status", "in", ["HELD_FOR_REVIEW", "REJECTED"]).get(),
    );
  });

  it("ADMIN lista jogos por auto_close_review_required", async () => {
    await assertSucceeds(
      asAdmin(testEnv).collection("games").where("auto_close_review_required", "==", true).get(),
    );
  });

  it("jogador NÃO faz a mesma consulta aberta (controle)", async () => {
    await assertFails(
      asPlayerC(testEnv).collection("games").where("xp_reward_status", "in", ["HELD_FOR_REVIEW", "REJECTED"]).get(),
    );
  });
});

describe("#4573 confirmations: membro do grupo do jogo lista os confirmados", () => {
  const confirmados = (db: ReturnType<typeof asPlayerA>, gameId: string) =>
    db.collection("confirmations").where("game_id", "==", gameId).get();

  it("membro ativo (legado, sem status) que não confirmou lista os confirmados", async () => {
    await assertSucceeds(confirmados(asPlayerB(testEnv), GAME_RETIDO));
  });

  it("quem não é do grupo NÃO lista (controle)", async () => {
    await assertFails(confirmados(asPlayerC(testEnv), GAME_RETIDO));
  });

  it("membro com status não ACTIVE NÃO lista", async () => {
    const inativo = testEnv
      .authenticatedContext(UID_INATIVO, { role: "PLAYER", verified: true, profileComplete: true })
      .firestore();
    await assertFails(confirmados(inativo, GAME_RETIDO));
  });

  it("jogo sem grupo continua restrito a dono, admin e confirmados", async () => {
    await assertFails(confirmados(asPlayerB(testEnv), GAME_SEM_GRUPO));
    await assertSucceeds(confirmados(asPlayerA(testEnv), GAME_SEM_GRUPO));
  });
});
