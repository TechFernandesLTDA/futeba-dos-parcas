#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const DEFAULT_SLO = Object.freeze({
  p95Ms: 2_000,
  p99Ms: 5_000,
  maxErrorRate: 0.01,
  listenerP95Ms: 1_500,
});

const SCENARIO_SLO = Object.freeze({
  listenerFanout: { p95Ms: 1_500, p99Ms: 5_000 },
  // Benchmark diagnóstico de contenção deliberada em um único documento.
  // O produto não deve depender deste padrão; #3504 remove hotspots reais.
  contendedTransactions: { diagnostic: true, p95Ms: 5_000, p99Ms: 10_000 },
  distributedWrites: { p95Ms: 2_000, p99Ms: 5_000 },
});

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function summarize(latencies, errors, total) {
  return {
    total,
    succeeded: Math.max(0, total - errors.length),
    failed: errors.length,
    errorRate: total === 0 ? 0 : errors.length / total,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: latencies.length === 0 ? 0 : Math.max(...latencies),
  };
}

function parseOptions(argv = process.argv.slice(2), env = process.env) {
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const vus = Number(valueAfter('--vus') ?? env.LOAD_VUS ?? 10);
  if (!Number.isInteger(vus) || vus < 1 || vus > 1_000) {
    throw new Error('--vus deve ser um inteiro entre 1 e 1000');
  }
  return {
    vus,
    output: valueAfter('--output') ?? env.LOAD_OUTPUT ?? 'test-results/realtime-load',
    projectId: env.GCLOUD_PROJECT ?? 'demo-realtime-load',
    timeoutMs: Number(env.LOAD_TIMEOUT_MS ?? 15_000),
  };
}

function assertEmulator(env = process.env) {
  const host = env.FIRESTORE_EMULATOR_HOST;
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
    throw new Error('FIRESTORE_EMULATOR_HOST local é obrigatório; produção nunca é alvo deste harness');
  }
}

function evaluateGates(report, slo = DEFAULT_SLO) {
  const failures = [];
  for (const [name, result] of Object.entries(report.scenarios)) {
    const scenarioSlo = SCENARIO_SLO[name] ?? slo;
    if (!scenarioSlo.diagnostic && result.metrics.errorRate > slo.maxErrorRate) {
      failures.push(`${name}: errorRate ${result.metrics.errorRate.toFixed(4)} > ${slo.maxErrorRate}`);
    }
    if (!scenarioSlo.diagnostic && result.metrics.p95Ms > scenarioSlo.p95Ms) {
      failures.push(`${name}: p95 ${result.metrics.p95Ms.toFixed(1)}ms > ${scenarioSlo.p95Ms}ms`);
    }
    if (!scenarioSlo.diagnostic && result.metrics.p99Ms > scenarioSlo.p99Ms) {
      failures.push(`${name}: p99 ${result.metrics.p99Ms.toFixed(1)}ms > ${scenarioSlo.p99Ms}ms`);
    }
    if (result.invariant !== true) failures.push(`${name}: invariant failed`);
  }
  return failures;
}

async function runListenerFanout(db, root, vus, timeoutMs) {
  const signalRef = root.collection('signals').doc('current');
  await signalRef.set({ sequence: 0, updatedAt: FieldValue.serverTimestamp() });

  const unsubscribes = [];
  const ready = [];
  const deliveries = [];
  const errors = [];
  let writeStartedAt = 0;

  for (let index = 0; index < vus; index += 1) {
    ready.push(new Promise((resolve, reject) => {
      let bootstrapped = false;
      const unsubscribe = signalRef.onSnapshot((snapshot) => {
        const sequence = snapshot.get('sequence');
        if (!bootstrapped) {
          bootstrapped = true;
          resolve();
          return;
        }
        if (sequence === 1) deliveries.push(performance.now() - writeStartedAt);
      }, (error) => {
        errors.push(String(error?.message ?? error));
        reject(error);
      });
      unsubscribes.push(unsubscribe);
    }));
  }

  try {
    await Promise.all(ready);
    writeStartedAt = performance.now();
    await signalRef.update({ sequence: 1, updatedAt: FieldValue.serverTimestamp() });
    const deadline = Date.now() + timeoutMs;
    while (deliveries.length < vus && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (deliveries.length < vus) errors.push(`timeout: ${deliveries.length}/${vus} listeners receberam a atualização`);
  } finally {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  return {
    metrics: summarize(deliveries, errors, vus),
    invariant: deliveries.length === vus,
    details: { delivered: deliveries.length, expected: vus, errors: errors.slice(0, 10) },
  };
}

async function runContendedTransactions(db, root, vus) {
  const counterRef = root.collection('hotspots').doc('counter');
  await counterRef.set({ count: 0 });
  const latencies = [];
  const errors = [];

  await Promise.all(Array.from({ length: vus }, async (_, index) => {
    const startedAt = performance.now();
    try {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        transaction.update(counterRef, { count: Number(snapshot.get('count') ?? 0) + 1 });
      });
      latencies.push(performance.now() - startedAt);
    } catch (error) {
      errors.push(`vu-${index}: ${String(error?.message ?? error)}`);
    }
  }));

  const finalCount = Number((await counterRef.get()).get('count') ?? 0);
  return {
    metrics: summarize(latencies, errors, vus),
    invariant: finalCount === vus - errors.length,
    details: { finalCount, expected: vus - errors.length, errors: errors.slice(0, 10) },
  };
}

