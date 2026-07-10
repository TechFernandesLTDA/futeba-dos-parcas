#!/usr/bin/env node
"use strict";

/**
 * Backfill idempotente de `groups/{groupId}/members/{userId}.status`.
 *
 * Seguro por padrão (somente leitura):
 *   node scripts/migrations/backfill-group-member-status.js
 *
 * Aplicação explícita:
 *   node scripts/migrations/backfill-group-member-status.js --apply --project=futebadosparcas
 *
 * Cada escrita usa transação e relê o documento. Se `status` tiver sido criado
 * após o scan, ele é preservado; nenhum valor existente é sobrescrito.
 */

const DEFAULT_PROJECT_ID = "futebadosparcas";
const DEFAULT_CONCURRENCY = 8;

function parseArgs(argv) {
  const args = new Set(argv);
  const valueOf = (name, fallback) => {
    const prefix = `${name}=`;
    const raw = argv.find((arg) => arg.startsWith(prefix));
    return raw ? raw.slice(prefix.length) : fallback;
  };

  if (args.has("--help") || args.has("-h")) return {help: true};

  const concurrency = Number(valueOf("--concurrency", String(DEFAULT_CONCURRENCY)));
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) {
    throw new Error("--concurrency deve ser um inteiro entre 1 e 20");
  }

  return {
    help: false,
    apply: args.has("--apply"),
    projectId: valueOf("--project", process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID),
    concurrency,
  };
}

function isCanonicalGroupMemberPath(path) {
  const parts = path.split("/");
  return parts.length === 4 && parts[0] === "groups" && parts[2] === "members";
}

function hasOwnStatus(data) {
  return Object.prototype.hasOwnProperty.call(data, "status");
}

function summarizeMemberSnapshots(snapshots) {
  const canonical = snapshots.filter((snapshot) => isCanonicalGroupMemberPath(snapshot.ref.path));
  const statusCounts = {};
  const missing = [];

  for (const snapshot of canonical) {
    const data = snapshot.data();
    if (!hasOwnStatus(data)) {
      missing.push(snapshot);
      continue;
    }
    const key = String(data.status);
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }

  return {
    scannedCollectionGroup: snapshots.length,
    canonicalMembers: canonical.length,
    missingStatus: missing.length,
    existingStatus: canonical.length - missing.length,
    statusCounts,
    missing,
  };
}

async function scanMembers(db) {
  const snapshot = await db.collectionGroup("members").select("status").get();
  return summarizeMemberSnapshots(snapshot.docs);
}

async function migrateMemberTransaction(db, ref) {
  return db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(ref);
    if (!fresh.exists) return "deleted";
    if (hasOwnStatus(fresh.data())) return "already-set";

    transaction.update(ref, {status: "ACTIVE"});
    return "updated";
  });
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({length: Math.min(concurrency, Math.max(items.length, 1))}, runWorker),
  );
  return results;
}

function printableSummary(summary) {
  return {
    scannedCollectionGroup: summary.scannedCollectionGroup,
    canonicalMembers: summary.canonicalMembers,
    missingStatus: summary.missingStatus,
    existingStatus: summary.existingStatus,
    statusCounts: summary.statusCounts,
  };
}

async function runBackfill({db, apply, concurrency, log = console.log}) {
  const before = await scanMembers(db);
  log(`ANTES ${JSON.stringify(printableSummary(before))}`);

  if (!apply) {
    const projectedStatusCounts = {
      ...before.statusCounts,
      ACTIVE: (before.statusCounts.ACTIVE || 0) + before.missingStatus,
    };
    log("DRY-RUN: nenhuma escrita foi executada. Use --apply para confirmar.");
    log(`DEPOIS_PROJETADO ${JSON.stringify({
      ...printableSummary(before),
      missingStatus: 0,
      existingStatus: before.canonicalMembers,
      statusCounts: projectedStatusCounts,
    })}`);
    return {before, after: before, projected: true, results: []};
  }

  const results = await mapWithConcurrency(
    before.missing.map((snapshot) => snapshot.ref),
    concurrency,
    (ref) => migrateMemberTransaction(db, ref),
  );
  const outcomeCounts = results.reduce((counts, outcome) => {
    counts[outcome] = (counts[outcome] || 0) + 1;
    return counts;
  }, {});
  log(`APLICAÇÃO ${JSON.stringify(outcomeCounts)}`);

  const after = await scanMembers(db);
  log(`DEPOIS ${JSON.stringify(printableSummary(after))}`);
  return {before, after, projected: false, results};
}

function printHelp() {
  console.log(`Uso:
  node scripts/migrations/backfill-group-member-status.js [--project=ID]
  node scripts/migrations/backfill-group-member-status.js --apply [--project=ID] [--concurrency=8]

Sem --apply, executa somente leitura e mostra o resultado projetado.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const admin = require("firebase-admin");
  if (admin.apps.length === 0) admin.initializeApp({projectId: options.projectId});
  const target = process.env.FIRESTORE_EMULATOR_HOST || "produção/ADC";
  console.log(`Projeto: ${options.projectId}`);
  console.log(`Destino: ${target}`);
  console.log(`Modo: ${options.apply ? "APPLY" : "DRY-RUN"}`);

  await runBackfill({
    db: admin.firestore(),
    apply: options.apply,
    concurrency: options.concurrency,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backfill falhou:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  hasOwnStatus,
  isCanonicalGroupMemberPath,
  mapWithConcurrency,
  migrateMemberTransaction,
  parseArgs,
  runBackfill,
  summarizeMemberSnapshots,
};
