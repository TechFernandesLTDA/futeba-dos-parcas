#!/usr/bin/env node
'use strict';

/**
 * Audita integridade de xp_logs.
 *
 * Regra principal:
 *   XP positivo precisa ter origem auditavel (`source_collection` +
 *   `source_event_id`). Dados historicos sem origem podem ser marcados como
 *   `legacy_unattributed`, mas continuam aparecendo no relatorio.
 *
 * Uso:
 *   node scripts/validation/check_xp_logs.js --project futebadosparcas
 *   node scripts/validation/check_xp_logs.js --json
 *   node scripts/validation/check_xp_logs.js --fix --dry-run
 *   node scripts/validation/check_xp_logs.js --allow-legacy
 */

const DEFAULT_LIMIT = 5000;
const PAGE_SIZE = 500;
const DEFAULT_MAX_DETAILS = 50;
const SCRIPT_NAME = 'check_xp_logs';
let admin = null;

function getAdmin() {
  if (admin) return admin;
  try {
    admin = require('firebase-admin');
    return admin;
  } catch (error) {
    throw new Error(
      'firebase-admin nao encontrado. Rode npm install na raiz do repo ' +
      'ou use NODE_PATH=functions/node_modules.'
    );
  }
}

function parseArgs(argv) {
  const opts = {
    allowLegacy: false,
    checkSourceExists: false,
    dryRun: false,
    fix: false,
    json: false,
    limit: DEFAULT_LIMIT,
    maxDetails: DEFAULT_MAX_DETAILS,
    project: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-legacy') opts.allowLegacy = true;
    else if (arg === '--check-source-exists') opts.checkSourceExists = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--fix') opts.fix = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--project') opts.project = argv[++i];
    else if (arg.startsWith('--project=')) opts.project = arg.slice('--project='.length);
    else if (arg === '--limit') opts.limit = Number(argv[++i]);
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice('--limit='.length));
    else if (arg === '--max-details') opts.maxDetails = Number(argv[++i]);
    else if (arg.startsWith('--max-details=')) opts.maxDetails = Number(arg.slice('--max-details='.length));
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }

  if (!Number.isInteger(opts.limit) || opts.limit <= 0) {
    throw new Error('--limit deve ser um inteiro positivo');
  }
  if (!Number.isInteger(opts.maxDetails) || opts.maxDetails < 0) {
    throw new Error('--max-details deve ser um inteiro maior ou igual a zero');
  }

  if (opts.dryRun && !opts.fix) {
    throw new Error('--dry-run deve ser usado junto com --fix');
  }

  return opts;
}

function printUsage() {
  console.log(
    [
      'uso: node scripts/validation/check_xp_logs.js [opcoes]',
      '',
      'opcoes:',
      '  --project <id>          Firebase project id (ex.: futebadosparcas)',
      `  --limit <n>            Maximo de xp_logs lidos (padrao: ${DEFAULT_LIMIT})`,
      `  --max-details <n>      Maximo de exemplos por categoria (padrao: ${DEFAULT_MAX_DETAILS})`,
      '  --json                 Imprime relatorio JSON',
      '  --fix                  Marca logs historicos sem origem como legacy_unattributed',
      '  --dry-run              Mostra o que seria marcado, sem gravar',
      '  --allow-legacy         Exit 0 quando restarem apenas legados marcados',
      '  --check-source-exists  Confere se source_collection/source_event_id existe',
    ].join('\n')
  );
}

