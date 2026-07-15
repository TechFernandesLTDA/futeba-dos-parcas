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
const GAME_GROUP_ONLY_INVITED = "game-group-only-invited-001";
const LOCATION_PUBLISHED = "loc-published-game-001";
const LOCATION_SUSPENDED = "loc-suspended-game-001";
const LOCATION_OVERDUE = "loc-overdue-game-001";
const FIELD_ACTIVE = "field-active-game-001";
const FIELD_INACTIVE = "field-inactive-game-001";
const GROUP_PLAYER_A_QUALIFIED = "group-player-a-qualified";
const GROUP_PLAYER_A_SMALL = "group-player-a-small";
const GROUP_PLAYER_B_QUALIFIED = "group-player-b-qualified";

// Data futura para evitar rejeição de data passada (SECFIX #422)
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const validGamePayload = (overrides: Record<string, unknown> = {}) => ({
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
  group_id: GROUP_PLAYER_A_QUALIFIED,
  co_organizers: [],
  ...overrides,
});

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `groups/${GROUP_PLAYER_A_QUALIFIED}`, {
    name: "Grupo Player A Qualificado",
    owner_id: UID_PLAYER_A,
    status: "ACTIVE",
    member_count: 5,
  });
  await seedDoc(testEnv, `groups/${GROUP_PLAYER_A_SMALL}`, {
    name: "Grupo Player A Pequeno",
    owner_id: UID_PLAYER_A,
    status: "ACTIVE",
    member_count: 4,
  });
  await seedDoc(testEnv, `groups/${GROUP_PLAYER_B_QUALIFIED}`, {
    name: "Grupo Player B Qualificado",
    owner_id: UID_PLAYER_B,
    status: "ACTIVE",
    member_count: 5,
  });

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
    group_id: GROUP_PLAYER_A_QUALIFIED,
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
    group_id: GROUP_PLAYER_A_QUALIFIED,
  });

  await seedDoc(testEnv, `games/${GAME_GROUP_ONLY_INVITED}`, {
    title: "Jogo privado com reforco",
    owner_id: UID_PLAYER_A,
    status: "SCHEDULED",
    visibility: "GROUP_ONLY",
    date_time: futureDate,
    group_id: GROUP_PLAYER_A_QUALIFIED,
    co_organizers: [],
  });
  await seedDoc(testEnv, `confirmations/${GAME_GROUP_ONLY_INVITED}_${UID_PLAYER_B}`, {
    game_id: GAME_GROUP_ONLY_INVITED,
    user_id: UID_PLAYER_B,
    status: "PENDING",
  });

  const baseLocation = {
    name: "Arena Publicada",
    owner_id: UID_FIELD_OWNER,
    managers: [UID_FIELD_OWNER],
    is_active: true,
    is_verified: true,
    publication_status: "PUBLISHED",
    commercial_status: "ACTIVE",
    subscription_status: "ACTIVE",
    has_active_fields: true,
    rating: 0,
  };

  await seedDoc(testEnv, `locations/${LOCATION_PUBLISHED}`, baseLocation);
  await seedDoc(testEnv, `locations/${LOCATION_SUSPENDED}`, {
    ...baseLocation,
    publication_status: "SUSPENDED",
  });
  await seedDoc(testEnv, `locations/${LOCATION_OVERDUE}`, {
    ...baseLocation,
    subscription_status: "OVERDUE",
  });
  await seedDoc(testEnv, `locations/${LOCATION_PUBLISHED}/fields/${FIELD_ACTIVE}`, {
    name: "Quadra 1",
    location_id: LOCATION_PUBLISHED,
    is_active: true,
  });
  await seedDoc(testEnv, `locations/${LOCATION_PUBLISHED}/fields/${FIELD_INACTIVE}`, {
    name: "Quadra Inativa",
    location_id: LOCATION_PUBLISHED,
    is_active: false,
  });
  await seedDoc(testEnv, `locations/${LOCATION_SUSPENDED}/fields/${FIELD_ACTIVE}`, {
    name: "Quadra Suspensa",
    location_id: LOCATION_SUSPENDED,
    is_active: true,
  });
  await seedDoc(testEnv, `locations/${LOCATION_OVERDUE}/fields/${FIELD_ACTIVE}`, {
    name: "Quadra Vencida",
    location_id: LOCATION_OVERDUE,
    is_active: true,
  });

  await seedDoc(testEnv, "game_validation_signals/signal-game-active", {
    game_id: GAME_ACTIVE,
    type: "NO_CHECKINS",
    severity: "MEDIUM",
    score_delta: -25,
    created_by: "system",
    created_at: new Date(),
    validation_version: 1,
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

  it("Convidado PENDING pode abrir por GET o jogo GROUP_ONLY indicado", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`games/${GAME_GROUP_ONLY_INVITED}`).get());
  });

  it("Outsider sem convite NÃO pode abrir jogo GROUP_ONLY", async () => {
    const db = asFieldOwner(testEnv);
    await assertFails(db.doc(`games/${GAME_GROUP_ONLY_INVITED}`).get());
  });

  it("Convite não amplia LIST de jogos GROUP_ONLY", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.collection("games").where("visibility", "==", "GROUP_ONLY").get()
    );
  });
});

