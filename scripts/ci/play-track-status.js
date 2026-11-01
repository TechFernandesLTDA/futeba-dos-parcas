#!/usr/bin/env node
'use strict';

/**
 * Consulta SOMENTE LEITURA das trilhas do Google Play (Play Developer API).
 *
 * Abre um edit temporário, lista as trilhas (`edits.tracks.list`) e descarta o
 * edit (`edits.delete`) — nada é commitado, nenhum release é alterado.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=sa.json \
 *     node scripts/ci/play-track-status.js --package com.futebadosparcas \
 *       [--track internal] [--version-code 81]
 *
 * Saída: resumo por trilha (nome do release, status, versionCodes). Com
 * `--version-code`, o exit code é 1 se o código não estiver na trilha pedida
 * (ou em nenhuma trilha, se `--track` for omitido).
 *
 * Modo vigia (`--audit`, #4417): além de listar, confere se a release de
 * produção está de fato na loja e mantém UMA issue aberta enquanto não estiver.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=sa.json GITHUB_TOKEN=... \
 *     node scripts/ci/play-track-status.js --audit --github-repo dono/repo
 *
 * Por que heurística: a Play Developer API (androidpublisher v3) NÃO expõe o
 * status da revisão nem o Status da política. `TrackRelease.status` só tem
 * draft/inProgress/halted/completed, e nenhum método lê recusas. O vigia então
 * cruza duas coisas que a API e a web mostram: há release de produção gravada
 * (inProgress/completed/halted) E a página pública da loja responde 404. Isso
 * cobre "em análise", "recusada" e "aprovada esperando o clique em Publicar"
 * (publicação gerenciada). Não cobre recusa de ATUALIZAÇÃO depois que o app
 * estiver público (a página volta 200): para isso, as notificações por e-mail
 * do Play Console (ver docs/production-launch/monitoring-rollback-runbook.md).
 */

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const GITHUB_API = 'https://api.github.com';

/** Título fixo: é a chave de deduplicação da issue do vigia. */
const WATCHDOG_ISSUE_TITLE = 'Play: release de produção gravada, mas o app não está publicado na loja';
const WATCHDOG_MARKER = '<!-- play-track-status:watchdog -->';
const WATCHDOG_LABELS = ['area:release', 'area:android', 'priority:high'];
/** Intervalo mínimo entre lembretes na mesma issue. */
const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const args = { package: 'com.futebadosparcas', track: '', versionCode: '', audit: false, githubRepo: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--package') { args.package = value; i += 1; }
    else if (key === '--track') { args.track = value; i += 1; }
    else if (key === '--version-code') { args.versionCode = value; i += 1; }
    else if (key === '--audit') { args.audit = true; }
    else if (key === '--github-repo') { args.githubRepo = value; i += 1; }
    else throw new Error(`Argumento desconhecido: ${key}`);
  }
  return args;
}

/**
 * Avalia o estado da produção (função pura).
 * @param {Array<{track: string, releases?: Array<{name?: string, status?: string, versionCodes?: string[], userFraction?: number}>}>} tracks
 * @param {number|null} storeHttpStatus status HTTP da página pública (null = falha de rede)
 * @returns {{alert: boolean, state: 'published'|'not_published'|'no_production_release'|'unknown', releases: Array<object>, reasons: string[]}}
 */
function evaluatePlayAudit(tracks, storeHttpStatus) {
  const production = (tracks || []).find((t) => t.track === 'production');
  const releases = ((production && production.releases) || [])
    .filter((r) => ['inProgress', 'completed', 'halted'].includes(r.status))
    .map((r) => ({
      name: r.name || '(sem nome)',
      status: r.status,
      versionCodes: (r.versionCodes || []).map(String),
      userFraction: r.userFraction,
    }));
  const reasons = [];
  if (releases.length === 0) {
    return { alert: false, state: 'no_production_release', releases, reasons };
  }
  for (const r of releases.filter((x) => x.status === 'halted')) {
    reasons.push(`release ${r.name} está com o lançamento interrompido (halted)`);
  }
  if (storeHttpStatus === 404) {
    reasons.unshift('a página pública da loja responde 404: a release de produção não está publicada');
    return { alert: true, state: 'not_published', releases, reasons };
  }
  // `halted` é decisão humana (interromper o rollout): vai para o log, mas só a
  // loja fora do ar abre issue, para o título da issue ser sempre verdadeiro.
  if (storeHttpStatus === 200) {
    return { alert: false, state: 'published', releases, reasons };
  }
  // Rede ou status inesperado: não abre alarme com base na loja.
  return { alert: false, state: 'unknown', releases, reasons };
}