function readNumber(data, fields) {
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function readString(data, fields) {
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

function isLegacyUnattributed(data) {
  return data.legacy_unattributed === true ||
    data.audit_status === 'legacy_unattributed' ||
    data.source === 'legacy_unattributed';
}

function hasAuditableSource(data) {
  return readString(data, ['source_collection']).length > 0 &&
    readString(data, ['source_event_id']).length > 0;
}

function classifyXpLog(docId, data) {
  const xp = readNumber(data, ['xp_earned', 'amount', 'xpEarned']);
  const userId = readString(data, ['user_id', 'userId']);
  const sourceCollection = readString(data, ['source_collection']);
  const sourceEventId = readString(data, ['source_event_id']);
  const source = readString(data, ['source']);
  const transactionId = readString(data, ['transaction_id']) || docId;
  const positive = xp > 0;
  const auditable = hasAuditableSource(data);
  const legacyUnattributed = isLegacyUnattributed(data);

  let status = 'ok';
  if (positive && !auditable) {
    status = legacyUnattributed ? 'legacy_unattributed' : 'missing_source';
  }

  return {
    docId,
    transactionId,
    userId,
    xp,
    source,
    sourceCollection,
    sourceEventId,
    positive,
    auditable,
    legacyUnattributed,
    status,
  };
}

function createReportHeader(opts) {
  return {
    generatedAt: new Date().toISOString(),
    limit: opts.limit,
    maxDetails: opts.maxDetails,
    project: opts.project || null,
    allowLegacy: opts.allowLegacy,
    checkSourceExists: opts.checkSourceExists,
    dryRun: opts.dryRun,
    fix: opts.fix,
  };
}

function pushDetail(list, item, opts) {
  if (list.length < opts.maxDetails) {
    list.push(item);
  }
}

function shouldFail(report, opts) {
  const unresolvedMissingSource = opts.fix ?
    Math.max(0, report.summary.missingSource - report.summary.markedLegacy) :
    report.summary.missingSource;
  if (unresolvedMissingSource > 0) return true;
  if (!opts.allowLegacy && report.summary.legacyUnattributed > 0) return true;
  if (report.summary.missingReferencedSource > 0) return true;
  return false;
}

function initFirestore(opts) {
  const firebaseAdmin = getAdmin();
  if (!firebaseAdmin.apps.length) {
    const config = { credential: firebaseAdmin.credential.applicationDefault() };
    if (opts.project) config.projectId = opts.project;
    firebaseAdmin.initializeApp(config);
  }
  return firebaseAdmin.firestore();
}

async function sourceExists(db, item) {
  if (!item.sourceCollection || !item.sourceEventId) return false;
  const snap = await db.collection(item.sourceCollection).doc(item.sourceEventId).get();
  return snap.exists;
}

async function auditXpLogs(db, opts) {
  const firebaseAdmin = opts.fix && !opts.dryRun ? getAdmin() : null;
  let batch = firebaseAdmin ? db.batch() : null;
  let batchCount = 0;

  async function commitBatchIfNeeded(force = false) {
    if (!batch || batchCount === 0) return;
    if (!force && batchCount < 450) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  async function markLegacy(item) {
    if (opts.dryRun) {
      report.summary.markedLegacy += 1;
      return;
    }
    batch.set(db.collection('xp_logs').doc(item.docId), {
      audit_status: 'legacy_unattributed',
      legacy_unattributed: true,
      source: 'legacy_unattributed',
      audit_checked_at: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      audit_checked_by: SCRIPT_NAME,
    }, { merge: true });
    batchCount += 1;
    report.summary.markedLegacy += 1;
    await commitBatchIfNeeded();
  }

  const report = {
    ...createReportHeader(opts),
    summary: {
      scanned: 0,
      positive: 0,
      auditable: 0,
      missingSource: 0,
      legacyUnattributed: 0,
      missingReferencedSource: 0,
      markedLegacy: 0,
    },
    truncated: {
      missingSource: false,
      legacyUnattributed: false,
      missingReferencedSource: false,
    },
    missingSource: [],
    legacyUnattributed: [],
    missingReferencedSource: [],
  };

  let lastDoc = null;
  let keepGoing = true;

  while (keepGoing && report.summary.scanned < opts.limit) {
    const remaining = opts.limit - report.summary.scanned;
    let query = db
      .collection('xp_logs')
      .orderBy('__name__')
      .limit(Math.min(PAGE_SIZE, remaining));
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const item = classifyXpLog(doc.id, doc.data());
      report.summary.scanned += 1;
      if (item.positive) report.summary.positive += 1;
      if (item.positive && item.auditable) report.summary.auditable += 1;

      if (item.status === 'missing_source') {
        report.summary.missingSource += 1;
        pushDetail(report.missingSource, item, opts);
        report.truncated.missingSource = report.summary.missingSource > report.missingSource.length;
        if (opts.fix) {
          await markLegacy(item);
        }
      } else if (item.status === 'legacy_unattributed') {
        report.summary.legacyUnattributed += 1;
        pushDetail(report.legacyUnattributed, item, opts);
        report.truncated.legacyUnattributed =
          report.summary.legacyUnattributed > report.legacyUnattributed.length;
      }

      if (opts.checkSourceExists && item.positive && item.auditable) {
        const exists = await sourceExists(db, item);
        if (!exists) {
          report.summary.missingReferencedSource += 1;
          pushDetail(report.missingReferencedSource, item, opts);
          report.truncated.missingReferencedSource =
            report.summary.missingReferencedSource > report.missingReferencedSource.length;
        }
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    keepGoing = snapshot.size === Math.min(PAGE_SIZE, remaining);
  }

  await commitBatchIfNeeded(true);

  return report;
}

function printHumanReport(report) {
  console.log('\n========================================');
  console.log('   AUDITORIA DE XP LOGS - Futeba');
  console.log('========================================\n');
  console.log(`Projeto:                 ${report.project || '(ADC default)'}`);
  console.log(`Lidos:                   ${report.summary.scanned}`);
  console.log(`XP positivo:             ${report.summary.positive}`);
  console.log(`Com origem auditavel:    ${report.summary.auditable}`);
  console.log(`Sem origem:              ${report.summary.missingSource}`);
  console.log(`Legado sem origem:       ${report.summary.legacyUnattributed}`);
  console.log(`Origem inexistente:      ${report.summary.missingReferencedSource}`);
  if (report.fix) {
    console.log(`Marcados como legado:    ${report.summary.markedLegacy}${report.dryRun ? ' (dry-run)' : ''}`);
  }

  const sample = report.missingSource.slice(0, 10);
  if (sample.length > 0) {
    console.log(`\nXP positivo sem origem (amostra de ${sample.length}):`);
    for (const item of sample) {
      console.log(`  - ${item.docId}: user=${item.userId || 'N/A'} xp=${item.xp}`);
    }
  }

  const legacy = report.legacyUnattributed.slice(0, 10);
  if (legacy.length > 0) {
    console.log(`\nLegado marcado sem origem (amostra de ${legacy.length}):`);
    for (const item of legacy) {
      console.log(`  - ${item.docId}: user=${item.userId || 'N/A'} xp=${item.xp}`);
    }
  }

  const missingRefs = report.missingReferencedSource.slice(0, 10);
  if (missingRefs.length > 0) {
    console.log(`\nOrigem apontada mas inexistente (amostra de ${missingRefs.length}):`);
    for (const item of missingRefs) {
      console.log(`  - ${item.docId}: ${item.sourceCollection}/${item.sourceEventId}`);
    }
  }
  if (
    report.truncated.missingSource ||
    report.truncated.legacyUnattributed ||
    report.truncated.missingReferencedSource
  ) {
    console.log('\nDetalhes truncados. Use --max-details para ajustar a amostra.');
  }

  console.log('\n========================================\n');
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`erro: ${error.message}`);
    printUsage();
    process.exit(2);
  }

  if (opts.help) {
    printUsage();
    return;
  }

  const db = initFirestore(opts);
  const report = await auditXpLogs(db, opts);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }
  process.exit(shouldFail(report, opts) ? 1 : 0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('erro:', error);
    process.exit(2);
  });
}

module.exports = {
  auditXpLogs,
  classifyXpLog,
  hasAuditableSource,
  isLegacyUnattributed,
  parseArgs,
  shouldFail,
};
