#!/usr/bin/env node
"use strict";

/**
 * Seed large demo data set for Futeba dos Parcas.
 *
 * Creates deterministic mock data marked with seed_id=mock6m_20260621:
 * - 40 players
 * - 2 public groups
 * - 3 locations/fields
 * - 180 finished games over the last 6 months, one realized game per day
 * - 8 upcoming games
 * - confirmations, teams, live scores, game events, xp logs and statistics
 * - global league participation, ranking deltas and group league standings
 *
 * Safe by default:
 *   node scripts/seed-demo-6m.js --dry-run
 *   node scripts/seed-demo-6m.js --apply --project futebadosparcas
 */

const admin = require("firebase-admin");

const SEED_ID = "mock6m_20260621";
const PLAYER_COUNT = 40;
const FINISHED_GAMES = 180;
const UPCOMING_GAMES = 8;
const DEFAULT_PROJECT = "futebadosparcas";
const BATCH_LIMIT = 450;
const MOCK_ACTIVE_SEASON_ID = `${SEED_ID}_active_season`;
const GROUP_LEAGUE_SEASON_ID = `${SEED_ID}_group_season`;

const args = new Set(process.argv.slice(2));
const getArg = (name, fallback) => {
  const prefix = `${name}=`;
  const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
};

const APPLY = args.has("--apply");
const PROJECT_ID = getArg("--project", process.env.GCLOUD_PROJECT || DEFAULT_PROJECT);

const FIRST_NAMES = [
  "Arthur", "Bruno", "Caio", "Diego", "Eduardo", "Felipe", "Gabriel",
  "Henrique", "Igor", "Joao", "Kaue", "Lucas", "Mateus", "Nicolas",
  "Otavio", "Paulo", "Rafael", "Samuel", "Thiago", "Victor",
  "Andre", "Bernardo", "Cesar", "Davi", "Enzo", "Fernando", "Gustavo",
  "Hugo", "Ian", "Julio", "Leo", "Marcos", "Noah", "Pedro", "Renato",
  "Sergio", "Tales", "Vinicius", "Wesley", "Yuri",
];

const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Lima", "Costa", "Pereira",
  "Almeida", "Ferreira", "Rodrigues",
];

const LOCATIONS = [
  {
    id: `${SEED_ID}_loc_arena_parcas`,
    fieldId: `${SEED_ID}_field_arena_1`,
    name: "Arena Parcas Mock",
    address: "Rua das Peladas, 100 - Sao Paulo, SP",
    city: "Sao Paulo",
    lat: -23.5617,
    lng: -46.6559,
    fieldName: "Campo Society 1",
    fieldType: "SOCIETY",
  },
  {
    id: `${SEED_ID}_loc_ct_varzea`,
    fieldId: `${SEED_ID}_field_ct_1`,
    name: "CT Varzea Mock",
    address: "Av. dos Campeoes, 220 - Sao Paulo, SP",
    city: "Sao Paulo",
    lat: -23.5489,
    lng: -46.6388,
    fieldName: "Quadra Principal",
    fieldType: "FUTSAL",
  },
  {
    id: `${SEED_ID}_loc_bola_na_rede`,
    fieldId: `${SEED_ID}_field_bola_1`,
    name: "Bola na Rede Mock",
    address: "Rua do Apito, 77 - Osasco, SP",
    city: "Osasco",
    lat: -23.5329,
    lng: -46.7918,
    fieldName: "Campo Coberto",
    fieldType: "SOCIETY",
  },
];

const GROUPS = [
  {
    id: `${SEED_ID}_group_parcas`,
    name: "Parcas Demo 6M",
    description: "Grupo mock com historico rico de 6 meses.",
  },
  {
    id: `${SEED_ID}_group_veteranos`,
    name: "Veteranos Demo 6M",
    description: "Grupo mock alternativo com jogos e rankings.",
  },
];

const FAVORITE_TEAMS = [
  "Corinthians", "Palmeiras", "Sao Paulo", "Santos", "Flamengo",
  "Vasco", "Gremio", "Internacional", "Cruzeiro", "Atletico-MG",
];

