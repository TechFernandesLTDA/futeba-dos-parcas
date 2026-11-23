#!/usr/bin/env node
"use strict";

/**
 * Grava o placar final em `teams/{id}.score` dos jogos já finalizados.
 *
 * Até a spec bugfix-2026-11-23-placar-chega-aos-times, o finishGameLifecycle
 * gravava o placar só no jogo e em `live_scores`. O ranking semanal, o
 * confronto direto do web e o card do time no app leem `teams.score` e viam 0.
 *
 * Seguro por padrão (só leitura):
 *   node scripts/migrations/backfill-team-scores.js
 *
 * Aplicação explícita:
 *   node scripts/migrations/backfill-team-scores.js --apply --project=futebadosparcas
 *
 * Fonte do placar, na ordem: mapa `live_scores/{jogo}.scores`, ids legados
 * team1_id/team2_id com o placar do jogo, e, sem nenhum id, dois times na ordem
 * do id do documento (a mesma do início do jogo). A conta é a mesma de
 * finalTeamScores em functions/src/games/lifecycle.ts; mudou lá, mude aqui.
 * Só escreve `score` e `updated_at`, e só quando o valor é diferente.
 */

const DEFAULT_PROJECT_ID = "futebadosparcas";
const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) return {help: true};
  const raw = argv.find((arg) => arg.startsWith("--project="));
  return {
    help: false,
    apply: args.has("--apply"),
    projectId: raw ?
      raw.slice("--project=".length) :
      process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID,
  };
}

function toScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function readScoresMap(liveScore) {
  const map = new Map();
  const raw = liveScore && liveScore.scores;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [teamId, value] of Object.entries(raw)) {
      if (teamId) map.set(teamId, toScore(value));
    }
  }
  return map;
}

/** Placar final por id de time; espelha finalTeamScores (lifecycle.ts). */
function finalTeamScores(teamIds, game, liveScore) {
  const scoresMap = readScoresMap(liveScore);
  const team1Id = liveScore && typeof liveScore.team1_id === "string" ? liveScore.team1_id : "";
  const team2Id = liveScore && typeof liveScore.team2_id === "string" ? liveScore.team2_id : "";
  const team1Score = toScore(game.team1_score);
  const team2Score = toScore(game.team2_score);
  const result = new Map();
  if (!team1Id && !team2Id && scoresMap.size === 0) {
    const sorted = [...teamIds].sort();
    if (sorted.length === 2) {
      result.set(sorted[0], team1Score);
      result.set(sorted[1], team2Score);
    }
    return result;
  }
  for (const teamId of teamIds) {
    if (scoresMap.has(teamId)) result.set(teamId, scoresMap.get(teamId));
    else if (teamId === team1Id) result.set(teamId, team1Score);
    else if (teamId === team2Id) result.set(teamId, team2Score);
  }
  return result;
}

async function scan(db) {
  const games = await db.collection("games")
    .where("status", "==", "FINISHED")
    .select("team1_score", "team2_score")
    .get();
  const fixes = [];
  let semTimes = 0;
  let semPlacarConhecido = 0;
  for (const gameDoc of games.docs) {
    const [teamsSnap, liveSnap] = await Promise.all([
      db.collection("teams").where("game_id", "==", gameDoc.id).get(),
      db.collection("live_scores").doc(gameDoc.id).get(),
    ]);
    if (teamsSnap.empty) {
      semTimes += 1;
      continue;
    }
    const scores = finalTeamScores(
      teamsSnap.docs.map((doc) => doc.id),
      gameDoc.data(),
      liveSnap.exists ? liveSnap.data() : undefined,
    );
    if (scores.size === 0) semPlacarConhecido += 1;
    for (const teamDoc of teamsSnap.docs) {
      if (!scores.has(teamDoc.id)) continue;
      const score = scores.get(teamDoc.id);
      if (teamDoc.get("score") !== score) fixes.push({ref: teamDoc.ref, score});
    }
  }
  return {jogos: games.size, semTimes, semPlacarConhecido, fixes};
}

async function runBackfill({db, apply, log = console.log, serverTimestamp}) {
  const result = await scan(db);
  log(`SCAN ${JSON.stringify({
    jogosFinalizados: result.jogos,
    semTimes: result.semTimes,
    semPlacarConhecido: result.semPlacarConhecido,
    timesACorrigir: result.fixes.length,
  })}`);
  if (!apply) {
    log("DRY-RUN: nenhuma escrita foi executada. Use --apply para confirmar.");
    return {scan: result, written: 0};
  }
  let written = 0;
  for (let i = 0; i < result.fixes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = result.fixes.slice(i, i + BATCH_SIZE);
    for (const fix of slice) {
      batch.update(fix.ref, {score: fix.score, updated_at: serverTimestamp()});
    }
    await batch.commit();
    written += slice.length;
  }
  log(`APLICAÇÃO ${JSON.stringify({gravados: written})}`);
  const after = await scan(db);
  log(`DEPOIS ${JSON.stringify({timesACorrigir: after.fixes.length})}`);
  return {scan: result, after, written};
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Uso: node scripts/migrations/backfill-team-scores.js [--apply] [--project=ID]");
    return;
  }
  const admin = require("firebase-admin");
  if (admin.apps.length === 0) admin.initializeApp({projectId: options.projectId});
  console.log(`Projeto: ${options.projectId}`);
  console.log(`Emulador: ${process.env.FIRESTORE_EMULATOR_HOST || "não (banco real)"}`);
  console.log(`Modo: ${options.apply ? "APPLY" : "DRY-RUN"}`);
  await runBackfill({
    db: admin.firestore(),
    apply: options.apply,
    serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backfill falhou:", error);
    process.exitCode = 1;
  });
}

module.exports = {finalTeamScores, parseArgs, runBackfill};