/**
 * Decide o que fazer com a issue do vigia (função pura).
 * @param {{alert: boolean, state: string}} audit
 * @param {{number: number, updated_at: string}|null} openIssue
 * @param {Date} now
 * @returns {'create'|'remind'|'close'|'none'}
 */
function decideIssueAction(audit, openIssue, now) {
  if (audit.alert && !openIssue) return 'create';
  if (audit.alert && openIssue) {
    const age = now.getTime() - new Date(openIssue.updated_at).getTime();
    return age >= REMINDER_INTERVAL_MS ? 'remind' : 'none';
  }
  // Só fecha com evidência positiva (loja 200 ou sem release de produção);
  // falha de rede ('unknown') mantém a issue aberta.
  if (!audit.alert && openIssue && audit.state !== 'unknown') return 'close';
  return 'none';
}

function describeReleases(releases) {
  return releases
    .map((r) => {
      const fraction = typeof r.userFraction === 'number' ? `, ${Math.round(r.userFraction * 100)}%` : '';
      return `- \`${r.name}\`: ${r.status}${fraction}, versionCodes ${r.versionCodes.join(', ') || '-'}`;
    })
    .join('\n');
}

/** Corpo da issue (texto fixo + estado observado). */
function buildIssueBody(audit, { packageName, storeUrl, runUrl, now }) {
  return [
    WATCHDOG_MARKER,
    `Vigia diário da Play (\`play-track-status.yml\`, #4417), ${now.toISOString().slice(0, 10)}.`,
    '',
    '**O que foi visto**',
    ...audit.reasons.map((r) => `- ${r}`),
    '',
    `Release de produção gravada para \`${packageName}\`:`,
    describeReleases(audit.releases),
    '',
    `Página pública: ${storeUrl}`,
    runUrl ? `Execução: ${runUrl}` : '',
    '',
    '**Por que não dá para saber o motivo daqui**',
    'A Play Developer API não expõe o status da revisão nem o Status da política. Uma release gravada e fora da loja pode estar:',
    '1. em análise (o Google fala em até 7 dias);',
    '2. **recusada** (o motivo só aparece em Play Console → Status da política);',
    '3. aprovada e parada em "Alterações prontas para publicação", porque a publicação gerenciada está ligada e ninguém clicou em **Publicar**.',
    '',
    '**O que fazer**',
    '- [ ] Play Console → Visão geral da publicação: ver se há mudanças em análise ou prontas para publicar.',
    '- [ ] Play Console → Status da política: ver se há recusa e o motivo.',
    '- [ ] Se recusada, corrigir e reenviar (procedimento em `docs/production-launch/monitoring-rollback-runbook.md`, seção "Recusa da Play").',
    '',
    'Esta issue fecha sozinha quando a página da loja passar a responder 200. Enquanto isso, o vigia comenta aqui a cada 7 dias.',
  ].filter((line) => line !== null).join('\n');
}

async function githubRequest(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${url} -> HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? {} : res.json();
}

async function findOpenWatchdogIssue(token, repo) {
  const url = `${GITHUB_API}/repos/${repo}/issues?state=open&labels=${encodeURIComponent('area:release')}&per_page=100`;
  const issues = await githubRequest(token, 'GET', url);
  return issues.find((i) => !i.pull_request && i.title === WATCHDOG_ISSUE_TITLE) || null;
}

