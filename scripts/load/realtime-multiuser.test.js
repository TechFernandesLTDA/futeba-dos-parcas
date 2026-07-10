const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertEmulator,
  evaluateGates,
  parseOptions,
  percentile,
  summarize,
} = require('./realtime-multiuser');

test('percentile usa nearest-rank de forma determinística', () => {
  assert.equal(percentile([50, 10, 40, 20, 30], 0.5), 30);
  assert.equal(percentile([50, 10, 40, 20, 30], 0.95), 50);
  assert.equal(percentile([], 0.95), 0);
});

test('parseOptions aceita somente perfis entre 1 e 1000', () => {
  assert.equal(parseOptions(['--vus', '100'], {}).vus, 100);
  assert.throws(() => parseOptions(['--vus', '0'], {}), /entre 1 e 1000/);
  assert.throws(() => parseOptions(['--vus', '1001'], {}), /entre 1 e 1000/);
});

test('assertEmulator bloqueia qualquer host não local', () => {
  assert.doesNotThrow(() => assertEmulator({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085' }));
  assert.throws(() => assertEmulator({ FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' }), /local é obrigatório/);
  assert.throws(() => assertEmulator({}), /local é obrigatório/);
});

test('summarize e evaluateGates rejeitam erro, latência e invariante', () => {
  assert.deepEqual(summarize([10, 20], ['boom'], 3), {
    total: 3,
    succeeded: 2,
    failed: 1,
    errorRate: 1 / 3,
    p50Ms: 10,
    p95Ms: 20,
    p99Ms: 20,
    maxMs: 20,
  });
  const failures = evaluateGates({
    scenarios: {
      listenerFanout: { metrics: summarize([2_100], [], 1), invariant: false },
    },
  });
  assert.ok(failures.some((failure) => failure.includes('p95')));
  assert.ok(failures.some((failure) => failure.includes('invariant')));
});
