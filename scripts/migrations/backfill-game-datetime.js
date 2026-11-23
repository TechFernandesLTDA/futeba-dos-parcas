#!/usr/bin/env node
"use strict";

/**
 * Grava `dateTime` (Timestamp) nos jogos que só têm `date` e `time` em texto.
 *
 * Os jogos criados pelo web até a spec bugfix-2026-11-23-jogo-do-web-sem-datetime
 * não tinham `dateTime`. Sem ele, o jogo some das listas ordenadas por data, dos
 * lembretes e do fechamento automático. O instante é montado no fuso da quadra
 * (`locations/{id}.time_zone`) e, sem quadra ou fuso válido, em America/Sao_Paulo.
 *
 * Seguro por padrão (só leitura):
 *   node scripts/migrations/backfill-game-datetime.js
 *
 * Aplicação explícita:
 *   node scripts/migrations/backfill-game-datetime.js --apply --project=futebadosparcas
 *
 * Só escreve o campo `dateTime`, e só em jogo que ainda não tem `dateTime` nem
 * `date_time`. Jogo com data em formato inesperado é contado e deixado como está.
 *
 * A conta do instante é a mesma do trigger functions/src/games/game-datetime.ts,
 * que cuida dos jogos novos; mudou lá, mude aqui.
 */

const DEFAULT_PROJECT_ID = "futebadosparcas";
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
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

function isTimestampLike(value) {
  return Boolean(value) && typeof value.toDate === "function";
}

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", {timeZone});
    return true;
  } catch {
    return false;
  }
}

/** Diferença, em ms, entre a hora de parede no fuso e o UTC no instante dado. */
function offsetMs(instantMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const wall = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour"), get("minute"), get("second"),
  );
  return wall - instantMs;
}

/**
 * Instante (Date) da hora de parede `date` "AAAA-MM-DD" + `time` "HH:MM" no fuso.
 * Devolve null quando a data ou a hora não estão nesse formato.
 */
function zonedDateTime(date, time, timeZone) {
  if (typeof date !== "string") return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!d) return null;
  const year = Number(d[1]);
  const month = Number(d[2]);
  const day = Number(d[3]);

  let hour = 0;
  let minute = 0;
  if (typeof time === "string" && time.trim()) {
    const t = /^(\d{1,2}):(\d{2})/.exec(time.trim());
    if (!t) return null;
    hour = Number(t[1]);
    minute = Number(t[2]);
    if (hour > 23 || minute > 59) return null;
  }

  const wallUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallUtc);
  if (check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day) {
    return null;
  }
  // Duas passadas cobrem a troca de horário de verão perto do instante.
  let instant = wallUtc - offsetMs(wallUtc, timeZone);
  instant = wallUtc - offsetMs(instant, timeZone);
  return new Date(instant);
}

async function loadTimeZones(db, locationIds) {
  const zones = new Map();
  const ids = [...new Set(locationIds.filter((id) => typeof id === "string" && id && !id.includes("/")))];
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => db.collection("locations").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      const tz = snap.exists ? snap.get("time_zone") : null;
      if (isValidTimeZone(tz)) zones.set(snap.id, tz);
    }
  }
  return zones;
}

async function scanGames(db) {
  const snap = await db.collection("games")
    .select("dateTime", "date_time", "date", "time", "location_id")
    .get();
  const missing = snap.docs.filter((doc) =>
    !isTimestampLike(doc.get("dateTime")) && !isTimestampLike(doc.get("date_time"))
  );
  const zones = await loadTimeZones(db, missing.map((doc) => doc.get("location_id")));

  const fixes = [];
  const invalid = [];
  for (const doc of missing) {
    const timeZone = zones.get(doc.get("location_id")) || DEFAULT_TIME_ZONE;
    const dateTime = zonedDateTime(doc.get("date"), doc.get("time"), timeZone);
    if (dateTime) fixes.push({ref: doc.ref, dateTime, timeZone});
    else invalid.push(doc.id);
  }
  return {scanned: snap.size, missing: missing.length, fixes, invalid};
}

async function runBackfill({db, apply, log = console.log, Timestamp}) {
  const scan = await scanGames(db);
  const porFuso = scan.fixes.reduce((acc, fix) => {
    acc[fix.timeZone] = (acc[fix.timeZone] || 0) + 1;
    return acc;
  }, {});
  log(`SCAN ${JSON.stringify({
    scanned: scan.scanned,
    semDateTime: scan.missing,
    corrigiveis: scan.fixes.length,
    dataInvalida: scan.invalid.length,
    porFuso,
  })}`);
  if (scan.invalid.length) log(`DATA INVÁLIDA (ficam como estão): ${scan.invalid.join(", ")}`);

  if (!apply) {
    log("DRY-RUN: nenhuma escrita foi executada. Use --apply para confirmar.");
    return {scan, written: 0};
  }

  let written = 0;
  for (let i = 0; i < scan.fixes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const fix of scan.fixes.slice(i, i + BATCH_SIZE)) {
      batch.update(fix.ref, {dateTime: Timestamp.fromDate(fix.dateTime)});
    }
    await batch.commit();
    written += Math.min(BATCH_SIZE, scan.fixes.length - i);
  }
  log(`APLICAÇÃO ${JSON.stringify({gravados: written})}`);
  const after = await scanGames(db);
  log(`DEPOIS ${JSON.stringify({semDateTime: after.missing, corrigiveis: after.fixes.length})}`);
  return {scan, after, written};
}

function printHelp() {
  console.log(`Uso:
  node scripts/migrations/backfill-game-datetime.js
  node scripts/migrations/backfill-game-datetime.js --apply [--project=ID]

Sem --apply, executa somente leitura. A escrita grava apenas dateTime.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
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
    Timestamp: admin.firestore.Timestamp,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backfill falhou:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  isValidTimeZone,
  parseArgs,
  runBackfill,
  zonedDateTime,
};
