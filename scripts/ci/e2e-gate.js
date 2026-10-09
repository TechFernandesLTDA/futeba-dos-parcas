#!/usr/bin/env node
'use strict';

// Gate E2E (#4192): dispara web-e2e-ci.yml no ref/SHA exato do PR (ou master
// pós-merge), espera o run REAL e só reporta sucesso quando o próprio GitHub
// marca o run como `conclusion: success` no SHA esperado. Nunca fabrica verde:
// startup_failure vira "infra bloqueada" (exit 2), falha real vira exit 1.

const { execFileSync } = require('node:child_process');

const WORKFLOW_FILE = 'web-e2e-ci.yml';
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_POLL_MS = 30 * 1000;
const NO_RUN_GRACE_MS = 5 * 60 * 1000;

const EXIT = Object.freeze({
  PASS: 0,
  FAIL: 1,
  INFRA_BLOCKED: 2,
  TIMEOUT: 3,
  USAGE: 64,
});

const INFRA_CONCLUSIONS = new Set(['startup_failure']);
const FAIL_CONCLUSIONS = new Set([
  'failure',
  'cancelled',
  'timed_out',
  'action_required',
  'neutral',
  'skipped',
  'stale',
]);

/**
 * Classifica um run do GitHub Actions (formato da API REST: status, conclusion,
 * head_sha). Pura, sem I/O.
 */
function evaluateRun(run, expectSha) {
  if (!run || typeof run !== 'object') {
    throw new TypeError('evaluateRun: run ausente');
  }
  if (run.status !== 'completed') {
    return { verdict: 'pending', exitCode: null, reason: `status=${run.status}` };
  }
  if (expectSha && run.head_sha !== expectSha) {
    return {
      verdict: 'stale',
      exitCode: EXIT.FAIL,
      reason: `head_sha ${run.head_sha} != esperado ${expectSha}`,
    };
  }
  if (run.conclusion === 'success') {
    return { verdict: 'pass', exitCode: EXIT.PASS, reason: 'conclusion=success' };
  }
  if (INFRA_CONCLUSIONS.has(run.conclusion)) {
    return {
      verdict: 'infra_blocked',
      exitCode: EXIT.INFRA_BLOCKED,
      reason: `conclusion=${run.conclusion} (GitHub não executou o run; não é falha de teste nem sucesso)`,
    };
  }
  if (FAIL_CONCLUSIONS.has(run.conclusion)) {
    return { verdict: 'fail', exitCode: EXIT.FAIL, reason: `conclusion=${run.conclusion}` };
  }
  return {
    verdict: 'fail',
    exitCode: EXIT.FAIL,
    reason: `conclusion desconhecida: ${String(run.conclusion)}`,
  };
}

/**
 * Orquestra dispatch + espera. Dependências injetadas para teste:
 *  - dispatch({ ref }) -> Promise<void>
 *  - findRun({ ref, since }) -> Promise<run|null>  (run mais recente criado >= since)
 *  - sleep(ms) -> Promise<void>
 *  - now() -> number (ms)
 *  - onRun(run) -> void           (opcional; recebe o run assim que aparece)
 *  - cancelRun(run) -> Promise    (opcional; chamado quando o gate desiste por timeout,
 *                                  para não deixar um E2E órfão ocupando o runner)
 */