async function syncWatchdogIssue(audit, ctx) {
  const { token, repo, now } = ctx;
  const openIssue = await findOpenWatchdogIssue(token, repo);
  const action = decideIssueAction(audit, openIssue, now);
  const body = buildIssueBody(audit, ctx);
  if (action === 'create') {
    const created = await githubRequest(token, 'POST', `${GITHUB_API}/repos/${repo}/issues`, {
      title: WATCHDOG_ISSUE_TITLE, body, labels: WATCHDOG_LABELS,
    });
    console.log(`Issue aberta: ${created.html_url}`);
  } else if (action === 'remind') {
    await githubRequest(token, 'POST', `${GITHUB_API}/repos/${repo}/issues/${openIssue.number}/comments`, {
      body: `Lembrete: o app continua fora da loja.\n\n${body}`,
    });
    console.log(`Lembrete na issue #${openIssue.number}`);
  } else if (action === 'close') {
    await githubRequest(token, 'POST', `${GITHUB_API}/repos/${repo}/issues/${openIssue.number}/comments`, {
      body: `A página da loja respondeu 200 em ${now.toISOString().slice(0, 10)} (estado: ${audit.state}). Fechando.`,
    });
    await githubRequest(token, 'PATCH', `${GITHUB_API}/repos/${repo}/issues/${openIssue.number}`, {
      state: 'closed', state_reason: 'completed',
    });
    console.log(`Issue #${openIssue.number} fechada`);
  } else {
    console.log(`Issue: nada a fazer${openIssue ? ` (#${openIssue.number} lembrada há menos de 7 dias)` : ''}`);
  }
  return action;
}

/** Status HTTP da página pública (null em falha de rede). */
async function fetchStoreStatus(storeUrl) {
  try {
    const res = await fetch(storeUrl, { method: 'GET', redirect: 'follow' });
    return res.status;
  } catch (err) {
    console.error(`Falha ao consultar a loja: ${err.message}`);
    return null;
  }
}

/**
 * Procura um versionCode nas trilhas retornadas pela API.
 * @param {Array<{track: string, releases?: Array<{name?: string, status?: string, versionCodes?: string[]}>}>} tracks
 * @param {number|string} versionCode
 * @param {string} [onlyTrack] restringe a busca a uma trilha
 * @returns {Array<{track: string, status: string, name: string}>}
 */
function findVersionCode(tracks, versionCode, onlyTrack) {
  const wanted = String(versionCode);
  const hits = [];
  for (const t of tracks || []) {
    if (onlyTrack && t.track !== onlyTrack) continue;
    for (const r of t.releases || []) {
      if ((r.versionCodes || []).map(String).includes(wanted)) {
        hits.push({ track: t.track, status: r.status || '', name: r.name || '' });
      }
    }
  }
  return hits;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Dependência transitiva de firebase-admin (devDependency da raiz, instalada com `npm ci`).
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  const base = `${API}/${encodeURIComponent(args.package)}/edits`;

  const edit = (await client.request({ url: base, method: 'POST', data: {} })).data;
  let tracks = [];
  try {
    tracks = (await client.request({ url: `${base}/${edit.id}/tracks` })).data.tracks || [];
  } finally {
    await client.request({ url: `${base}/${edit.id}`, method: 'DELETE' }).catch(() => {});
  }

  for (const t of tracks) {
    const releases = (t.releases || []).map(
      (r) => `${r.name || '(sem nome)'} [${r.status}] versionCodes=${(r.versionCodes || []).join(',') || '-'}`
    );
    console.log(`track=${t.track}: ${releases.length ? releases.join(' | ') : '(sem releases)'}`);
  }

  if (args.versionCode) {
    const hits = findVersionCode(tracks, args.versionCode, args.track || undefined);
    if (hits.length === 0) {
      console.error(`versionCode ${args.versionCode} NAO encontrado${args.track ? ` na trilha ${args.track}` : ''}`);
      process.exit(1);
    }
    for (const h of hits) console.log(`OK versionCode ${args.versionCode} em ${h.track} (${h.status}) ${h.name}`);
  }

  if (args.audit) {
    const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(args.package)}&hl=pt_BR&gl=BR`;
    const storeStatus = await fetchStoreStatus(storeUrl);
    const audit = evaluatePlayAudit(tracks, storeStatus);
    console.log(`Vigia: loja HTTP ${storeStatus ?? 'erro'}, estado=${audit.state}, alerta=${audit.alert}`);
    for (const r of audit.reasons) console.log(`  - ${r}`);
    if (!args.githubRepo || !process.env.GITHUB_TOKEN) {
      console.log('Sem --github-repo ou GITHUB_TOKEN: não mexo em issue.');
      return;
    }
    const runUrl = process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${args.githubRepo}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : '';
    await syncWatchdogIssue(audit, {
      token: process.env.GITHUB_TOKEN,
      repo: args.githubRepo,
      packageName: args.package,
      storeUrl,
      runUrl,
      now: new Date(),
    });
  }
}

if (require.main === module) {
  main().catch((err) => {
    const detail = err && err.response && err.response.data ? JSON.stringify(err.response.data) : '';
    console.error(`play-track-status falhou: ${err.message} ${detail}`);
    process.exit(2);
  });
}

module.exports = {
  WATCHDOG_ISSUE_TITLE,
  buildIssueBody,
  decideIssueAction,
  evaluatePlayAudit,
  findVersionCode,
  parseArgs,
};
