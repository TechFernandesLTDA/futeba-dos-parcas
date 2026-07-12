#!/usr/bin/env node
'use strict';

/**
 * Coleta métricas de observabilidade do GitHub Actions para um workflow run.
 *
 * Dado o ID de um workflow run (argv[2], env CI_METRICS_RUN_ID, ou o run mais
 * recente caso nenhum seja fornecido), consulta a GitHub API para extrair por
 * job: queue_time (created_at -> started_at), run_time (started_at ->
 * completed_at) e runner (labels). Em seguida calcula:
 *   - Critical path (wall-clock do run + cadeia serial estimada por jobs)
 *   - Tempo de fila p50/p90
 *   - Top 5 jobs mais lentos
 *   - Total de runner-seconds
 *
 * Saídas (sem dados sensíveis):
 *   - Markdown anexo ao GITHUB_STEP_SUMMARY (e em ci-metrics-summary.md)
 *   - JSON em ci-metrics.json (para histórico via artifact)
 *
 * Roda off-critical-path via workflow_run; trata rate limit gracefully
 * (nunca derruba o workflow — é puramente informativo).
 */

const fs = require('node:fs');
const path = require('node:path');

const API_ROOT = 'https://api.github.com';
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;

const REPO_ROOT = path.resolve(__dirname, '../..');
const SUMMARY_FILE = path.join(REPO_ROOT, 'ci-metrics-summary.md');
const JSON_FILE = path.join(REPO_ROOT, 'ci-metrics.json');

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exitSoft(message) {
  // Observabilidade nunca deve quebrar o workflow — loga e sai 0.
  console.warn(`[ci-metrics] ${message}`);
  process.exit(0);
}

function authHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return headers;
}

// Requisição com retry simples para rate limit (403/429) e erros transitórios.
async function ghFetch(resourcePath, { attempt = 0 } = {}) {
  const url = resourcePath.startsWith('http') ? resourcePath : `${API_ROOT}${resourcePath}`;
  let response;
  try {
    response = await fetch(url, { headers: authHeaders() });
  } catch (networkError) {
    if (attempt < 2) return retryAfter(resourcePath, attempt, networkError);
    throw new Error(`falha de rede em ${resourcePath}: ${networkError.message}`);
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetAt = response.headers.get('x-ratelimit-reset');
    if (remaining === '0') {
      const when = resetAt ? new Date(Number(resetAt) * 1000).toISOString() : 'desconhecido';
      exitSoft(`rate limit da GitHub API atingido (reset em ${when}); abortando coleta.`);
    }
    if (attempt < 2) return retryAfter(resourcePath, attempt, new Error(`HTTP ${response.status}`));
    exitSoft(`GitHub API respondeu ${response.status} repetidamente; abortando coleta.`);
  }

  if (response.status === 404) {
    exitSoft(`recurso não encontrado: ${resourcePath}`);
  }

  if (!response.ok) {
    if (attempt < 2) return retryAfter(resourcePath, attempt, new Error(`HTTP ${response.status}`));
    const body = await response.text().catch(() => '');
    throw new Error(`GitHub API ${response.status} em ${resourcePath}: ${body.slice(0, 200)}`);
  }

  // next link para paginação.
  const linkHeader = response.headers.get('link') || '';
  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  const json = await response.json();
  return { json, next: nextMatch ? nextMatch[1] : null };
}

function retryAfter(resourcePath, attempt, cause) {
  const waitMs = 1500 * Math.pow(2, attempt); // 1.5s, 3s
  console.warn(`[ci-metrics] ${cause.message}; tentando novamente em ${waitMs}ms`);
  return new Promise((resolve) => {
    setTimeout(() => resolve(ghFetch(resourcePath, { attempt: attempt + 1 })), waitMs);
  });
}

async function fetchRun(runId) {
  invariant(REPO, 'GITHUB_REPOSITORY não definido (formato esperado: owner/repo).');
  const { json } = await ghFetch(`/repos/${REPO}/actions/runs/${runId}`);
  return json;
}

async function fetchMostRecentRun() {
  invariant(REPO, 'GITHUB_REPOSITORY não definido (formato esperado: owner/repo).');
  const { json } = await ghFetch(
    `/repos/${REPO}/actions/runs?per_page=1&status=completed`
  );
  const run = json.workflow_runs?.[0];
  if (!run) exitSoft('nenhum workflow run concluído encontrado para coletar métricas.');
  return run;
}

