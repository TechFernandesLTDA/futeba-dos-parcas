/**
 * Permissões — votação pós-jogo (mvp_votes, mvp_id do jogo e reações do resultado).
 *
 * Fonte das regras: firestore.rules
 *   - mvp_votes: linhas 3722-3738 (+ isOwnMvpVoteId, linha 394)
 *   - games: mvp_id do dono/admin, linhas 1285-1287
 *   - games: vote_result_reactions, linhas 1288-1307 (janela de 72h após CONCLUDED)
 *
 * Cobre (UC7):
 * - leitura do próprio voto e do id determinístico ainda inexistente
 * - leitura alheia e listagem negadas
 * - voto direto negado (duplicado, de quem não jogou, de dono e de admin): votos são
 *   escritos só pela callable submitMvpVote / submitMvpVotes (Admin SDK)
 * - reações no resultado: só jogador confirmado, dentro da janela de 72h, votação CONCLUDED
 *
 * Limite: a regra de janela de votação e de "quem jogou" para o voto em si vive na
 * callable. Aqui testamos só o que as rules decidem.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initTestEnv, seedDocs, asUser } from "./helpers.js";

const HORA = 60 * 60 * 1000;

const UID_DONO = "user-owner";
const UID_MEMBRO = "user-member";
const UID_VISITANTE = "user-visitor";
const UID_ADMIN_GLOBAL = "user-global-admin";

const GRUPO = "grp-voto-01";
const JOGO_VOTACAO = "jogo-votacao";
const JOGO_EM_ABERTO = "jogo-em-votacao";
const JOGO_ANTIGO = "jogo-antigo";

let testEnv: RulesTestEnvironment;

const membro = () => asUser(testEnv, UID_MEMBRO);
const visitante = () => asUser(testEnv, UID_VISITANTE);
const dono = () => asUser(testEnv, UID_DONO);
const adminGlobal = () => asUser(testEnv, UID_ADMIN_GLOBAL, { role: "ADMIN" });

function jogoFinalizado(extra: Record<string, unknown> = {}) {
  return {
    owner_id: UID_DONO,
    group_id: GRUPO,
    title: "Pelada Finalizada",
    status: "FINISHED",
    visibility: "GROUP_ONLY",
    date_time: new Date(Date.now() - 3 * HORA),
    max_players: 10,
    players_count: 2,
    goalkeepers_count: 0,
    team1_score: 2,
    team2_score: 1,
    created_at: new Date(Date.now() - 4 * HORA),
    voting_status: "CONCLUDED",
    voting_concluded_at: new Date(Date.now() - HORA),
    vote_result_reactions: {},
    ...extra,
  };
}

function voto(jogoId: string, eleitor: string, categoria: string, alvo: string) {
  return {
    game_id: jogoId,
    voter_id: eleitor,
    mvp_id: alvo,
    category: categoria,
    created_at: new Date(),
  };
}

async function seedBase() {
  await seedDocs(testEnv, [
    {
      path: `groups/${GRUPO}`,
      data: { name: "Grupo Votacao", owner_id: UID_DONO, is_public: false, status: "ACTIVE", member_count: 5, created_at: new Date() },
    },
    { path: `groups/${GRUPO}/members/${UID_DONO}`, data: { user_id: UID_DONO, role: "OWNER", status: "ACTIVE" } },
    { path: `groups/${GRUPO}/members/${UID_MEMBRO}`, data: { user_id: UID_MEMBRO, role: "MEMBER", status: "ACTIVE" } },

    { path: `games/${JOGO_VOTACAO}`, data: jogoFinalizado() },
    { path: `games/${JOGO_EM_ABERTO}`, data: jogoFinalizado({ voting_status: "OPEN", voting_concluded_at: null }) },
    {
      path: `games/${JOGO_ANTIGO}`,
      data: jogoFinalizado({ voting_concluded_at: new Date(Date.now() - 73 * HORA) }),
    },

    { path: `confirmations/${JOGO_VOTACAO}_${UID_MEMBRO}`, data: { game_id: JOGO_VOTACAO, user_id: UID_MEMBRO, status: "CONFIRMED", position: 1 } },
    { path: `confirmations/${JOGO_EM_ABERTO}_${UID_MEMBRO}`, data: { game_id: JOGO_EM_ABERTO, user_id: UID_MEMBRO, status: "CONFIRMED", position: 1 } },
    { path: `confirmations/${JOGO_ANTIGO}_${UID_MEMBRO}`, data: { game_id: JOGO_ANTIGO, user_id: UID_MEMBRO, status: "CONFIRMED", position: 1 } },

    { path: `mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_MVP`, data: voto(JOGO_VOTACAO, UID_MEMBRO, "MVP", UID_DONO) },
    { path: `mvp_votes/${JOGO_VOTACAO}_${UID_DONO}_MVP`, data: voto(JOGO_VOTACAO, UID_DONO, "MVP", UID_MEMBRO) },
  ]);
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBase();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA DO VOTO (anonimato)
// ============================================================

describe("votação — leitura do voto", () => {
  it("jogador lê o próprio voto e o id determinístico do voto ainda inexistente", async () => {
    await assertSucceeds(membro().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_MVP`).get());
    await assertSucceeds(membro().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_WORST`).get());
  });

  it("jogador NÃO lê voto alheio, nem voto com categoria fora do conjunto, mesmo com o próprio uid", async () => {
    await assertFails(membro().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_DONO}_MVP`).get());
    await assertFails(membro().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_FOO`).get());
  });

  it("jogador NÃO lista mvp_votes (anonimato); administrador lista", async () => {
    await assertFails(membro().collection("mvp_votes").get());
    await assertSucceeds(adminGlobal().collection("mvp_votes").get());
  });
});

// ============================================================
// ESCRITA DO VOTO (somente callable)
// ============================================================

describe("votação — escrita do voto", () => {
  it("voto direto é negado a quem jogou, a quem não jogou, ao dono e ao admin (duplicado incluído)", async () => {
    // Duplicado: o jogador já tem voto MVP neste jogo
    await assertFails(membro().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_BEST_GOALKEEPER`).set(
      voto(JOGO_VOTACAO, UID_MEMBRO, "BEST_GOALKEEPER", UID_DONO)
    ));
    // Quem não jogou
    await assertFails(visitante().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_VISITANTE}_MVP`).set(
      voto(JOGO_VOTACAO, UID_VISITANTE, "MVP", UID_DONO)
    ));
    await assertFails(dono().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_DONO}_WORST`).set(
      voto(JOGO_VOTACAO, UID_DONO, "WORST", UID_MEMBRO)
    ));
    await assertFails(adminGlobal().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_ADMIN_GLOBAL}_MVP`).set(
      voto(JOGO_VOTACAO, UID_ADMIN_GLOBAL, "MVP", UID_DONO)
    ));
  });

  it("eleitor NÃO altera nem apaga o próprio voto; administrador corrige voto", async () => {
    await assertFails(membro().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_MVP`).update({ mvp_id: UID_VISITANTE }));
    await assertFails(membro().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_MVP`).delete());
    await assertSucceeds(
      adminGlobal().doc(`mvp_votes/${JOGO_VOTACAO}_${UID_MEMBRO}_MVP`).update({ mvp_id: UID_VISITANTE })
    );
  });
});

// ============================================================
// MVP NO JOGO (games.mvp_id)
// ============================================================

describe("votação — mvp_id do jogo", () => {
  it("dono NÃO define mvp_id de si mesmo em jogo FINISHED (autopremiação)", async () => {
    // Esperado: o MVP vem só da votação, gravada pela Cloud Function (mvp-voting.ts:1450, Admin SDK).
    // Nenhum cliente grava mvp_id (GameDetailViewModel.kt:321 só copia localmente).
    await assertFails(dono().doc(`games/${JOGO_VOTACAO}`).update({ mvp_id: UID_DONO }));
  });

  it("membro comum NÃO define mvp_id; administrador define em jogo FINISHED", async () => {
    await assertFails(membro().doc(`games/${JOGO_VOTACAO}`).update({ mvp_id: UID_MEMBRO }));
    await assertSucceeds(adminGlobal().doc(`games/${JOGO_VOTACAO}`).update({ mvp_id: UID_MEMBRO }));
  });
});

// ============================================================
// REAÇÕES NO RESULTADO DA VOTAÇÃO
// ============================================================

describe("votação — reações no resultado", () => {
  it("jogador confirmado reage no resultado concluído dentro da janela de 72h", async () => {
    await assertSucceeds(
      membro().doc(`games/${JOGO_VOTACAO}`).update({ vote_result_reactions: { "🔥": [UID_MEMBRO] } })
    );
  });

  it("reação negada: fora da janela de 72h, votação ainda aberta, visitante sem vínculo", async () => {
    await assertFails(
      membro().doc(`games/${JOGO_ANTIGO}`).update({ vote_result_reactions: { "🔥": [UID_MEMBRO] } })
    );
    await assertFails(
      membro().doc(`games/${JOGO_EM_ABERTO}`).update({ vote_result_reactions: { "🔥": [UID_MEMBRO] } })
    );
    await assertFails(
      visitante().doc(`games/${JOGO_VOTACAO}`).update({ vote_result_reactions: { "🔥": [UID_VISITANTE] } })
    );
  });

  it("jogador NÃO reage em nome de outra pessoa", async () => {
    await assertFails(
      membro().doc(`games/${JOGO_VOTACAO}`).update({ vote_result_reactions: { "🔥": [UID_DONO] } })
    );
  });
});
