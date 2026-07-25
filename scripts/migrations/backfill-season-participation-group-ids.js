#!/usr/bin/env node
"use strict";

/**
 * Backfill idempotente de `season_participation/{seasonId}_{uid}.group_ids`.
 *
 * Contexto (#3900): o #3879 (PR #3893) trocou o filtro do ranking de Liga por
 * grupo de `group_id ==` para `group_ids array-contains`, mas nenhum backfill
 * foi feito. O Firestore exclui de `array-contains` todo documento que não tem
 * o campo, então os docs gravados antes daquele deploy — que só têm o escalar
 * `group_id` — sumiram do ranking, e a UI passou a renderizar o roster do grupo
 * com todas as estatísticas zeradas.
 *
 * Seguro por padrão (somente leitura):
 *   node scripts/migrations/backfill-season-participation-group-ids.js
 *
 * Aplicação explícita:
 *   node scripts/migrations/backfill-season-participation-group-ids.js --apply --project=futebadosparcas
 *
 * Restrito a uma temporada:
 *   node scripts/migrations/backfill-season-participation-group-ids.js --apply --season=2026-07
 *
 * A escrita usa `arrayUnion`, que é idempotente e não perde o valor que o fluxo
 * de jogo (functions/src/game/helpers.ts:752) possa ter gravado em paralelo.
 * Documentos que já têm `group_ids` são ignorados no scan, então a segunda
 * execução não altera nenhum documento.
 */

const DEFAULT_PROJECT_ID = "futebadosparcas";
const DEFAULT_PAGE_SIZE = 400;
const COLLECTION = "season_participation";

function parseArgs(argv) {
  const args = new Set(argv);
  const valueOf = (name, fallback) => {
    const prefix = `${name}=`;
    const raw = argv.find((arg) => arg.startsWith(prefix));
    return raw ? raw.slice(prefix.length) : fallback;
  };

  if (args.has("--help") || args.has("-h")) return {help: true};

  const pageSize = Number(valueOf("--page-size", String(DEFAULT_PAGE_SIZE)));
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error("--page-size deve ser um inteiro entre 1 e 500");
  }

  const season = valueOf("--season", null);
  if (season !== null && !/^\d{4}-\d{2}$/.test(season)) {
    throw new Error("--season deve estar no formato YYYY-MM");
  }

  return {
    help: false,
    apply: args.has("--apply"),
    projectId: valueOf("--project", process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID),
    pageSize,
    season,
  };
}

function readGroupId(data) {
  const raw = data && data.group_id;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * Um documento precisa de backfill quando tem `group_id` escalar utilizável e
 * ainda não tem o array `group_ids`. Presença do array — mesmo vazio — indica
 * documento já escrito pelo fluxo novo; não sobrescrevemos.
 */
function needsBackfill(data) {
  if (readGroupId(data) === null) return false;
  return !Object.prototype.hasOwnProperty.call(data || {}, "group_ids");
}

function summarizeDocs(docs) {
  const pending = [];
  let alreadyMigrated = 0;
  let withoutGroup = 0;

  for (const doc of docs) {
    const data = doc.data();
    if (readGroupId(data) === null) {
      withoutGroup += 1;
      continue;
    }
    if (needsBackfill(data)) {
      pending.push({ref: doc.ref, groupId: readGroupId(data)});
      continue;
    }
    alreadyMigrated += 1;
  }

  return {
    scanned: docs.length,
    pending: pending.length,
    alreadyMigrated,
    withoutGroup,
    candidates: pending,
  };
}

function mergeSummaries(target, page) {
  target.scanned += page.scanned;
  target.pending += page.pending;
  target.alreadyMigrated += page.alreadyMigrated;
  target.withoutGroup += page.withoutGroup;
  return target;
}

function emptySummary() {
  return {scanned: 0, pending: 0, alreadyMigrated: 0, withoutGroup: 0, written: 0};
}

/**
 * Varre a coleção paginando por `__name__` e aplica (ou projeta) o backfill.
 *
 * `fieldPath` e `fieldValue` são injetados para que o módulo permaneça
 * testável sem depender de `firebase-admin`.
 */
async function runBackfill({db, apply, pageSize, season, fieldPath, fieldValue, log = console.log}) {
  const summary = emptySummary();
  let cursor = null;

  for (;;) {
    let query = db.collection(COLLECTION);
    if (season) query = query.where("season_id", "==", season);
    query = query.orderBy(fieldPath.documentId()).limit(pageSize);
    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    if (snap.docs.length === 0) break;

    const page = summarizeDocs(snap.docs);
    mergeSummaries(summary, page);

    if (apply && page.candidates.length > 0) {
      const batch = db.batch();
      for (const candidate of page.candidates) {
        batch.update(candidate.ref, {
          group_ids: fieldValue.arrayUnion(candidate.groupId),
        });
      }
      await batch.commit();
      summary.written += page.candidates.length;
    }

    log(`PÁGINA ${JSON.stringify({
      scanned: page.scanned,
      pending: page.pending,
      alreadyMigrated: page.alreadyMigrated,
      withoutGroup: page.withoutGroup,
      acumulado: summary.scanned,
    })}`);

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < pageSize) break;
  }

  if (!apply) {
    log("DRY-RUN: nenhuma escrita foi executada. Use --apply para confirmar.");
  }
  log(`RESUMO ${JSON.stringify(summary)}`);
  return summary;
}

function printHelp() {
  console.log(`Uso:
  node scripts/migrations/backfill-season-participation-group-ids.js [--project=ID] [--season=YYYY-MM]
  node scripts/migrations/backfill-season-participation-group-ids.js --apply [--project=ID] [--season=YYYY-MM] [--page-size=400]

Sem --apply, executa somente leitura e mostra o total pendente.
Contexto: issue #3900 (regressão do #3879).`);
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
  console.log(`Temporada: ${options.season || "todas"}`);
  console.log(`Modo: ${options.apply ? "APPLY" : "DRY-RUN"}`);

  await runBackfill({
    db: admin.firestore(),
    apply: options.apply,
    pageSize: options.pageSize,
    season: options.season,
    fieldPath: admin.firestore.FieldPath,
    fieldValue: admin.firestore.FieldValue,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backfill falhou:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  mergeSummaries,
  needsBackfill,
  parseArgs,
  readGroupId,
  runBackfill,
  summarizeDocs,
};
