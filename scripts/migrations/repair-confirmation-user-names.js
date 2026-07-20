#!/usr/bin/env node
"use strict";

/**
 * Repara somente `user_name` de confirmations com placeholder "Membro".
 *
 * Seguro por padrão:
 *   node scripts/migrations/repair-confirmation-user-names.js --game-id=GAME_ID
 *
 * Aplicação explícita:
 *   node scripts/migrations/repair-confirmation-user-names.js \
 *     --game-id=GAME_ID --apply --project=futebadosparcas
 */

const DEFAULT_PROJECT_ID = "futebadosparcas";
const GENERIC_MEMBER_NAME = "membro";

function parseArgs(argv) {
  const args = new Set(argv);
  const valueOf = (name, fallback) => {
    const prefix = `${name}=`;
    const raw = argv.find((arg) => arg.startsWith(prefix));
    return raw ? raw.slice(prefix.length) : fallback;
  };

  if (args.has("--help") || args.has("-h")) return {help: true};

  const gameId = valueOf("--game-id", "").trim();
  if (!gameId || gameId.includes("/")) {
    throw new Error("--game-id é obrigatório e não pode conter '/'");
  }

  return {
    help: false,
    apply: args.has("--apply"),
    gameId,
    projectId: valueOf(
      "--project",
      process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID,
    ),
  };
}

function profileName(data) {
  if (!data) return null;
  for (const value of [
    data.display_name,
    data.displayName,
    data.name,
    data.nickname,
  ]) {
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim();
      if (normalized.toLocaleLowerCase("pt-BR") !== GENERIC_MEMBER_NAME) {
        return normalized;
      }
    }
  }
  return null;
}

function hasGenericName(data) {
  return typeof data.user_name === "string" &&
    data.user_name.trim().toLocaleLowerCase("pt-BR") === GENERIC_MEMBER_NAME;
}

async function scanRepairs(db, gameId) {
  const confirmationSnap = await db
    .collection("confirmations")
    .where("game_id", "==", gameId)
    .get();
  const candidates = confirmationSnap.docs.filter((snapshot) =>
    hasGenericName(snapshot.data())
  );
  if (candidates.length === 0) {
    return {scanned: confirmationSnap.size, candidates: [], unresolved: 0};
  }

  const userRefs = candidates.map((snapshot) =>
    db.collection("users").doc(snapshot.data().user_id)
  );
  const userSnapshots = await db.getAll(...userRefs);
  const namesById = new Map();
  userSnapshots.forEach((snapshot) => {
    const resolved = snapshot.exists ? profileName(snapshot.data()) : null;
    if (resolved) namesById.set(snapshot.id, resolved);
  });

  const repairs = candidates.flatMap((snapshot) => {
    const resolved = namesById.get(snapshot.data().user_id);
    return resolved ? [{ref: snapshot.ref, userName: resolved}] : [];
  });
  return {
    scanned: confirmationSnap.size,
    candidates: repairs,
    unresolved: candidates.length - repairs.length,
  };
}

async function applyRepair(db, gameId, repair) {
  return db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(repair.ref);
    if (!fresh.exists) return "deleted";
    const data = fresh.data();
    if (data.game_id !== gameId || !hasGenericName(data)) return "changed";
    transaction.update(repair.ref, {user_name: repair.userName});
    return "updated";
  });
}

async function runRepair({db, gameId, apply, log = console.log}) {
  const scan = await scanRepairs(db, gameId);
  log(`SCAN ${JSON.stringify({
    scanned: scan.scanned,
    repairable: scan.candidates.length,
    unresolved: scan.unresolved,
  })}`);

  if (!apply) {
    log("DRY-RUN: nenhuma escrita foi executada. Use --apply para confirmar.");
    return {scan, outcomes: []};
  }

  const outcomes = [];
  for (const repair of scan.candidates) {
    outcomes.push(await applyRepair(db, gameId, repair));
  }
  const counts = outcomes.reduce((result, outcome) => {
    result[outcome] = (result[outcome] || 0) + 1;
    return result;
  }, {});
  log(`APLICAÇÃO ${JSON.stringify(counts)}`);

  const after = await scanRepairs(db, gameId);
  log(`DEPOIS ${JSON.stringify({
    scanned: after.scanned,
    repairable: after.candidates.length,
    unresolved: after.unresolved,
  })}`);
  return {scan, after, outcomes};
}

function printHelp() {
  console.log(`Uso:
  node scripts/migrations/repair-confirmation-user-names.js --game-id=GAME_ID
  node scripts/migrations/repair-confirmation-user-names.js --game-id=GAME_ID --apply [--project=ID]

Sem --apply, executa somente leitura. A escrita altera apenas user_name.`);
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
  console.log(`Modo: ${options.apply ? "APPLY" : "DRY-RUN"}`);
  await runRepair({db: admin.firestore(), ...options});
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Reparo falhou:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  applyRepair,
  hasGenericName,
  parseArgs,
  profileName,
  runRepair,
  scanRepairs,
};