function hashNumber(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function pick(list, index) {
  return list[index % list.length];
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function atLocalTime(date, hour, minute) {
  const copy = new Date(date);
  copy.setHours(hour, minute, 0, 0);
  return copy;
}

function levelForXp(xp) {
  if (xp >= 9000) return 18;
  if (xp >= 6500) return 15;
  if (xp >= 4500) return 12;
  if (xp >= 3000) return 9;
  if (xp >= 1800) return 6;
  if (xp >= 800) return 4;
  if (xp >= 250) return 2;
  return 1;
}

function divisionForPoints(points) {
  if (points >= 2000) return "CHAMPION";
  if (points >= 1000) return "DIAMOND";
  if (points >= 600) return "PLATINUM";
  if (points >= 300) return "GOLD";
  if (points >= 100) return "SILVER";
  return "BRONZE";
}

function leagueRatingForPoints(points) {
  return Math.max(0, Math.min(100, Math.round((points / 22) * 10) / 10));
}

function createEmptyStats() {
  return {
    totalGames: 0,
    totalGoals: 0,
    totalAssists: 0,
    totalSaves: 0,
    totalYellowCards: 0,
    totalRedCards: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0,
    bestPlayerCount: 0,
    worstPlayerCount: 0,
    experiencePoints: 0,
    currentStreak: 0,
    goalsConceded: 0,
    byGender: {
      MALE: createEmptyGenderStats(),
      FEMALE: createEmptyGenderStats(),
      MIXED: createEmptyGenderStats(),
    },
  };
}

function createEmptyGenderStats() {
  return {
    points: 0,
    gamesPlayed: 0,
    wins: 0,
    goalsScored: 0,
    assists: 0,
    mvpCount: 0,
  };
}

function createEmptyGroupStats() {
  return {
    points: 0,
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsScored: 0,
    goalsConceded: 0,
    mvpCount: 0,
  };
}

function calculateLeaguePoints(stats) {
  return stats.gamesWon * 30 +
    stats.gamesDraw * 12 +
    stats.totalGoals * 4 +
    stats.totalAssists * 3 +
    stats.bestPlayerCount * 25 +
    stats.totalGames * 5;
}

function calculateGroupPoints(stats) {
  return stats.wins * 3 + stats.draws;
}

async function getActiveSeasonIds(db) {
  const ids = new Set([MOCK_ACTIVE_SEASON_ID]);
  const [camelSnap, snakeSnap] = await Promise.all([
    db.collection("seasons").where("isActive", "==", true).limit(10).get(),
    db.collection("seasons").where("is_active", "==", true).limit(10).get(),
  ]);
  camelSnap.docs.forEach((doc) => ids.add(doc.id));
  snakeSnap.docs.forEach((doc) => ids.add(doc.id));
  return [...ids];
}

function buildPlayers(now) {
  return Array.from({length: PLAYER_COUNT}, (_, i) => {
    const n = i + 1;
    const name = `${FIRST_NAMES[i]} ${pick(LAST_NAMES, i)}`;
    const id = `${SEED_ID}_player_${pad2(n)}`;
    return {
      id,
      name,
      email: `mock6m.player${pad2(n)}@futeba.demo`,
      photo_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
      favorite_team: pick(FAVORITE_TEAMS, i),
      role: "PLAYER",
      is_searchable: true,
      is_mock: true,
      seed_id: SEED_ID,
      created_at: admin.firestore.Timestamp.fromDate(addDays(now, -190 + i)),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
  });
}

function selectPlayers(players, gameIndex, count) {
  const selected = [];
  for (let offset = 0; selected.length < count; offset++) {
    const player = players[(gameIndex * 7 + offset * 3) % players.length];
    if (!selected.some((p) => p.id === player.id)) selected.push(player);
  }
  return selected;
}

function splitTeams(players, gameIndex) {
  const team1 = [];
  const team2 = [];
  players.forEach((player, index) => {
    if ((index + gameIndex) % 2 === 0) team1.push(player);
    else team2.push(player);
  });
  return [team1, team2];
}

function createGameSeed(players, now, index, upcoming = false) {
  const location = pick(LOCATIONS, index);
  const group = pick(GROUPS, index);
  const dateBase = upcoming ?
    addDays(now, 3 + index * 7) :
    addDays(now, -FINISHED_GAMES + index);
  const hour = [19, 20, 21][index % 3];
  const minute = index % 2 === 0 ? 0 : 30;
  const dateTime = atLocalTime(dateBase, hour, minute);
  const playerCount = upcoming ?
    12 + (index % 9) :
    14 + (index % 11);
  const confirmed = selectPlayers(players, index, Math.min(playerCount, players.length));
  const [team1, team2] = splitTeams(confirmed, index);
  const team1Score = upcoming ? 0 : (index * 3 + 2) % 8;
  const team2Score = upcoming ? 0 : (index * 5 + 1) % 8;
  const status = upcoming ?
    (index % 3 === 0 ? "SCHEDULED" : "CONFIRMED") :
    "FINISHED";
  const gameId = `${SEED_ID}_${upcoming ? "future" : "game"}_${pad2(index + 1)}`;

  return {
    id: gameId,
    index,
    upcoming,
    group,
    location,
    confirmed,
    team1,
    team2,
    team1Score,
    team2Score,
    data: {
      name: "Pelada dos Parcas Mock",
      is_mock: true,
      seed_id: SEED_ID,
      owner_id: players[0].id,
      owner_name: players[0].name,
      status,
      date: formatDate(dateTime),
      time: `${pad2(hour)}:${pad2(minute)}`,
      end_time: `${pad2(hour + 1)}:${pad2(minute)}`,
      dateTime: admin.firestore.Timestamp.fromDate(dateTime),
      field_type: location.fieldType,
      game_type: location.fieldType,
      gender: index % 6 === 0 ? "FEMALE" : index % 5 === 0 ? "MALE" : "MIXED",
      max_players: 24,
      max_goalkeepers: 2,
      min_players: 6,
      number_of_teams: 2,
      players_count: confirmed.length,
      goalkeepers_count: Math.min(2, confirmed.length),
      players: confirmed.map((p) => p.id),
      team1_name: "Azul",
      team2_name: "Laranja",
      team1_score: team1Score,
      team2_score: team2Score,
      daily_price: 25 + (index % 5) * 5,
      total_cost: 280 + (index % 4) * 40,
      pix_payment_enabled: true,
      pix_key: "mock@futeba.demo",
      pix_key_type: "EMAIL",
      pix_beneficiary_name: "Futeba Demo",
      is_public: true,
      visibility: index % 4 === 0 ? "PUBLIC_OPEN" : "PUBLIC_CLOSED",
      group_id: group.id,
      group_name: group.name,
      location_id: location.id,
      location_name: location.name,
      location_address: location.address,
      location_lat: location.lat,
      location_lng: location.lng,
      field_id: location.fieldId,
      field_name: location.fieldName,
      recurrence: "none",
      rules: "Dados mockados para validar telas, rankings e historico.",
      confirmation_deadline_hours: 0,
      require_checkin: false,
      checkin_radius_meters: 100,
      xp_processed: !upcoming,
      xp_processed_at: upcoming ? null : admin.firestore.Timestamp.fromDate(addDays(dateTime, 1)),
      finished_at: upcoming ? null : admin.firestore.Timestamp.fromDate(addDays(dateTime, 1)),
      finishedAt: upcoming ? null : admin.firestore.Timestamp.fromDate(addDays(dateTime, 1)),
      finished_by: upcoming ? null : "mock-seed",
      voting_concluded: !upcoming,
      post_game_report_generated: !upcoming,
      auto_closed: false,
      co_organizers: [players[1].id, players[2].id],
      created_at: admin.firestore.Timestamp.fromDate(addDays(dateTime, -10)),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
}

function confirmationStats(game, player, index, teamId) {
  if (game.upcoming) {
    return {goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0};
  }
  const h = hashNumber(`${game.id}_${player.id}_${index}`);
  return {
    goals: h % 4,
    assists: Math.floor(h / 7) % 3,
    saves: index < 2 ? (Math.floor(h / 11) % 7) : 0,
    yellowCards: h % 13 === 0 ? 1 : 0,
    redCards: h % 97 === 0 ? 1 : 0,
    teamId,
  };
}

function calculateXp(stats, won, draw, isMvp) {
  return 20 +
    stats.goals * 8 +
    stats.assists * 5 +
    stats.saves * 3 +
    (won ? 12 : draw ? 6 : 0) +
    (isMvp ? 20 : 0);
}

class BatchWriter {
  constructor(db, dryRun) {
    this.db = db;
    this.dryRun = dryRun;
    this.batch = db.batch();
    this.ops = 0;
    this.total = 0;
  }

  set(ref, data, options = {merge: true}) {
    this.total++;
    if (this.dryRun) return;
    this.batch.set(ref, data, options);
    this.ops++;
  }

  async flushIfNeeded(force = false) {
    if (this.dryRun || this.ops === 0) return;
    if (!force && this.ops < BATCH_LIMIT) return;
    await this.batch.commit();
    this.batch = this.db.batch();
    this.ops = 0;
  }
}

async function seed() {
  if (admin.apps.length === 0) {
    admin.initializeApp({projectId: PROJECT_ID});
  }
  const db = admin.firestore();
  const now = new Date();
  const players = buildPlayers(now);
  const games = [
    ...Array.from({length: FINISHED_GAMES}, (_, i) => createGameSeed(players, now, i, false)),
    ...Array.from({length: UPCOMING_GAMES}, (_, i) => createGameSeed(players, now, i, true)),
  ];

  const writer = new BatchWriter(db, !APPLY);
  const activeSeasonIds = await getActiveSeasonIds(db);
  const userStats = new Map();
  const groupStats = new Map();
  const groupMatches = new Map();
  const touchedCollections = new Map();

  const touch = (collection) => {
    touchedCollections.set(collection, (touchedCollections.get(collection) || 0) + 1);
  };

  const setDoc = async (collection, id, data) => {
    writer.set(db.collection(collection).doc(id), data, {merge: true});
    touch(collection);
    await writer.flushIfNeeded();
  };

  for (const player of players) {
    userStats.set(player.id, createEmptyStats());
    await setDoc("users", player.id, player);
  }

  for (const group of GROUPS) {
    const playerMap = new Map();
    for (const player of players) {
      playerMap.set(player.id, createEmptyGroupStats());
    }
    groupStats.set(group.id, playerMap);
    groupMatches.set(group.id, []);
  }

  for (const seasonId of activeSeasonIds) {
    await setDoc("seasons", seasonId, {
      name: seasonId === MOCK_ACTIVE_SEASON_ID ?
        "Temporada Mock 6M" :
        `Temporada ativa (${seasonId})`,
      start_date: formatDate(addDays(now, -182)),
      end_date: formatDate(addDays(now, 30)),
      isActive: true,
      is_active: true,
      status: "ACTIVE",
      is_mock: seasonId === MOCK_ACTIVE_SEASON_ID,
      seed_id: SEED_ID,
      created_at: admin.firestore.Timestamp.fromDate(addDays(now, -182)),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  for (const location of LOCATIONS) {
    await setDoc("locations", location.id, {
      name: location.name,
      address: location.address,
      city: location.city,
      lat: location.lat,
      lng: location.lng,
      owner_id: players[0].id,
      owner_name: players[0].name,
      field_count: 1,
      rating: 4.4 + (hashNumber(location.id) % 5) / 10,
      rating_count: 20 + (hashNumber(location.name) % 40),
      is_mock: true,
      seed_id: SEED_ID,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    writer.set(
      db.collection("locations").doc(location.id).collection("fields").doc(location.fieldId),
      {
        name: location.fieldName,
        type: location.fieldType,
        active: true,
        price: 280,
        surface: location.fieldType === "FUTSAL" ? "COURT" : "SYNTHETIC_GRASS",
        covered: location.id.includes("bola"),
        is_mock: true,
        seed_id: SEED_ID,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
    touch("locations/{id}/fields");
    await writer.flushIfNeeded();
  }

  for (const group of GROUPS) {
    await setDoc("groups", group.id, {
      name: group.name,
      description: group.description,
      is_public: true,
      type: "FRIENDS",
      owner_id: players[0].id,
      owner_name: players[0].name,
      admin_ids: [players[0].id, players[1].id],
      member_count: players.length,
      next_game_date: admin.firestore.Timestamp.fromDate(games.find((g) => g.upcoming).data.dateTime.toDate()),
      status: "ACTIVE",
      is_mock: true,
      seed_id: SEED_ID,
      created_at: admin.firestore.Timestamp.fromDate(addDays(now, -190)),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    for (const player of players) {
      const role = player.id === players[0].id ? "OWNER" : player.id === players[1].id ? "ADMIN" : "MEMBER";
      writer.set(db.collection("groups").doc(group.id).collection("members").doc(player.id), {
        user_id: player.id,
        user_name: player.name,
        user_photo: player.photo_url,
        role,
        status: "ACTIVE",
        joined_at: admin.firestore.Timestamp.fromDate(addDays(now, -180 + (hashNumber(player.id) % 30))),
        is_mock: true,
        seed_id: SEED_ID,
      }, {merge: true});
      touch("groups/{id}/members");
      writer.set(db.collection("users").doc(player.id).collection("groups").doc(group.id), {
        group_id: group.id,
        group_name: group.name,
        role,
        member_count: players.length,
        joined_at: admin.firestore.Timestamp.fromDate(addDays(now, -180 + (hashNumber(player.id) % 30))),
        is_mock: true,
        seed_id: SEED_ID,
      }, {merge: true});
      touch("users/{id}/groups");
      await writer.flushIfNeeded();
    }
  }

  for (const game of games) {
    await setDoc("games", game.id, game.data);

    const team1Id = `${game.id}_team_azul`;
    const team2Id = `${game.id}_team_laranja`;
    await setDoc("teams", team1Id, {
      game_id: game.id,
      name: "Azul",
      color: "#1976d2",
      player_ids: game.team1.map((p) => p.id),
      score: game.team1Score,
      is_mock: true,
      seed_id: SEED_ID,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await setDoc("teams", team2Id, {
      game_id: game.id,
      name: "Laranja",
      color: "#f57c00",
      player_ids: game.team2.map((p) => p.id),
      score: game.team2Score,
      is_mock: true,
      seed_id: SEED_ID,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const winner = game.team1Score === game.team2Score ? "DRAW" :
      game.team1Score > game.team2Score ? team1Id : team2Id;
    const mvp = game.upcoming ? null : game.confirmed[(game.index * 5) % game.confirmed.length];

    if (!game.upcoming) {
      await setDoc("live_scores", game.id, {
        game_id: game.id,
        team1_score: game.team1Score,
        team2_score: game.team2Score,
        status: "FINISHED",
        finished_at: admin.firestore.Timestamp.fromDate(addDays(game.data.dateTime.toDate(), 1)),
        finishedAt: admin.firestore.Timestamp.fromDate(addDays(game.data.dateTime.toDate(), 1)),
        is_mock: true,
        seed_id: SEED_ID,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    for (let i = 0; i < game.confirmed.length; i++) {
      const player = game.confirmed[i];
      const teamId = game.team1.some((p) => p.id === player.id) ? team1Id : team2Id;
      const stats = confirmationStats(game, player, i, teamId);
      const isGoalkeeper = i < 2;
      const isMvp = mvp?.id === player.id;
      const won = winner !== "DRAW" && winner === teamId;
      const draw = winner === "DRAW";
      const myScore = teamId === team1Id ? game.team1Score : game.team2Score;
      const opponentScore = teamId === team1Id ? game.team2Score : game.team1Score;
      const xp = game.upcoming ? 0 : calculateXp(stats, won, draw, isMvp);
      const confirmationId = `${game.id}_${player.id}`;

      await setDoc("confirmations", confirmationId, {
        id: confirmationId,
        game_id: game.id,
        user_id: player.id,
        user_name: player.name,
        user_photo: player.photo_url,
        position: isGoalkeeper ? "GOALKEEPER" : "FIELD",
        status: "CONFIRMED",
        confirmation_order: i + 1,
        team_id: teamId,
        goals: stats.goals,
        assists: stats.assists,
        saves: stats.saves,
        yellow_cards: stats.yellowCards,
        red_cards: stats.redCards,
        was_present: !game.upcoming,
        is_mvp: isMvp,
        game_date: game.data.date,
        location_id: game.location.id,
        is_mock: true,
        seed_id: SEED_ID,
        created_at: admin.firestore.Timestamp.fromDate(addDays(game.data.dateTime.toDate(), -2)),
        confirmed_at: admin.firestore.Timestamp.fromDate(addDays(game.data.dateTime.toDate(), -1)),
      });

      if (!game.upcoming) {
        const agg = userStats.get(player.id);
        const gender = game.data.gender || "MIXED";
        const genderAgg = agg.byGender[gender] || agg.byGender.MIXED;
        const groupAgg = groupStats.get(game.group.id).get(player.id);
        agg.totalGames += 1;
        agg.totalGoals += stats.goals;
        agg.totalAssists += stats.assists;
        agg.totalSaves += stats.saves;
        agg.totalYellowCards += stats.yellowCards;
        agg.totalRedCards += stats.redCards;
        agg.gamesWon += won ? 1 : 0;
        agg.gamesLost += !won && !draw ? 1 : 0;
        agg.gamesDraw += draw ? 1 : 0;
        agg.bestPlayerCount += isMvp ? 1 : 0;
        agg.experiencePoints += xp;
        agg.currentStreak += 1;
        agg.goalsConceded += opponentScore;

        genderAgg.gamesPlayed += 1;
        genderAgg.wins += won ? 1 : 0;
        genderAgg.goalsScored += stats.goals;
        genderAgg.assists += stats.assists;
        genderAgg.mvpCount += isMvp ? 1 : 0;
        genderAgg.points += xp;

        groupAgg.gamesPlayed += 1;
        groupAgg.wins += won ? 1 : 0;
        groupAgg.draws += draw ? 1 : 0;
        groupAgg.losses += !won && !draw ? 1 : 0;
        groupAgg.goalsScored += stats.goals;
        groupAgg.goalsConceded += opponentScore;
        groupAgg.mvpCount += isMvp ? 1 : 0;
        groupAgg.points += won ? 3 : draw ? 1 : 0;

        await setDoc("xp_logs", `game_${game.id}_user_${player.id}`, {
          user_id: player.id,
          game_id: game.id,
          action: "GAME_FINISHED",
          xp_earned: xp,
          game_status: "FINISHED",
          game_result: won ? "WIN" : draw ? "DRAW" : "LOSS",
          my_team_score: myScore,
          opponent_score: opponentScore,
          was_mvp: isMvp,
          description: `XP mock - ${game.data.date}`,
          is_mock: true,
          seed_id: SEED_ID,
          created_at: admin.firestore.Timestamp.fromDate(addDays(game.data.dateTime.toDate(), 1)),
        });
      }
    }

    if (!game.upcoming) {
      const playerResults = game.confirmed.map((player, i) => {
        const teamId = game.team1.some((p) => p.id === player.id) ? team1Id : team2Id;
        const stats = confirmationStats(game, player, i, teamId);
        const won = winner !== "DRAW" && winner === teamId;
        return {
          user_id: player.id,
          userId: player.id,
          user_name: player.name,
          userName: player.name,
          team_id: teamId,
          teamId,
          goals: stats.goals,
          assists: stats.assists,
          is_mvp: mvp?.id === player.id,
          isMvp: mvp?.id === player.id,
          result: winner === "DRAW" ? "DRAW" : won ? "WIN" : "LOSS",
        };
      });
      groupMatches.get(game.group.id).push({
        id: game.id,
        game_id: game.id,
        gameId: game.id,
        season_id: GROUP_LEAGUE_SEASON_ID,
        seasonId: GROUP_LEAGUE_SEASON_ID,
        team1_name: "Azul",
        team1Name: "Azul",
        team2_name: "Laranja",
        team2Name: "Laranja",
        team1_score: game.team1Score,
        team1Score: game.team1Score,
        team2_score: game.team2Score,
        team2Score: game.team2Score,
        date: game.data.date,
        player_results: playerResults,
        playerResults,
        is_mock: true,
        seed_id: SEED_ID,
        created_at: game.data.dateTime,
      });
    }

    if (!game.upcoming) {
      for (let e = 0; e < Math.min(7, game.team1Score + game.team2Score); e++) {
        const scoringTeam = e % 2 === 0 ? game.team1 : game.team2;
        const scorer = scoringTeam[e % scoringTeam.length];
        await setDoc("game_events", `${game.id}_event_${pad2(e + 1)}`, {
          game_id: game.id,
          user_id: scorer.id,
          user_name: scorer.name,
          type: "GOAL",
          minute: 8 + e * 9,
          team_id: game.team1.some((p) => p.id === scorer.id) ? team1Id : team2Id,
          is_mock: true,
          seed_id: SEED_ID,
          created_at: admin.firestore.Timestamp.fromDate(game.data.dateTime.toDate()),
        });
      }
    }
  }

  for (const player of players) {
    const stats = userStats.get(player.id);
    const level = levelForXp(stats.experiencePoints);
    const leaguePoints = calculateLeaguePoints(stats);
    const division = divisionForPoints(leaguePoints);
    const leagueRating = leagueRatingForPoints(leaguePoints);
    const byGender = Object.fromEntries(
      Object.entries(stats.byGender).map(([gender, genderStats]) => [
        gender,
        {
          points: genderStats.points,
          games_played: genderStats.gamesPlayed,
          wins: genderStats.wins,
          goals_scored: genderStats.goalsScored,
          assists: genderStats.assists,
          mvp_count: genderStats.mvpCount,
        },
      ])
    );
    await setDoc("statistics", player.id, {
      userId: player.id,
      user_id: player.id,
      totalGames: stats.totalGames,
      totalGoals: stats.totalGoals,
      totalAssists: stats.totalAssists,
      totalSaves: stats.totalSaves,
      totalYellowCards: stats.totalYellowCards,
      totalRedCards: stats.totalRedCards,
      gamesWon: stats.gamesWon,
      gamesLost: stats.gamesLost,
      gamesDraw: stats.gamesDraw,
      bestPlayerCount: stats.bestPlayerCount,
      worstPlayerCount: stats.worstPlayerCount,
      currentMvpStreak: Math.min(stats.bestPlayerCount, 4),
      bestMvpStreak: Math.min(stats.bestPlayerCount + 1, 6),
      is_mock: true,
      seed_id: SEED_ID,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    writer.set(db.collection("users").doc(player.id), {
      experience_points: stats.experiencePoints,
      level,
      league_rating: leagueRating,
      division,
      current_streak: Math.min(stats.currentStreak, 18),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    touch("users");
    await writer.flushIfNeeded();

    for (const seasonId of activeSeasonIds) {
      await setDoc("season_participation", `${seasonId}_${player.id}`, {
        user_id: player.id,
        userId: player.id,
        season_id: seasonId,
        seasonId,
        level,
        points: leaguePoints,
        games_played: stats.totalGames,
        gamesPlayed: stats.totalGames,
        wins: stats.gamesWon,
        draws: stats.gamesDraw,
        losses: stats.gamesLost,
        goals: stats.totalGoals,
        assists: stats.totalAssists,
        saves: stats.totalSaves,
        mvp_count: stats.bestPlayerCount,
        mvpCount: stats.bestPlayerCount,
        division,
        league_rating: leagueRating,
        promotion_progress: leagueRating >= 70 ? 2 : leagueRating >= 50 ? 1 : 0,
        relegation_progress: 0,
        protection_games: Math.max(0, 3 - (hashNumber(player.id) % 4)),
        by_gender: byGender,
        is_mock: true,
        seed_id: SEED_ID,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await setDoc("ranking_deltas", `${seasonId}_${player.id}_${SEED_ID}`, {
        user_id: player.id,
        season_id: seasonId,
        period: "season",
        period_key: seasonId,
        games_added: stats.totalGames,
        xp_added: stats.experiencePoints,
        points_added: leaguePoints,
        wins_added: stats.gamesWon,
        goals_added: stats.totalGoals,
        assists_added: stats.totalAssists,
        is_mock: true,
        seed_id: SEED_ID,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      for (const group of GROUPS) {
        const groupPlayerStats = groupStats.get(group.id).get(player.id);
        const groupPoints = groupPlayerStats.points * 30 +
          groupPlayerStats.goalsScored * 4 +
          groupPlayerStats.mvpCount * 25 +
          groupPlayerStats.gamesPlayed * 5;
        await setDoc("season_participation", `${seasonId}_${group.id}_${player.id}`, {
          user_id: player.id,
          userId: player.id,
          season_id: seasonId,
          seasonId,
          group_id: group.id,
          groupId: group.id,
          level,
          points: groupPoints,
          games_played: groupPlayerStats.gamesPlayed,
          gamesPlayed: groupPlayerStats.gamesPlayed,
          wins: groupPlayerStats.wins,
          draws: groupPlayerStats.draws,
          losses: groupPlayerStats.losses,
          goals: groupPlayerStats.goalsScored,
          assists: Math.round(groupPlayerStats.goalsScored / 3),
          mvp_count: groupPlayerStats.mvpCount,
          mvpCount: groupPlayerStats.mvpCount,
          division: divisionForPoints(groupPoints),
          league_rating: leagueRatingForPoints(groupPoints),
          by_gender: byGender,
          is_mock: true,
          seed_id: SEED_ID,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  for (const group of GROUPS) {
    await setDoc(`groups/${group.id}/league_seasons`, GROUP_LEAGUE_SEASON_ID, {
      group_id: group.id,
      groupId: group.id,
      name: "Liga Mock 6M",
      is_active: true,
      isActive: true,
      start_date: formatDate(addDays(now, -182)),
      end_date: formatDate(addDays(now, 30)),
      is_mock: true,
      seed_id: SEED_ID,
      created_at: admin.firestore.Timestamp.fromDate(addDays(now, -182)),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const standings = [...groupStats.get(group.id).entries()]
      .map(([userId, stats]) => {
        const player = players.find((p) => p.id === userId);
        return {
          userId,
          player,
          stats,
          points: calculateGroupPoints(stats),
        };
      })
      .sort((a, b) =>
        b.points - a.points ||
        (b.stats.goalsScored - b.stats.goalsConceded) -
          (a.stats.goalsScored - a.stats.goalsConceded) ||
        b.stats.goalsScored - a.stats.goalsScored
      );

    for (const standing of standings) {
      const {stats} = standing;
      await setDoc(`groups/${group.id}/league_standings`, `${GROUP_LEAGUE_SEASON_ID}_${standing.userId}`, {
        user_id: standing.userId,
        userId: standing.userId,
        season_id: GROUP_LEAGUE_SEASON_ID,
        seasonId: GROUP_LEAGUE_SEASON_ID,
        points: standing.points,
        games_played: stats.gamesPlayed,
        gamesPlayed: stats.gamesPlayed,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        goals_scored: stats.goalsScored,
        goalsScored: stats.goalsScored,
        goals_conceded: stats.goalsConceded,
        goalsConceded: stats.goalsConceded,
        goal_difference: stats.goalsScored - stats.goalsConceded,
        goalDifference: stats.goalsScored - stats.goalsConceded,
        mvp_count: stats.mvpCount,
        mvpCount: stats.mvpCount,
        level: levelForXp(userStats.get(standing.userId).experiencePoints),
        is_mock: true,
        seed_id: SEED_ID,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    for (const match of groupMatches.get(group.id)) {
      await setDoc(`groups/${group.id}/league_matches`, match.id, match);
    }
  }

  await setDoc("seed_runs", SEED_ID, {
    seed_id: SEED_ID,
    project_id: PROJECT_ID,
    player_count: PLAYER_COUNT,
    finished_games: FINISHED_GAMES,
    upcoming_games: UPCOMING_GAMES,
    active_season_ids: activeSeasonIds,
    group_league_season_id: GROUP_LEAGUE_SEASON_ID,
    collections: Object.fromEntries(touchedCollections.entries()),
    applied: APPLY,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writer.flushIfNeeded(true);

  console.log(`[seed-demo-6m] mode=${APPLY ? "apply" : "dry-run"} project=${PROJECT_ID}`);
  console.log(`[seed-demo-6m] seed_id=${SEED_ID}`);
  console.log(`[seed-demo-6m] players=${players.length} games=${games.length} finished=${FINISHED_GAMES} upcoming=${UPCOMING_GAMES}`);
  console.log("[seed-demo-6m] writes by collection:");
  for (const [collection, count] of [...touchedCollections.entries()].sort()) {
    console.log(`  - ${collection}: ${count}`);
  }
  console.log(`[seed-demo-6m] total planned writes=${writer.total}`);
}

seed().catch((err) => {
  console.error("[seed-demo-6m] fatal:", err);
  process.exit(1);
});