async function runGate({
  ref,
  expectSha,
  dispatch,
  findRun,
  sleep,
  onRun,
  cancelRun,
  now = () => Date.now(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollMs = DEFAULT_POLL_MS,
  noRunGraceMs = NO_RUN_GRACE_MS,
}) {
  if (!ref) throw new TypeError('runGate: ref obrigatório');
  const since = now();
  await dispatch({ ref });

  const deadline = since + timeoutMs;
  let lastRun = null;
  for (;;) {
    const run = await findRun({ ref, since });
    if (run) {
      lastRun = run;
      if (onRun) onRun(run);
      const ev = evaluateRun(run, expectSha);
      if (ev.verdict !== 'pending') {
        return { ...ev, run_id: run.id ?? null, html_url: run.html_url ?? null };
      }
    } else if (now() - since >= noRunGraceMs) {
      return {
        verdict: 'infra_blocked',
        exitCode: EXIT.INFRA_BLOCKED,
        reason: `nenhum run de ${WORKFLOW_FILE} apareceu em ${Math.round(noRunGraceMs / 1000)}s após dispatch`,
        run_id: null,
        html_url: null,
      };
    }
    if (now() >= deadline) {
      if (cancelRun && lastRun && lastRun.id != null) {
        try {
          await cancelRun(lastRun);
        } catch (err) {
          console.error(`e2e-gate: falha ao cancelar run ${lastRun.id}: ${err && err.message}`);
        }
      }
      return {
        verdict: 'timeout',
        exitCode: EXIT.TIMEOUT,
        reason: `sem conclusão após ${Math.round(timeoutMs / 60000)} min`,
        run_id: lastRun ? lastRun.id ?? null : null,
        html_url: lastRun ? lastRun.html_url ?? null : null,
      };
    }
    await sleep(pollMs);
  }
}

/** Implementação real via gh CLI (execFile, sem shell, sem jq). */
function ghJson(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

function realDeps({ repo }) {
  const repoArgs = repo ? ['--repo', repo] : [];
  return {
    dispatch: async ({ ref }) => {
      execFileSync(
        'gh',
        ['workflow', 'run', WORKFLOW_FILE, '--ref', ref, ...repoArgs],
        { stdio: ['ignore', 'inherit', 'inherit'] },
      );
    },
    findRun: async ({ ref, since }) => {
      const list = ghJson([
        'run', 'list',
        '--workflow', WORKFLOW_FILE,
        '--branch', ref,
        '--event', 'workflow_dispatch',
        '--limit', '10',
        '--json', 'databaseId,headSha,status,conclusion,createdAt,url',
        ...repoArgs,
      ]);
      const sinceIso = new Date(since - 60 * 1000).toISOString();
      const fresh = list
        .filter((r) => r.createdAt >= sinceIso)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (!fresh.length) return null;
      const r = fresh[0];
      return {
        id: r.databaseId,
        status: r.status,
        conclusion: r.conclusion,
        head_sha: r.headSha,
        html_url: r.url,
      };
    },
    cancelRun: async ({ id }) => {
      execFileSync('gh', ['run', 'cancel', String(id), ...repoArgs], {
        stdio: ['ignore', 'inherit', 'inherit'],
      });
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * Pós-merge em branch (push): se o resultado foi `stale` ou `cancelled` e o
 * branch JÁ avançou para outro commit, o gate do commit mais novo cobre este —
 * vira `superseded` (exit 0). Nunca converte falha real de teste. Pura.
 */
function applySuperseded(result, { expectSha, currentHeadSha }) {
  const supersedable = result.verdict === 'stale' ||
    (result.verdict === 'fail' && result.reason === 'conclusion=cancelled');
  if (!supersedable || !expectSha || !currentHeadSha || currentHeadSha === expectSha) {
    return result;
  }
  return {
    ...result,
    verdict: 'superseded',
    exitCode: EXIT.PASS,
    reason: `${result.reason}; branch avançou para ${currentHeadSha} — o gate desse commit cobre este`,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--ref') args.ref = argv[++i];
    else if (k === '--expect-sha') args.expectSha = argv[++i];
    else if (k === '--timeout-min') args.timeoutMs = Number(argv[++i]) * 60000;
    else if (k === '--allow-superseded') args.allowSuperseded = true;
    else throw new Error(`argumento desconhecido: ${k}`);
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`e2e-gate: ${err.message}`);
    return EXIT.USAGE;
  }
  if (!args.ref) {
    console.error('e2e-gate: uso: node scripts/ci/e2e-gate.js --ref <branch> [--expect-sha <sha>]');
    return EXIT.USAGE;
  }
  const repo = process.env.GITHUB_REPOSITORY || undefined;
  const deps = realDeps({ repo });
  let currentRun = null;
  // Gate cancelado (PR atualizado => concurrency cancel-in-progress): cancela
  // também o E2E disparado, senão ele segue ocupando a fila de emuladores.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      const done = () => process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
      if (currentRun && currentRun.id != null && currentRun.status !== 'completed') {
        deps.cancelRun(currentRun).then(done, done);
      } else {
        done();
      }
    });
  }
  let result = await runGate({
    ref: args.ref,
    expectSha: args.expectSha,
    timeoutMs: args.timeoutMs,
    ...deps,
    onRun: (run) => { currentRun = run; },
  });
  if (args.allowSuperseded) {
    let currentHeadSha = null;
    try {
      currentHeadSha = execFileSync('gh', ['api', `repos/${repo}/commits/${args.ref}`, '--jq', '.sha'],
          { encoding: 'utf8' }).trim();
    } catch (err) {
      console.error(`e2e-gate: não consegui ler o head de ${args.ref}: ${err.message}`);
    }
    result = applySuperseded(result, { expectSha: args.expectSha, currentHeadSha });
  }
  console.log(JSON.stringify({ gate: 'E2E Gate', ...result }));
  return result.exitCode;
}

if (require.main === module) {
  main().then(
    (code) => { process.exitCode = code; },
    (err) => { console.error(`e2e-gate: erro ${err && err.message}`); process.exitCode = EXIT.FAIL; },
  );
}

module.exports = { EXIT, evaluateRun, runGate, parseArgs, applySuperseded };
