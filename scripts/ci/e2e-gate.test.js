'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EXIT, evaluateRun, runGate } = require('./e2e-gate');

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

test('evaluateRun: sucesso só com conclusion=success no SHA esperado', () => {
  const ev = evaluateRun({ status: 'completed', conclusion: 'success', head_sha: SHA }, SHA);
  assert.equal(ev.verdict, 'pass');
  assert.equal(ev.exitCode, EXIT.PASS);
});

test('evaluateRun: falha real de E2E bloqueia (exit 1), não vira infra', () => {
  const ev = evaluateRun({ status: 'completed', conclusion: 'failure', head_sha: SHA }, SHA);
  assert.equal(ev.verdict, 'fail');
  assert.equal(ev.exitCode, EXIT.FAIL);
});

test('evaluateRun: startup_failure NUNCA é sucesso (infra bloqueada, exit 2)', () => {
  const ev = evaluateRun({ status: 'completed', conclusion: 'startup_failure', head_sha: SHA }, SHA);
  assert.equal(ev.verdict, 'infra_blocked');
  assert.equal(ev.exitCode, EXIT.INFRA_BLOCKED);
  assert.notEqual(ev.exitCode, EXIT.PASS);
});

test('evaluateRun: cancelled/timed_out/skipped/neutral são falha', () => {
  for (const conclusion of ['cancelled', 'timed_out', 'skipped', 'neutral', 'action_required']) {
    const ev = evaluateRun({ status: 'completed', conclusion, head_sha: SHA }, SHA);
    assert.equal(ev.exitCode, EXIT.FAIL, conclusion);
  }
});

test('evaluateRun: conclusão desconhecida falha fechado', () => {
  const ev = evaluateRun({ status: 'completed', conclusion: 'banana', head_sha: SHA }, SHA);
  assert.equal(ev.exitCode, EXIT.FAIL);
});

test('evaluateRun: SHA diferente do esperado é stale (não pode aprovar PR movido)', () => {
  const ev = evaluateRun({ status: 'completed', conclusion: 'success', head_sha: OTHER }, SHA);
  assert.equal(ev.verdict, 'stale');
  assert.equal(ev.exitCode, EXIT.FAIL);
});

test('evaluateRun: run em andamento fica pending sem exit final', () => {
  const ev = evaluateRun({ status: 'in_progress', conclusion: null, head_sha: SHA }, SHA);
  assert.equal(ev.verdict, 'pending');
  assert.equal(ev.exitCode, null);
});

test('evaluateRun: entrada inválida lança erro', () => {
  assert.throws(() => evaluateRun(null, SHA), TypeError);
});

function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms) => { t += ms; },
  };
}

test('runGate: despacha no ref e aprova somente run success do SHA', async () => {
  const clock = fakeClock();
  const dispatched = [];
  const states = [
    { id: 1, status: 'in_progress', conclusion: null, head_sha: SHA },
    { id: 1, status: 'completed', conclusion: 'success', head_sha: SHA, html_url: 'https://example.invalid/run/1' },
  ];
  const result = await runGate({
    ref: 'feat/x',
    expectSha: SHA,
    dispatch: async (args) => { dispatched.push(args); },
    findRun: async () => states.shift(),
    sleep: clock.sleep,
    now: clock.now,
    pollMs: 10,
    timeoutMs: 1000,
  });
  assert.deepEqual(dispatched, [{ ref: 'feat/x' }]);
  assert.equal(result.verdict, 'pass');
  assert.equal(result.exitCode, EXIT.PASS);
  assert.equal(result.run_id, 1);
});

test('runGate: nenhum run materializa -> infra bloqueada, nunca pass', async () => {
  const clock = fakeClock();
  const result = await runGate({
    ref: 'master',
    expectSha: SHA,
    dispatch: async () => {},
    findRun: async () => null,
    sleep: clock.sleep,
    now: clock.now,
    pollMs: 60000,
    timeoutMs: 60 * 60000,
    noRunGraceMs: 5 * 60000,
  });
  assert.equal(result.verdict, 'infra_blocked');
  assert.equal(result.exitCode, EXIT.INFRA_BLOCKED);
});

test('runGate: run sempre pendente estoura timeout (exit 3)', async () => {
  const clock = fakeClock();
  const result = await runGate({
    ref: 'feat/x',
    expectSha: SHA,
    dispatch: async () => {},
    findRun: async () => ({ id: 9, status: 'queued', conclusion: null, head_sha: SHA }),
    sleep: clock.sleep,
    now: clock.now,
    pollMs: 1000,
    timeoutMs: 5000,
  });
  assert.equal(result.verdict, 'timeout');
  assert.equal(result.exitCode, EXIT.TIMEOUT);
});

test('runGate: startup_failure do run real propaga infra_blocked (não verde)', async () => {
  const clock = fakeClock();
  const result = await runGate({
    ref: 'master',
    expectSha: SHA,
    dispatch: async () => {},
    findRun: async () => ({ id: 2, status: 'completed', conclusion: 'startup_failure', head_sha: SHA }),
    sleep: clock.sleep,
    now: clock.now,
    pollMs: 1000,
    timeoutMs: 5000,
  });
  assert.equal(result.verdict, 'infra_blocked');
  assert.notEqual(result.exitCode, EXIT.PASS);
});

test('runGate: exige ref', async () => {
  await assert.rejects(runGate({ dispatch: async () => {}, findRun: async () => null, sleep: async () => {} }), TypeError);
});
