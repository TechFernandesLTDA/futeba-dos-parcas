const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, parseOptions, percentile, requestId, summarize } = require('./group-wall-media');

test('parseOptions aceita somente os perfis oficiais e exige Emulator', () => {
  assert.equal(parseOptions(['--vus', '100'], { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).vus, 100);
  assert.throws(() => parseOptions(['--vus', '11'], { FIRESTORE_EMULATOR_HOST: 'x' }), /10, 100 ou 1000/);
  assert.throws(() => parseOptions(['--vus', '10'], {}), /EMULATOR_HOST/);
});

test('métricas e UUIDs do harness são determinísticos', () => {
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  assert.deepEqual(summarize([10, 20], [], 2), {
    total: 2, succeeded: 2, failed: 0, errorRate: 0, p50Ms: 10, p95Ms: 20, p99Ms: 20,
  });
  assert.match(requestId(999), /^[0-9a-f-]{36}$/);
});

test('evaluate bloqueia erro, p95 e invariantes', () => {
  const scenario = (p95Ms, errorRate, invariant) => ({
    metrics: { total: 10, succeeded: 10, failed: 0, errorRate, p50Ms: 1, p95Ms, p99Ms: p95Ms },
    invariant,
  });
  const failures = evaluate({ scenarios: {
    unique: scenario(11_000, 0, true),
    duplicate: scenario(1, 0.1, true),
    contended: scenario(1, 0, false),
  } });
  assert.equal(failures.length, 3);
});
