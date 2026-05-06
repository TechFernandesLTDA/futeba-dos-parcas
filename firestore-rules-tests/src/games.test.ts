/**
 * Testes de Firestore Security Rules — Coleção: games
 *
 * Cobre:
 * - Leitura: bloqueada para soft-deleted (exceto admin), requer verified
 * - Criação: qualquer usuário verificado; owner_id deve ser o próprio; validações de bounds
 * - Atualização: owner/co-organizer (canManageGame); apenas admin delete
 * - Deleção: admin ou dono
 * - Escalação: player não pode alterar owner_id
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asFieldOwner,
  asAnon,
  seedDoc,
  UID_ADMIN,
  UID_FIELD_OWNER,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

// IDs de jogos utilizados nos testes
const GAME_ACTIVE = "game-active-001";
const GAME_DELETED = "game-deleted-001";
const GAME_PLAYER_A_OWNER = "game-player-a-owner-001";

// Data futura para evitar rejeição de data passada (SECFIX #422)
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Jogo ativo — dono é player A
  await seedDoc(testEnv, `games/${GAME_ACTIVE}`, {
    title: "Jogo Ativo",
    owner_id: UID_PLAYER_A,
    status: "SCHEDULED",
    date_time: futureDate,
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 0,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    group_id: null,
    co_organizers: [],
  });

  // Jogo soft-deleted — somente admin pode ler
  await seedDoc(testEnv, `games/${GAME_DELETED}`, {
    title: "Jogo Deletado",
    owner_id: UID_PLAYER_A,
    status: "CANCELLED",
    date_time: futureDate,
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 0,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    deleted_at: new Date(), // soft-deleted
    co_organizers: [],
  });

  // Jogo dono do player A — para testes de update/delete
  await seedDoc(testEnv, `games/${GAME_PLAYER_A_OWNER}`, {
    title: "Jogo PlayerA",
    owner_id: UID_PLAYER_A,
    status: "SCHEDULED",
    date_time: futureDate,
    max_players: 14,
    max_goalkeepers: 2,
    players_count: 0,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    co_organizers: [UID_FIELD_OWNER], // co-organizer
    group_id: null,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA (READ)
// ============================================================

describe("games — leitura", () => {
  it("Usuário verificado pode ler jogo ativo", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`games/${GAME_ACTIVE}`).get());
  });

  it("Admin pode ler jogo soft-deleted", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`games/${GAME_DELETED}`).get());
  });

  it("Player NÃO pode ler jogo soft-deleted", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`games/${GAME_DELETED}`).get());
  });

  it("Não-autenticado NÃO pode ler jogos", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`games/${GAME_ACTIVE}`).get());
  });
});

// ============================================================
// CRIAÇÃO (CREATE)
// ============================================================

describe("games — criação", () => {
  it("Player pode criar jogo com owner_id próprio", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-new-by-player-a").set({
        title: "Novo Jogo",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: null,
        co_organizers: [],
      })
    );
  });

  it("Player NÃO pode criar jogo com owner_id de outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-fraud-owner").set({
        title: "Fraude",
        owner_id: UID_PLAYER_B, // escalação
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  it("Admin pode criar jogo com qualquer owner_id", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("games/game-created-by-admin").set({
        title: "Jogo Admin",
        owner_id: UID_PLAYER_B,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  it("Player NÃO pode criar jogo com score acima de 100 (anti-exploit XP)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-exploit-score").set({
        title: "Exploit",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: 150, // inválido
        team2_score: 0,
      })
    );
  });

  it("Player NÃO pode criar jogo com max_players=1 (abaixo do mínimo=2)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-invalid-maxplayers").set({
        title: "Invalido",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 1, // inválido (mínimo é 2)
        max_goalkeepers: 0,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  it("Não-autenticado NÃO pode criar jogo", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("games/game-anon").set({
        title: "Anon",
        owner_id: "qualquer",
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO (UPDATE)
// ============================================================

describe("games — atualização", () => {
  it("Dono do jogo pode atualizar (transição de status válida)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ACTIVE}`).update({
        status: "CONFIRMED",
        players_count: 10,
        goalkeepers_count: 2,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  it("Admin pode atualizar qualquer jogo", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_ACTIVE}`).update({ title: "Admin Override" })
    );
  });

  it("Co-organizador pode atualizar o jogo", async () => {
    const db = asFieldOwner(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_PLAYER_A_OWNER}`).update({
        players_count: 5,
        goalkeepers_count: 1,
        team1_score: null,
        team2_score: null,
        status: "SCHEDULED",
      })
    );
  });

  it("Player sem ownership NÃO pode atualizar título do jogo", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ACTIVE}`).update({ title: "Invasão" })
    );
  });

  it("Player sem ownership NÃO pode alterar owner_id (privilege escalation)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`games/${GAME_ACTIVE}`).update({ owner_id: UID_PLAYER_B })
    );
  });
});

// ============================================================
// DELEÇÃO (DELETE)
// ============================================================

describe("games — deleção", () => {
  it("Admin pode deletar qualquer jogo", async () => {
    // Seed de jogo específico para deleção
    await seedDoc(testEnv, "games/game-for-admin-delete", {
      title: "Para Deletar",
      owner_id: UID_PLAYER_B,
      status: "SCHEDULED",
      date_time: futureDate,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 0,
      goalkeepers_count: 0,
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("games/game-for-admin-delete").delete());
  });

  it("Dono do jogo pode deletar próprio jogo", async () => {
    await seedDoc(testEnv, "games/game-for-owner-delete", {
      title: "Para Deletar Owner",
      owner_id: UID_PLAYER_A,
      status: "SCHEDULED",
      date_time: futureDate,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 0,
      goalkeepers_count: 0,
      co_organizers: [],
    });
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc("games/game-for-owner-delete").delete());
  });

  it("Outro player NÃO pode deletar jogo alheio", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(`games/${GAME_ACTIVE}`).delete());
  });

  it("Não-autenticado NÃO pode deletar jogo", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`games/${GAME_ACTIVE}`).delete());
  });
});