async function fetchAllJobs(runId) {
  const jobs = [];
  let url = `/repos/${REPO}/actions/runs/${runId}/jobs?per_page=100`;
  let pages = 0;
  while (url && pages < 10) {
    const { json, next } = await ghFetch(url);
    jobs.push(...(json.jobs || []));
    url = next;
    pages += 1;
  }
  return jobs;
}

function toEpochSeconds(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function durationSeconds(startIso, endIso) {
  const start = toEpochSeconds(startIso);
  const end = toEpochSeconds(endIso);
  if (start === null || end === null) return null;
  return Math.max(0, end - start);
}

// Percentil nearest-rank (1-indexed).
function percentile(sortedAsc, percent) {
  if (sortedAsc.length === 0) return null;
  const rank = Math.ceil((percent / 100) * sortedAsc.length);
  const index = Math.min(Math.max(rank - 1, 0), sortedAsc.length - 1);
  return sortedAsc[index];
}

function summarizeJob(job) {
  const queueTime = durationSeconds(job.created_at, job.started_at);
  const runTime = durationSeconds(job.started_at, job.completed_at);
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    runner: Array.isArray(job.labels) ? job.labels : [],
    runnerGroup: job.runner_group_id ?? null,
    queueTime,
    runTime,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

// Cadeia serial estimada: maior sequência de jobs não-sobrepostos ordenados por
// início. Proxy para o gargalo serial do run quando a API não expõe o `needs`.
function longestSerialChain(jobSummaries) {
  const eligible = jobSummaries.filter(
    (j) => j.runTime !== null && j.startedAt && j.completedAt
  );
  if (eligible.length === 0) return { length: 0, wallClock: 0, names: [] };

  const sorted = [...eligible].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)
  );

  const starts = sorted.map((j) => Date.parse(j.startedAt));
  const ends = sorted.map((j) => Date.parse(j.completedAt));
  const dp = new Array(sorted.length).fill(1);
  const prev = new Array(sorted.length).fill(-1);

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (ends[j] <= starts[i] && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1;
        prev[i] = j;
      }
    }
  }

  let best = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    if (dp[i] > dp[best]) best = i;
  }

  const chain = [];
  let cursor = best;
  while (cursor !== -1) {
    chain.unshift(sorted[cursor]);
    cursor = prev[cursor];
  }

  const chainStart = Date.parse(chain[0].startedAt);
  const chainEnd = Date.parse(chain[chain.length - 1].completedAt);
  return {
    length: chain.length,
    wallClock: Math.max(0, Math.floor((chainEnd - chainStart) / 1000)),
    names: chain.map((j) => j.name),
  };
}

function humanize(totalSeconds) {
  if (totalSeconds === null || Number.isNaN(totalSeconds)) return 'n/a';
  const value = Number(totalSeconds);
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}

function buildReport(run, jobSummaries) {
  const criticalPathWallClock = durationSeconds(run.created_at, run.updated_at);
  const serialChain = longestSerialChain(jobSummaries);

  const queueTimes = jobSummaries
    .map((j) => j.queueTime)
    .filter((v) => v !== null)
    .sort((a, b) => a - b);
  const queueP50 = percentile(queueTimes, 50);
  const queueP90 = percentile(queueTimes, 90);

  const slowest = [...jobSummaries]
    .filter((j) => j.runTime !== null)
    .sort((a, b) => b.runTime - a.runTime)
    .slice(0, 5);

  const totalRunnerSeconds = jobSummaries.reduce(
    (sum, j) => sum + (j.runTime || 0),
    0
  );

  return {
    run: {
      id: run.id,
      name: run.name,
      event: run.event,
      branch: run.head_branch,
      sha: run.head_sha?.slice(0, 7) ?? null,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      runStartedAt: run.run_started_at,
    },
    metrics: {
      criticalPathWallClock,
      serialChain,
      queueTime: {
        p50: queueP50,
        p90: queueP90,
        samples: queueTimes.length,
      },
      slowestJobs: slowest,
      totalRunnerSeconds,
      jobCount: jobSummaries.length,
    },
    jobs: jobSummaries,
    collectedAt: new Date().toISOString(),
  };
}