async function runDistributedWrites(root, vus) {
  const latencies = [];
  const errors = [];
  await Promise.all(Array.from({ length: vus }, async (_, index) => {
    const startedAt = performance.now();
    try {
      await root.collection('distributed').doc(`vu-${String(index).padStart(4, '0')}`).set({
        index,
        createdAt: FieldValue.serverTimestamp(),
      });
      latencies.push(performance.now() - startedAt);
    } catch (error) {
      errors.push(`vu-${index}: ${String(error?.message ?? error)}`);
    }
  }));
  const size = (await root.collection('distributed').get()).size;
  return {
    metrics: summarize(latencies, errors, vus),
    invariant: size === vus - errors.length,
    details: { documents: size, expected: vus - errors.length, errors: errors.slice(0, 10) },
  };
}

function markdown(report) {
  const lines = [
    '# Realtime multiuser load report',
    '',
    `- VUs: ${report.vus}`,
    `- Firestore emulator: ${report.emulatorHost}`,
    `- Started: ${report.startedAt}`,
    `- Passed: ${report.passed}`,
    '',
    '| Scenario | total | failed | error rate | p50 | p95 | p99 | invariant |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const [name, value] of Object.entries(report.scenarios)) {
    const metrics = value.metrics;
    lines.push(`| ${name} | ${metrics.total} | ${metrics.failed} | ${(metrics.errorRate * 100).toFixed(2)}% | ${metrics.p50Ms.toFixed(1)}ms | ${metrics.p95Ms.toFixed(1)}ms | ${metrics.p99Ms.toFixed(1)}ms | ${value.invariant} |`);
  }
  if (report.failures.length > 0) lines.push('', '## Gate failures', ...report.failures.map((failure) => `- ${failure}`));
  return `${lines.join('\n')}\n`;
}

async function main() {
  assertEmulator();
  const options = parseOptions();
  const app = initializeApp({ projectId: options.projectId }, `realtime-load-${Date.now()}`);
  const db = getFirestore(app);
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const root = db.collection('_load_tests').doc(runId);
  const startedAt = new Date().toISOString();

  try {
    const scenarios = {
      listenerFanout: await runListenerFanout(db, root, options.vus, options.timeoutMs),
      // A contenção deliberada cresce serialmente no emulador. O perfil principal
      // continua usando todos os VUs em fan-out/writes; este diagnóstico é limitado
      // para não transformar o gate de 1000 sessões em um teste de horas.
      contendedTransactions: await runContendedTransactions(db, root, Math.min(options.vus, 25)),
      distributedWrites: await runDistributedWrites(root, options.vus),
    };
    const report = {
      schemaVersion: 1,
      runId,
      vus: options.vus,
      emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
      startedAt,
      finishedAt: new Date().toISOString(),
      slo: DEFAULT_SLO,
      scenarios,
      failures: [],
      passed: false,
    };
    report.failures = evaluateGates(report);
    report.passed = report.failures.length === 0;

    const outputBase = path.resolve(options.output);
    fs.mkdirSync(path.dirname(outputBase), { recursive: true });
    fs.writeFileSync(`${outputBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(`${outputBase}.md`, markdown(report));
    console.log(markdown(report));
    if (!report.passed) process.exitCode = 1;
  } finally {
    await db.recursiveDelete(root).catch(() => undefined);
    await deleteApp(app);
  }
}

module.exports = {
  DEFAULT_SLO,
  SCENARIO_SLO,
  assertEmulator,
  evaluateGates,
  parseOptions,
  percentile,
  summarize,
};

if (require.main === module) {
  main().catch((error) => {
    console.error('[realtime-load] fatal:', error);
    process.exitCode = 1;
  });
}