// ============================================================
// CRIAÇÃO (CREATE)
// ============================================================

describe("games — criação", () => {
  it("Player pode criar jogo com owner_id próprio", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-new-by-player-a").set(validGamePayload())
    );
  });

  it("Player pode criar jogo em location publicada, em dia e com quadra ativa", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-location-available").set(validGamePayload({
        location_id: LOCATION_PUBLISHED,
        field_id: FIELD_ACTIVE,
      }))
    );
  });

  it("Player NÃO pode criar jogo em location suspensa", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-location-suspended").set(validGamePayload({
        location_id: LOCATION_SUSPENDED,
        field_id: FIELD_ACTIVE,
      }))
    );
  });

  it("Player NÃO pode criar jogo em location com mensalidade vencida", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-location-overdue").set(validGamePayload({
        location_id: LOCATION_OVERDUE,
        field_id: FIELD_ACTIVE,
      }))
    );
  });

  it("Player NÃO pode criar jogo em location catalogada sem field_id ativo", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-location-without-field").set(validGamePayload({
        location_id: LOCATION_PUBLISHED,
      }))
    );
  });

  it("Player NÃO pode criar jogo selecionando field inativo", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-location-inactive-field").set(validGamePayload({
        location_id: LOCATION_PUBLISHED,
        field_id: FIELD_INACTIVE,
      }))
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

  it("Player NÃO pode criar jogo sem grupo base qualificado", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-without-qualified-group").set(validGamePayload({
        group_id: null,
      }))
    );
  });

  it("Player NÃO pode criar jogo com grupo de outro dono", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-other-owner-group").set(validGamePayload({
        group_id: GROUP_PLAYER_B_QUALIFIED,
      }))
    );
  });

  it("Player NÃO pode criar jogo com grupo próprio abaixo de 5 membros", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-small-owner-group").set(validGamePayload({
        group_id: GROUP_PLAYER_A_SMALL,
      }))
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

  it("Player NÃO pode criar jogo injetando validation_score", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-validation-create-player").set(validGamePayload({
        validation_score: 100,
        validation_status: "VALIDATED",
      }))
    );
  });

  it("Admin client NÃO pode criar jogo com campos server-only de validação", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("games/game-validation-create-admin").set(validGamePayload({
        owner_id: UID_PLAYER_B,
        validation_score: 100,
        validation_status: "VALIDATED",
      }))
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

  // #2400 — paridade de validação number_of_teams (2..4), tolerante a ausência
  it("Player pode criar jogo com number_of_teams=4 (no máximo válido)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-teams-valid").set({
        title: "Times válidos",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        number_of_teams: 4,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_PLAYER_A_QUALIFIED,
        co_organizers: [],
      })
    );
  });

  it("Player NÃO pode criar jogo com number_of_teams=5 (acima do máximo=4)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-teams-invalid-high").set({
        title: "Times demais",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        number_of_teams: 5, // inválido (máximo é 4)
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  it("Player NÃO pode criar jogo com number_of_teams=1 (abaixo do mínimo=2)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-teams-invalid-low").set({
        title: "Times de menos",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        number_of_teams: 1, // inválido (mínimo é 2)
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  it("Player pode criar jogo sem number_of_teams (campo tolerante a ausência — retrocompat)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-teams-absent").set({
        title: "Sem campo de times",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_PLAYER_A_QUALIFIED,
        co_organizers: [],
      })
    );
  });

  // #2398 — limite de recorrência: recurrence_count (2..52) + recurrence_end_date (string)
  it("Player pode criar jogo com recurrence_count=4 (modo 'N vezes' válido)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-recur-count-valid").set({
        title: "Recorrência por contagem",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        recurrence: "weekly",
        recurrence_count: 4,
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_PLAYER_A_QUALIFIED,
        co_organizers: [],
      })
    );
  });

  it("Player pode criar jogo com recurrence_end_date (modo 'até DD/MM')", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-recur-enddate-valid").set({
        title: "Recorrência por data-fim",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        recurrence: "weekly",
        recurrence_end_date: "2026-12-31",
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_PLAYER_A_QUALIFIED,
        co_organizers: [],
      })
    );
  });

  it("Player NÃO pode criar jogo com recurrence_count=53 (acima do hard cap=52)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-recur-count-high").set({
        title: "Recorrência exagerada",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        recurrence: "weekly",
        recurrence_count: 53, // inválido (máximo é 52)
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  it("Player NÃO pode criar jogo com recurrence_count=1 (abaixo do mínimo=2)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-recur-count-low").set({
        title: "Recorrência de 1",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        recurrence: "weekly",
        recurrence_count: 1, // inválido (mínimo é 2)
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
      })
    );
  });

  // Fase 4b: gênero do jogo. Enforcement SOFT — valida apenas a categoria do
  // JOGO ∈ {MALE,FEMALE,MIXED}, nunca o gênero do usuário.
  it("Player pode criar jogo com gender válido (FEMALE)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("games/game-gender-female").set({
        title: "Jogo Feminino",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        gender: "FEMALE",
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_PLAYER_A_QUALIFIED,
        co_organizers: [],
      })
    );
  });

  it("Player NÃO pode criar jogo com gender inválido (OTHER)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-gender-invalid").set({
        title: "Gênero Inválido",
        owner_id: UID_PLAYER_A,
        status: "SCHEDULED",
        date_time: futureDate,
        max_players: 10,
        max_goalkeepers: 2,
        gender: "OTHER", // inválido — só MALE/FEMALE/MIXED
        players_count: 0,
        goalkeepers_count: 0,
        team1_score: null,
        team2_score: null,
        group_id: GROUP_PLAYER_A_QUALIFIED,
        co_organizers: [],
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

  it("Dono NÃO pode alterar campos server-only de validação", async () => {
    await seedDoc(testEnv, "games/game-validation-update-owner", {
      title: "Validacao Owner",
      owner_id: UID_PLAYER_A,
      status: "SCHEDULED",
      date_time: futureDate,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 0,
      goalkeepers_count: 0,
      team1_score: null,
      team2_score: null,
      group_id: GROUP_PLAYER_A_QUALIFIED,
      co_organizers: [],
    });

    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-validation-update-owner").update({
        validation_score: 100,
        validation_status: "VALIDATED",
      })
    );
  });

  it("Dono NÃO pode alterar status de recompensa/XP server-only", async () => {
    await seedDoc(testEnv, "games/game-reward-update-owner", {
      title: "Reward Owner",
      owner_id: UID_PLAYER_A,
      status: "FINISHED",
      date_time: futureDate,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 10,
      goalkeepers_count: 1,
      team1_score: 2,
      team2_score: 1,
      xp_reward_status: "HELD_FOR_REVIEW",
      co_organizers: [],
    });

    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-reward-update-owner").update({
        xp_reward_status: "ELIGIBLE",
      })
    );
  });

  it("Admin client NÃO pode alterar campos server-only de validação", async () => {
    await seedDoc(testEnv, "games/game-validation-update-admin", {
      title: "Validacao Admin",
      owner_id: UID_PLAYER_A,
      status: "SCHEDULED",
      date_time: futureDate,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 0,
      goalkeepers_count: 0,
      team1_score: null,
      team2_score: null,
      group_id: GROUP_PLAYER_A_QUALIFIED,
      co_organizers: [],
    });

    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("games/game-validation-update-admin").update({
        validation_score: 100,
        validation_status: "VALIDATED",
      })
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

  it("Dono NÃO pode iniciar jogo direto para LIVE pelo cliente", async () => {
    await seedDoc(testEnv, "games/game-confirmed-client-live", {
      title: "Jogo Confirmado",
      owner_id: UID_PLAYER_A,
      status: "CONFIRMED",
      date_time: futureDate,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 10,
      goalkeepers_count: 1,
      team1_score: 0,
      team2_score: 0,
      group_id: GROUP_PLAYER_A_QUALIFIED,
      co_organizers: [],
    });

    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-confirmed-client-live").update({
        status: "LIVE",
        players_count: 10,
        goalkeepers_count: 1,
        team1_score: 0,
        team2_score: 0,
      })
    );
  });

  it("Dono NÃO pode finalizar jogo direto para FINISHED pelo cliente", async () => {
    await seedDoc(testEnv, "games/game-live-client-finish", {
      title: "Jogo Live",
      owner_id: UID_PLAYER_A,
      status: "LIVE",
      date_time: futureDate,
      max_players: 10,
      max_goalkeepers: 2,
      players_count: 10,
      goalkeepers_count: 1,
      team1_score: 2,
      team2_score: 1,
      group_id: GROUP_PLAYER_A_QUALIFIED,
      co_organizers: [],
    });

    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("games/game-live-client-finish").update({
        status: "FINISHED",
        players_count: 10,
        goalkeepers_count: 1,
        team1_score: 2,
        team2_score: 1,
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

  // Fase 4b: dono pode trocar o gênero do jogo desde que válido.
  it("Dono pode atualizar gênero do jogo para valor válido (FEMALE)", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`games/${GAME_PLAYER_A_OWNER}`).update({
        gender: "FEMALE",
        status: "SCHEDULED",
        team1_score: null,
        team2_score: null,
        players_count: 0,
        goalkeepers_count: 0,
      })
    );
  });

  it("Dono NÃO pode atualizar gênero do jogo para valor inválido (OTHER)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`games/${GAME_PLAYER_A_OWNER}`).update({
        gender: "OTHER", // inválido
        status: "SCHEDULED",
        team1_score: null,
        team2_score: null,
        players_count: 0,
        goalkeepers_count: 0,
      })
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

// ============================================================
// SINAIS DE VALIDAÇÃO (GAME VALIDATION SIGNALS)
// ============================================================

describe("game_validation_signals", () => {
  it("Admin pode ler sinais de validação", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("game_validation_signals/signal-game-active").get()
    );
  });

  it("Player NÃO pode ler sinais de validação", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("game_validation_signals/signal-game-active").get()
    );
  });

  it("Admin client NÃO pode escrever sinais de validação", async () => {
    const db = asAdmin(testEnv);
    await assertFails(
      db.doc("game_validation_signals/admin-write").set({
        game_id: GAME_ACTIVE,
        type: "NO_CHECKINS",
        severity: "MEDIUM",
      })
    );
  });
});