function buildMarkdown(report) {
  const { run, metrics } = report;
  const rows = report.jobs
    .slice()
    .sort((a, b) => (a.queueTime ?? -1) - (b.queueTime ?? -1));

  const jobRows = rows
    .map(
      (j) =>
        `| ${escapeCell(j.name)} | ${humanize(j.queueTime)} | ${humanize(
          j.runTime
        )} | ${j.conclusion ?? j.status ?? '—'} | ${(j.runner || []).join(', ') || '—'} |`
    )
    .join('\n');

  const slowestRows = metrics.slowestJobs
    .map(
      (j) =>
        `| ${escapeCell(j.name)} | ${humanize(j.runTime)} | ${humanize(
          j.queueTime
        )} | ${j.conclusion ?? '—'} |`
    )
    .join('\n');

  return [
    `## 📊 CI Metrics — ${run.name}`,
    '',
    `- **Run:** [#${run.id}](https://github.com/${REPO}/actions/runs/${run.id})`,
    `- **Branch:** \`${run.branch}\`  •  **Commit:** \`${run.sha}\``,
    `- **Event:** \`${run.event}\`  •  **Conclusion:** \`${run.conclusion}\``,
    `- **Jobs:** ${metrics.jobCount}`,
    '',
    '### Orçamento de duração',
    '',
    '| Métrica | Valor |',
    '|---|---|',
    `| Critical path (wall-clock do run) | **${humanize(
      metrics.criticalPathWallClock
    )}** |`,
    `| Cadeia serial estimada | ${humanize(
      metrics.serialChain.wallClock
    )} em ${metrics.serialChain.length} jobs |`,
    `| Tempo de fila p50 | ${humanize(metrics.queueTime.p50)} |`,
    `| Tempo de fila p90 | ${humanize(metrics.queueTime.p90)} |`,
    `| Total runner-seconds | ${humanize(metrics.totalRunnerSeconds)} |`,
    '',
    '### Top 5 jobs mais lentos',
    '',
    '| Job | Run time | Queue time | Resultado |',
    '|---|---|---|---|',
    slowestRows || '| — | — | — | — |',
    '',
    '### Detalhamento por job',
    '',
    '| Job | Queue | Run | Resultado | Runner |',
    '|---|---|---|---|---|',
    jobRows || '| — | — | — | — | — |',
    '',
    '<sub>Métricas coletadas off-critical-path via workflow_run. Sem dados sensíveis.</sub>',
    '',
  ].join('\n');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function writeOutputs(report, markdown) {
  fs.writeFileSync(JSON_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(SUMMARY_FILE, markdown, 'utf8');

  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    fs.appendFileSync(stepSummary, `${markdown}\n`, 'utf8');
  }

  console.log(`[ci-metrics] summary escrito em ${path.relative(REPO_ROOT, SUMMARY_FILE)}`);
  console.log(`[ci-metrics] json escrito em ${path.relative(REPO_ROOT, JSON_FILE)}`);
  console.log(
    `[ci-metrics] critical path wall-clock=${humanize(
      report.metrics.criticalPathWallClock
    )}, fila p50=${humanize(report.metrics.queueTime.p50)}, fila p90=${humanize(
      report.metrics.queueTime.p90
    )}, jobs=${report.metrics.jobCount}`
  );
}

async function resolveRun(runIdArg) {
  const explicit = runIdArg || process.env.CI_METRICS_RUN_ID;
  if (explicit) {
    console.log(`[ci-metrics] coletando métricas para run ${explicit}`);
    return fetchRun(explicit);
  }
  console.log('[ci-metrics] nenhum run_id informado; usando o run concluído mais recente');
  return fetchMostRecentRun();
}

async function main() {
  const run = await resolveRun(process.argv[2]);
  invariant(run && run.id, 'run inválido retornado pela GitHub API.');

  const rawJobs = await fetchAllJobs(run.id);
  const jobSummaries = rawJobs.map(summarizeJob);

  const report = buildReport(run, jobSummaries);
  const markdown = buildMarkdown(report);
  writeOutputs(report, markdown);
}

if (require.main === module) {
  main().catch((error) => {
    // Observabilidade é best-effort: nunca propagamos falha para o workflow.
    exitSoft(`coleta falhou: ${error.message}`);
  });
}

module.exports = {
  buildReport,
  buildMarkdown,
  durationSeconds,
  longestSerialChain,
  percentile,
  summarizeJob,
};
