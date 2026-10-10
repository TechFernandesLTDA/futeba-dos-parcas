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

test('runGate: timeout cancela o E2E disparado (não deixa run órfão na fila de emuladores)', async () => {
  const clock = fakeClock();
  const cancelled = [];
  const seen = [];
  const result = await runGate({
    ref: 'feat/x',
    expectSha: SHA,
    dispatch: async () => {},
    findRun: async () => ({ id: 77, status: 'in_progress', conclusion: null, head_sha: SHA }),
    onRun: (run) => { seen.push(run.id); },
    cancelRun: async (run) => { cancelled.push(run.id); },
    sleep: clock.sleep,
    now: clock.now,
    pollMs: 1000,
    timeoutMs: 3000,
  });
  assert.equal(result.exitCode, EXIT.TIMEOUT);
  assert.deepEqual(cancelled, [77]);
  assert.ok(seen.length > 0 && seen.every((id) => id === 77));
});

test('runGate: falha ao cancelar não mascara o veredito de timeout', async () => {
  const clock = fakeClock();
  const origError = console.error;
  console.error = () => {};
  try {
    const result = await runGate({
      ref: 'feat/x',
      expectSha: SHA,
      dispatch: async () => {},
      findRun: async () => ({ id: 5, status: 'queued', conclusion: null, head_sha: SHA }),
      cancelRun: async () => { throw new Error('boom'); },
      sleep: clock.sleep,
      now: clock.now,
      pollMs: 1000,
      timeoutMs: 2000,
    });
    assert.equal(result.exitCode, EXIT.TIMEOUT);
  } finally {
    console.error = origError;
  }
});

test('runGate: run concluído com sucesso nunca é cancelado', async () => {
  const cancelled = [];
  const result = await runGate({
    ref: 'master',
    expectSha: SHA,
    dispatch: async () => {},
    findRun: async () => ({ id: 3, status: 'completed', conclusion: 'success', head_sha: SHA }),
    cancelRun: async (run) => { cancelled.push(run.id); },
    sleep: async () => {},
  });
  assert.equal(result.exitCode, EXIT.PASS);
  assert.deepEqual(cancelled, []);
});

test('applySuperseded: stale/cancelled com branch avançado vira superseded (exit 0)', () => {
  const { applySuperseded, EXIT } = require('./e2e-gate');
  const stale = { verdict: 'stale', exitCode: EXIT.FAIL, reason: 'head_sha b != esperado a' };
  assert.equal(applySuperseded(stale, { expectSha: 'a', currentHeadSha: 'b' }).verdict, 'superseded');
  assert.equal(applySuperseded(stale, { expectSha: 'a', currentHeadSha: 'b' }).exitCode, EXIT.PASS);
  const cancelled = { verdict: 'fail', exitCode: EXIT.FAIL, reason: 'conclusion=cancelled' };
  assert.equal(applySuperseded(cancelled, { expectSha: 'a', currentHeadSha: 'b' }).verdict, 'superseded');
});

test('applySuperseded: nunca converte falha real nem branch parado', () => {
  const { applySuperseded, EXIT } = require('./e2e-gate');
  const failure = { verdict: 'fail', exitCode: EXIT.FAIL, reason: 'conclusion=failure' };
  assert.equal(applySuperseded(failure, { expectSha: 'a', currentHeadSha: 'b' }).verdict, 'fail');
  const cancelled = { verdict: 'fail', exitCode: EXIT.FAIL, reason: 'conclusion=cancelled' };
  assert.equal(applySuperseded(cancelled, { expectSha: 'a', currentHeadSha: 'a' }).verdict, 'fail');
  assert.equal(applySuperseded(cancelled, { expectSha: 'a', currentHeadSha: null }).verdict, 'fail');
});

test('runGate: erro transitório do findRun não derruba o gate (#4340)', async () => {
  let calls = 0;
  const result = await runGate({
    ref: 'master',
    expectSha: SHA,
    dispatch: async () => {},
    findRun: async () => {
      calls += 1;
      if (calls === 1) throw new Error('error connecting to api.github.com');
      return { id: 9, status: 'completed', conclusion: 'success', head_sha: SHA };
    },
    sleep: async () => {},
  });
  assert.equal(calls, 2);
  assert.equal(result.verdict, 'pass');
  assert.equal(result.exitCode, EXIT.PASS);
});

test('runGate: erro transitório depois de achar o run mantém o run e conclui', async () => {
  const seq = [
    () => ({ id: 9, status: 'in_progress', conclusion: null, head_sha: SHA }),
    () => { throw new Error('error connecting to api.github.com'); },
    () => ({ id: 9, status: 'completed', conclusion: 'failure', head_sha: SHA }),
  ];
  let i = 0;
  const result = await runGate({
    ref: 'master', expectSha: SHA, dispatch: async () => {},
    findRun: async () => seq[i++](), sleep: async () => {},
  });
  assert.equal(result.exitCode, EXIT.FAIL);
  assert.equal(result.run_id, 9);
});

test('runGate: falhas de polling seguidas sem fim viram infra_blocked e cancelam o run órfão', async () => {
  const cancelled = [];
  let n = 0;
  const result = await runGate({
    ref: 'master', expectSha: SHA, dispatch: async () => {},
    findRun: async () => {
      n += 1;
      if (n === 1) return { id: 5, status: 'in_progress', conclusion: null, head_sha: SHA };
      throw new Error('error connecting to api.github.com');
    },
    cancelRun: async (r) => { cancelled.push(r.id); },
    sleep: async () => {},
    maxConsecutivePollErrors: 3,
  });
  assert.equal(result.verdict, 'infra_blocked');
  assert.equal(result.exitCode, EXIT.INFRA_BLOCKED);
  assert.deepEqual(cancelled, [5]);
});

test('runGate: erro de polling não é confundido com "nenhum run apareceu"', async () => {
  let t = 0;
  let n = 0;
  const result = await runGate({
    ref: 'master', expectSha: SHA, dispatch: async () => {},
    findRun: async () => {
      n += 1;
      if (n <= 2) throw new Error('boom');
      return { id: 1, status: 'completed', conclusion: 'success', head_sha: SHA };
    },
    now: () => t, sleep: async () => { t += 10 * 60 * 1000; },
    timeoutMs: 60 * 60 * 1000,
  });
  assert.equal(result.verdict, 'pass');
});

test('runGate: dispatch com falha transitória é repetido; falha persistente propaga', async () => {
  let d = 0;
  const ok = await runGate({
    ref: 'master', expectSha: SHA,
    dispatch: async () => { d += 1; if (d < 3) throw new Error('error connecting to api.github.com'); },
    findRun: async () => ({ id: 1, status: 'completed', conclusion: 'success', head_sha: SHA }),
    sleep: async () => {},
  });
  assert.equal(d, 3);
  assert.equal(ok.exitCode, EXIT.PASS);

  let e = 0;
  await assert.rejects(runGate({
    ref: 'master', dispatch: async () => { e += 1; throw new Error('down'); },
    findRun: async () => null, sleep: async () => {}, dispatchAttempts: 2,
  }), /down/);
  assert.equal(e, 2);
});
