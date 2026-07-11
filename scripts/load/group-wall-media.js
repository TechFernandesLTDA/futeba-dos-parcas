#!/usr/bin/env node

const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '../..');
const functionsRequire = createRequire(path.join(ROOT, 'functions/package.json'));

function workspaceRequire(name) {
  try {
    return require(name);
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND') throw error;
    return functionsRequire(name);
  }
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function summarize(latencies, errors, total) {
  return {
    total,
    succeeded: total - errors.length,
    failed: errors.length,
    errorRate: total === 0 ? 0 : errors.length / total,
    p50Ms: percentile(latencies, 0.50),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
  };
}

function parseOptions(argv = process.argv.slice(2), env = process.env) {
  const vusIndex = argv.indexOf('--vus');
  const projectIndex = argv.indexOf('--project');
  const vus = Number(vusIndex >= 0 ? argv[vusIndex + 1] : 10);
  if (![10, 100, 1000].includes(vus)) {
    throw new Error('--vus deve ser 10, 100 ou 1000');
  }
  const projectId = projectIndex >= 0
    ? argv[projectIndex + 1]
    : env.GCLOUD_PROJECT || env.FIREBASE_PROJECT_ID || 'futebadosparcas-load';
  if (!env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST é obrigatório; este gate nunca roda em produção');
  }
  return { vus, projectId, json: argv.includes('--json') };
}

function requestId(index) {
  return `0190c2d4-90c2-7b1d-a43d-${index.toString(16).padStart(12, '0')}`;
}

async function timed(operation) {
  const startedAt = performance.now();
  try {
    const value = await operation();
    return { value, latencyMs: performance.now() - startedAt, error: null };
  } catch (error) {
    return { value: null, latencyMs: performance.now() - startedAt, error };
  }
}

async function seed(database, groupId, users) {
  let batch = database.batch();
  let pending = 0;
  const flush = async () => {
    if (pending === 0) return;
    await batch.commit();
    batch = database.batch();
    pending = 0;
  };
  batch.set(database.doc(`groups/${groupId}`), {
    owner_id: 'load-owner', status: 'ACTIVE', is_active: true, deleted_at: null,
  });
  pending += 1;
  for (const uid of users) {
    batch.set(database.doc(`groups/${groupId}/members/${uid}`), {
      user_id: uid, status: 'ACTIVE',
    });
    batch.set(database.doc(`users/${uid}`), { name: `Load ${uid}` });
    pending += 2;
    if (pending >= 450) await flush();
  }
  await flush();
}

async function runScenario(total, operation) {
  const results = await Promise.all(Array.from({ length: total }, (_, index) => timed(() => operation(index))));
  const errors = results.filter(({ error }) => error).map(({ error }) => error);
  return {
    metrics: summarize(results.map(({ latencyMs }) => latencyMs), errors, total),
    values: results.map(({ value }) => value).filter(Boolean),
    errors,
  };
}

function evaluate(report) {
  const limits = {
    unique: { p95Ms: 10_000, maxErrorRate: 0 },
    duplicate: { p95Ms: 5_000, maxErrorRate: 0 },
    contended: { p95Ms: 5_000, maxErrorRate: 0 },
  };
  const failures = [];
  for (const [name, scenario] of Object.entries(report.scenarios)) {
    const limit = limits[name];
    if (scenario.metrics.errorRate > limit.maxErrorRate) {
      failures.push(`${name}: errorRate ${scenario.metrics.errorRate}`);
    }
    if (scenario.metrics.p95Ms > limit.p95Ms) {
      failures.push(`${name}: p95 ${scenario.metrics.p95Ms.toFixed(1)}ms > ${limit.p95Ms}ms`);
    }
    if (!scenario.invariant) failures.push(`${name}: invariant falhou`);
  }
  return failures;
}

function markdown(report) {
  const lines = [
    `# Group wall media load — ${report.vus} usuários`,
    '',
    '| Cenário | total | falhas | erro | p50 | p95 | p99 | invariantes |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const [name, scenario] of Object.entries(report.scenarios)) {
    const m = scenario.metrics;
    lines.push(`| ${name} | ${m.total} | ${m.failed} | ${(m.errorRate * 100).toFixed(2)}% | ${m.p50Ms.toFixed(1)}ms | ${m.p95Ms.toFixed(1)}ms | ${m.p99Ms.toFixed(1)}ms | ${scenario.invariant ? 'OK' : 'FALHOU'} |`);
  }
  return lines.join('\n');
}

async function main() {
  const options = parseOptions();
  const { initializeApp, deleteApp } = workspaceRequire('firebase-admin/app');
  const { getFirestore } = workspaceRequire('firebase-admin/firestore');
  const app = initializeApp({ projectId: options.projectId }, `wall-media-load-${Date.now()}`);
  const database = getFirestore(app);
  const pipeline = require(path.join(ROOT, 'functions/lib/groups/wall-media-pipeline.js'));
  const contract = require(path.join(ROOT, 'functions/lib/groups/wall-media-contract.js'));
  const groupId = `wall-media-load-${Date.now()}`;
  const users = Array.from({ length: options.vus }, (_, index) => `load-user-${index}`);
  const contendedUser = 'load-user-contended';
  const seededUsers = [...users, contendedUser];
  const intents = users.map((_, index) => contract.normalizeWallMediaIntent({
    clientRequestId: requestId(index),
    text: `Load ${index}`,
    declaredContentType: index % 2 === 0 ? 'video/mp4' : 'image/jpeg',
    sizeBytes: 1_024 + index,
  }));

  try {
    await seed(database, groupId, seededUsers);
    const reserve = (index) => pipeline.reserveGroupWallMediaDraft(database, {
      groupId, ownerId: users[index], intent: intents[index], authName: `Load ${index}`,
    });
    const contendedIntent = contract.normalizeWallMediaIntent({
      clientRequestId: requestId(options.vus + 1),
      text: 'Contended',
      declaredContentType: 'image/jpeg',
      sizeBytes: 2_048,
    });
    const reserveContended = () => pipeline.reserveGroupWallMediaDraft(database, {
      groupId, ownerId: contendedUser, intent: contendedIntent, authName: 'Contended',
    });
    // Retry idempotente representa duplo clique/reconexão do mesmo cliente;
    // 10 chamadas simultâneas já cobre esse abuso sem transformar o gate de
    // 1.000 usuários distintos em um benchmark artificial de um único doc.
    const contendedRuns = Math.min(10, options.vus);
    const contended = await runScenario(contendedRuns, reserveContended);
    const unique = await runScenario(options.vus, reserve);
    const duplicate = await runScenario(options.vus, reserve);
    const expectedPosts = new Set(unique.values.map(({ postId }) => postId));
    const draftCount = (await database.collection(`groups/${groupId}/wall_post_drafts`).get()).size;
    const report = {
      vus: options.vus,
      emulator: process.env.FIRESTORE_EMULATOR_HOST,
      scenarios: {
        unique: { metrics: unique.metrics, invariant: expectedPosts.size === options.vus && draftCount === options.vus + 1 && unique.values.every(({ duplicate: value }) => value === false) },
        duplicate: { metrics: duplicate.metrics, invariant: duplicate.values.every(({ duplicate: value, postId }, index) => value === true && postId === unique.values[index]?.postId) },
        contended: { metrics: contended.metrics, invariant: new Set(contended.values.map(({ postId }) => postId)).size === 1 && contended.values.filter(({ duplicate: value }) => value === false).length === 1 && contended.values.filter(({ duplicate: value }) => value === true).length === contendedRuns - 1 },
      },
    };
    const failures = evaluate(report);
    console.log(options.json ? JSON.stringify({ ...report, failures }, null, 2) : `${markdown(report)}\n\n${failures.length ? `FALHAS:\n- ${failures.join('\n- ')}` : 'Gate aprovado.'}`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await database.recursiveDelete(database.doc(`groups/${groupId}`));
    const writer = database.bulkWriter();
    seededUsers.forEach((uid) => writer.delete(database.doc(`users/${uid}`)));
    await writer.close();
    await deleteApp(app);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { evaluate, markdown, parseOptions, percentile, requestId, summarize };
