/**
 * Permissões — marcação de jogo (games, confirmations, waitlist).
 *
 * Fonte das regras: firestore.rules
 *   - games: linhas 1143-1314 (leitura, criação, atualização, exclusão)
 *   - games/{id}/waitlist: linhas 1330-1356
 *   - confirmations (raiz): linhas 1711-1817
 *   - funções auxiliares: linhas 56-800 (ex.: isFutureGameDate, canCreateGameForQualifiedOwnedGroup)
 *
 * Cobre (UC6):
 * - criar jogo (dono com grupo de 5+ membros, grupo pequeno, membro, visitante, anônimo)
 * - leitura de jogo GROUP_ONLY e PUBLIC_OPEN por papel
 * - transições de status (agendado, confirmado, cancelado, finalizado) e alterações proibidas
 * - contadores de presença, exclusão de jogo
 * - confirmação de presença: convocação pelo dono, autoconfirmação negada, cancelamento
 * - lista de espera: leitura, entrada direta negada, saída e remoção
 *
 * Limite de escrita: entrada na lista de espera e confirmação de presença são
 * feitas por callable (Admin SDK). Por isso o caminho positivo desses fluxos
 * não é testado aqui; a negação de escrita direta é.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initTestEnv, seedDocs, asUser } from "./helpers.js";

const DIA = 24 * 60 * 60 * 1000;

const UID_DONO = "user-owner";
const UID_ADMIN = "user-admin";
const UID_MEMBRO = "user-member";
const UID_MEMBRO_2 = "user-member-2";
const UID_PENDENTE = "user-pending";
const UID_REMOVIDO = "user-removed";
const UID_VISITANTE = "user-visitor";
const UID_DONO_PEQUENO = "user-owner-small";
const UID_ADMIN_GLOBAL = "user-global-admin";

const GRUPO_5 = "grp-jogo-01";
const GRUPO_PEQUENO = "grp-jogo-02";

const JOGO_AGENDADO = "jogo-agendado";
const JOGO_PUBLICO = "jogo-publico";
const JOGO_FINALIZADO = "jogo-finalizado";
const JOGO_CANCELADO = "jogo-cancelado";

let testEnv: RulesTestEnvironment;

const dono = () => asUser(testEnv, UID_DONO);
const admin = () => asUser(testEnv, UID_ADMIN);
const membro = () => asUser(testEnv, UID_MEMBRO);
const membro2 = () => asUser(testEnv, UID_MEMBRO_2);
const visitante = () => asUser(testEnv, UID_VISITANTE);

function jogo(extra: Record<string, unknown> = {}) {
  return {
    owner_id: UID_DONO,
    group_id: GRUPO_5,
    title: "Pelada de Teste",
    status: "SCHEDULED",
    visibility: "GROUP_ONLY",
    date_time: new Date(Date.now() + 2 * DIA),
    max_players: 10,
    players_count: 1,
    goalkeepers_count: 0,
    team1_score: 0,
    team2_score: 0,
    created_at: new Date(),
    ...extra,
  };
}

function confirmacao(jogoId: string, uid: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    game_id: jogoId,
    user_id: uid,
    status,
    created_at: new Date(),
    ...extra,
  };
}

async function seedBase() {
  await seedDocs(testEnv, [
    {
      path: `groups/${GRUPO_5}`,
      data: { name: "Grupo Cinco", owner_id: UID_DONO, is_public: false, status: "ACTIVE", member_count: 5, created_at: new Date() },
    },
    { path: `groups/${GRUPO_5}/members/${UID_DONO}`, data: { user_id: UID_DONO, role: "OWNER", status: "ACTIVE" } },
    { path: `groups/${GRUPO_5}/members/${UID_ADMIN}`, data: { user_id: UID_ADMIN, role: "ADMIN", status: "ACTIVE" } },
    { path: `groups/${GRUPO_5}/members/${UID_MEMBRO}`, data: { user_id: UID_MEMBRO, role: "MEMBER", status: "ACTIVE" } },
    { path: `groups/${GRUPO_5}/members/${UID_MEMBRO_2}`, data: { user_id: UID_MEMBRO_2, role: "MEMBER", status: "ACTIVE" } },
    { path: `groups/${GRUPO_5}/members/${UID_REMOVIDO}`, data: { user_id: UID_REMOVIDO, role: "MEMBER", status: "REMOVED" } },
    {
      path: `groups/${GRUPO_PEQUENO}`,
      data: { name: "Grupo Pequeno", owner_id: UID_DONO_PEQUENO, is_public: false, status: "ACTIVE", member_count: 2, created_at: new Date() },
    },
    { path: `groups/${GRUPO_PEQUENO}/members/${UID_DONO_PEQUENO}`, data: { user_id: UID_DONO_PEQUENO, role: "OWNER", status: "ACTIVE" } },

    { path: `games/${JOGO_AGENDADO}`, data: jogo({ players_count: 2 }) },
    { path: `games/${JOGO_PUBLICO}`, data: jogo({ visibility: "PUBLIC_OPEN" }) },
    { path: `games/${JOGO_FINALIZADO}`, data: jogo({ status: "FINISHED", date_time: new Date(Date.now() - DIA), team1_score: 3, team2_score: 1 }) },
    { path: `games/${JOGO_CANCELADO}`, data: jogo({ status: "CANCELLED" }) },

    { path: `confirmations/${JOGO_AGENDADO}_${UID_MEMBRO}`, data: confirmacao(JOGO_AGENDADO, UID_MEMBRO, "CONFIRMED", { position: 1 }) },
    { path: `confirmations/${JOGO_AGENDADO}_${UID_PENDENTE}`, data: confirmacao(JOGO_AGENDADO, UID_PENDENTE, "PENDING") },
    { path: `confirmations/${JOGO_FINALIZADO}_${UID_MEMBRO}`, data: confirmacao(JOGO_FINALIZADO, UID_MEMBRO, "CONFIRMED", { position: 1 }) },
    { path: `confirmations/${JOGO_CANCELADO}_${UID_MEMBRO}`, data: confirmacao(JOGO_CANCELADO, UID_MEMBRO, "CONFIRMED", { position: 1 }) },

    {
      path: `games/${JOGO_AGENDADO}/waitlist/${UID_MEMBRO_2}`,
      data: { user_id: UID_MEMBRO_2, game_id: JOGO_AGENDADO, status: "WAITING", queue_position: 1, created_at: new Date() },
    },
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
// CRIAÇÃO DE JOGO
// ============================================================

describe("jogo — criação", () => {
  it("dono de grupo com 5+ membros cria jogo SCHEDULED GROUP_ONLY", async () => {
    await assertSucceeds(dono().doc("games/jogo-novo-1").set(jogo()));
  });

  it("criação com status CONFIRMED, sem visibility ou com data no passado é negada", async () => {
    await assertFails(dono().doc("games/jogo-novo-2").set(jogo({ status: "CONFIRMED" })));
    const semVisibilidade = jogo();
    delete (semVisibilidade as Record<string, unknown>).visibility;
    await assertFails(dono().doc("games/jogo-novo-3").set(semVisibilidade));
    await assertFails(dono().doc("games/jogo-novo-4").set(jogo({ date_time: new Date(Date.now() - 2 * DIA) })));
  });

  it("grupo com menos de 5 membros e membro comum (não dono) NÃO criam jogo no grupo", async () => {
    await assertFails(
      asUser(testEnv, UID_DONO_PEQUENO).doc("games/jogo-novo-5").set(jogo({ owner_id: UID_DONO_PEQUENO, group_id: GRUPO_PEQUENO }))
    );
    await assertFails(membro().doc("games/jogo-novo-6").set(jogo({ owner_id: UID_MEMBRO })));
  });

  it("visitante, anônimo e criação com campo de validação client-side são negados", async () => {
    await assertFails(visitante().doc("games/jogo-novo-7").set(jogo({ owner_id: UID_VISITANTE })));
    await assertFails(
      testEnv.unauthenticatedContext().firestore().doc("games/jogo-novo-8").set(jogo())
    );
    await assertFails(dono().doc("games/jogo-novo-9").set(jogo({ validation_status: "VALIDATED" })));
  });

});

// ============================================================
// LEITURA DO JOGO
// ============================================================

describe("jogo — leitura", () => {
  it("membro do grupo lê jogo GROUP_ONLY; visitante sem vínculo NÃO lê", async () => {
    await assertSucceeds(membro().doc(`games/${JOGO_AGENDADO}`).get());
    await assertFails(visitante().doc(`games/${JOGO_AGENDADO}`).get());
  });

  it("visitante lê jogo PUBLIC_OPEN", async () => {
    await assertSucceeds(visitante().doc(`games/${JOGO_PUBLICO}`).get());
  });

  it("jogador com convite pendente lê o jogo GROUP_ONLY, por ser o convidado", async () => {
    await assertSucceeds(asUser(testEnv, UID_PENDENTE).doc(`games/${JOGO_AGENDADO}`).get());
  });
});

// ============================================================
// STATUS E ATUALIZAÇÃO
// ============================================================

describe("jogo — status e atualização", () => {
  it("dono confirma o jogo (SCHEDULED para CONFIRMED) e depois o cancela", async () => {
    await assertSucceeds(dono().doc(`games/${JOGO_AGENDADO}`).update({ status: "CONFIRMED" }));
    await assertSucceeds(dono().doc(`games/${JOGO_AGENDADO}`).update({ status: "CANCELLED" }));
  });

  it("dono NÃO pula etapas (SCHEDULED para FINISHED), NÃO reverte cancelado e NÃO põe LIVE", async () => {
    await assertFails(dono().doc(`games/${JOGO_AGENDADO}`).update({ status: "FINISHED" }));
    await assertFails(dono().doc(`games/${JOGO_CANCELADO}`).update({ status: "SCHEDULED" }));
    await assertFails(dono().doc(`games/${JOGO_AGENDADO}`).update({ status: "LIVE" }));
  });

  it("membro comum NÃO altera status; dono NÃO troca owner_id do jogo", async () => {
    await assertFails(membro().doc(`games/${JOGO_AGENDADO}`).update({ status: "CONFIRMED" }));
    await assertFails(dono().doc(`games/${JOGO_AGENDADO}`).update({ owner_id: UID_MEMBRO }));
  });

  it("administrador global finaliza jogo agendado", async () => {
    await assertSucceeds(
      asUser(testEnv, UID_ADMIN_GLOBAL, { role: "ADMIN" }).doc(`games/${JOGO_AGENDADO}`).update({ status: "FINISHED" })
    );
  });
});

// ============================================================
// CONTADORES DE PRESENÇA E EXCLUSÃO
// ============================================================

describe("jogo — contadores e exclusão", () => {
  it("membro do grupo incrementa players_count em 1", async () => {
    await assertSucceeds(membro2().doc(`games/${JOGO_AGENDADO}`).update({ players_count: 3 }));
  });

  it("membro NÃO move players_count em 2 de uma vez, e visitante NÃO altera o contador", async () => {
    await assertFails(membro2().doc(`games/${JOGO_AGENDADO}`).update({ players_count: 4 }));
    await assertFails(visitante().doc(`games/${JOGO_AGENDADO}`).update({ players_count: 3 }));
  });

  it("dono apaga jogo agendado; jogo FINISHED não é apagado nem pelo dono nem pelo admin", async () => {
    await assertFails(dono().doc(`games/${JOGO_FINALIZADO}`).delete());
    await assertFails(admin().doc(`games/${JOGO_FINALIZADO}`).delete());
    await assertSucceeds(dono().doc(`games/${JOGO_AGENDADO}`).delete());
  });
});

// ============================================================
// CONFIRMAÇÃO DE PRESENÇA (confirmations)
// ============================================================

describe("confirmação de presença", () => {
  it("jogador NÃO cria a própria confirmação CONFIRMED; dono convoca jogador com PENDING", async () => {
    await assertFails(
      membro2().doc(`confirmations/${JOGO_AGENDADO}_${UID_MEMBRO_2}`).set(
        confirmacao(JOGO_AGENDADO, UID_MEMBRO_2, "CONFIRMED", { payment_status: "PENDING" })
      )
    );
    await assertSucceeds(
      dono().doc(`confirmations/${JOGO_AGENDADO}_user-convocado`).set(
        confirmacao(JOGO_AGENDADO, "user-convocado", "PENDING", { payment_status: "PENDING" })
      )
    );
  });

  it("dono NÃO convoca como CONFIRMED nem convoca a si mesmo", async () => {
    await assertFails(
      dono().doc(`confirmations/${JOGO_AGENDADO}_user-convocado-2`).set(
        confirmacao(JOGO_AGENDADO, "user-convocado-2", "CONFIRMED", { payment_status: "PENDING" })
      )
    );
    await assertFails(
      dono().doc(`confirmations/${JOGO_AGENDADO}_${UID_DONO}`).set(
        confirmacao(JOGO_AGENDADO, UID_DONO, "PENDING", { payment_status: "PENDING" })
      )
    );
  });

  it("jogador marca ETA na própria confirmação, mas NÃO altera o próprio status", async () => {
    await assertSucceeds(
      membro().doc(`confirmations/${JOGO_AGENDADO}_${UID_MEMBRO}`).update({ is_on_the_way: true, updated_at: new Date() })
    );
    await assertFails(
      membro().doc(`confirmations/${JOGO_AGENDADO}_${UID_MEMBRO}`).update({ status: "PENDING", updated_at: new Date() })
    );
  });

  it("jogador cancela a própria presença só com jogo SCHEDULED/CONFIRMED; NÃO com jogo cancelado ou finalizado", async () => {
    await assertSucceeds(
      membro().doc(`confirmations/${JOGO_AGENDADO}_${UID_MEMBRO}`).update({ status: "CANCELLED", updated_at: new Date() })
    );
    await assertFails(
      membro().doc(`confirmations/${JOGO_CANCELADO}_${UID_MEMBRO}`).update({ status: "CANCELLED", updated_at: new Date() })
    );
    await assertFails(
      membro().doc(`confirmations/${JOGO_FINALIZADO}_${UID_MEMBRO}`).update({ status: "CANCELLED", updated_at: new Date() })
    );
  });

  it("dono grava gols em jogo FINISHED, mas NÃO injeta is_mvp nem grava em jogo agendado", async () => {
    await assertSucceeds(
      dono().doc(`confirmations/${JOGO_FINALIZADO}_${UID_MEMBRO}`).update({ goals: 2, updated_at: new Date() })
    );
    await assertFails(
      dono().doc(`confirmations/${JOGO_FINALIZADO}_${UID_MEMBRO}`).update({ is_mvp: true, updated_at: new Date() })
    );
    await assertFails(
      dono().doc(`confirmations/${JOGO_AGENDADO}_${UID_MEMBRO}`).update({ goals: 2, updated_at: new Date() })
    );
  });
});

// ============================================================
// LISTA DE ESPERA (games/{id}/waitlist)
// ============================================================

describe("lista de espera", () => {
  it("jogador lê a própria entrada; visitante NÃO lê a fila de jogo GROUP_ONLY", async () => {
    await assertSucceeds(membro2().doc(`games/${JOGO_AGENDADO}/waitlist/${UID_MEMBRO_2}`).get());
    await assertFails(visitante().doc(`games/${JOGO_AGENDADO}/waitlist/${UID_MEMBRO_2}`).get());
  });

  it("entrada na fila é negada no cliente (só pela callable); jogador sai da própria fila", async () => {
    await assertFails(
      membro().doc(`games/${JOGO_AGENDADO}/waitlist/${UID_MEMBRO}`).set({
        user_id: UID_MEMBRO,
        game_id: JOGO_AGENDADO,
        status: "WAITING",
        queue_position: 2,
        created_at: new Date(),
      })
    );
    await assertSucceeds(membro2().doc(`games/${JOGO_AGENDADO}/waitlist/${UID_MEMBRO_2}`).delete());
  });

  it("membro NÃO apaga entrada alheia na fila; dono do jogo remove entrada alheia", async () => {
    await assertFails(membro().doc(`games/${JOGO_AGENDADO}/waitlist/${UID_MEMBRO_2}`).delete());
    await assertSucceeds(dono().doc(`games/${JOGO_AGENDADO}/waitlist/${UID_MEMBRO_2}`).delete());
  });
});
