'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findVersionCode, parseArgs } = require('./play-track-status');

const tracks = [
  { track: 'internal', releases: [{ name: '81 (1.40.0)', status: 'completed', versionCodes: ['81'] }] },
  { track: 'production', releases: [{ name: '80 (1.39.5)', status: 'completed', versionCodes: ['79', '80'] }] },
  { track: 'beta' },
];

test('findVersionCode encontra o código na trilha certa', () => {
  assert.deepEqual(findVersionCode(tracks, 81), [{ track: 'internal', status: 'completed', name: '81 (1.40.0)' }]);
  assert.equal(findVersionCode(tracks, '80', 'production').length, 1);
});

test('findVersionCode respeita o filtro de trilha e ausência', () => {
  assert.deepEqual(findVersionCode(tracks, 81, 'production'), []);
  assert.deepEqual(findVersionCode(tracks, 999), []);
  assert.deepEqual(findVersionCode(undefined, 1), []);
});

test('parseArgs aplica defaults e rejeita argumento desconhecido', () => {
  assert.equal(parseArgs([]).package, 'com.futebadosparcas');
  assert.equal(parseArgs(['--track', 'internal', '--version-code', '81']).versionCode, '81');
  assert.throws(() => parseArgs(['--x']), /desconhecido/);
});

// ---- Vigia da Play (#4417) ----
const {
  WATCHDOG_ISSUE_TITLE,
  buildIssueBody,
  decideIssueAction,
  evaluatePlayAudit,
} = require('./play-track-status');

// Estado real de 14/10 a 01/11/2026: 1.41.0 a 20% gravada em produção,
// revisão recusada e a página da loja em 404.
const recusada = [
  { track: 'production', releases: [{ name: '82 (1.41.0)', status: 'inProgress', userFraction: 0.2, versionCodes: ['82'] }] },
  { track: 'internal', releases: [{ name: '82 (1.41.0)', status: 'completed', versionCodes: ['82'] }] },
];

test('evaluatePlayAudit alerta quando há produção gravada e a loja responde 404 (caso de 14/10)', () => {
  const audit = evaluatePlayAudit(recusada, 404);
  assert.equal(audit.alert, true);
  assert.equal(audit.state, 'not_published');
  assert.deepEqual(audit.releases.map((r) => r.versionCodes), [['82']]);
});

test('evaluatePlayAudit não alerta com a loja publicada, sem produção ou com falha de rede', () => {
  assert.equal(evaluatePlayAudit(recusada, 200).alert, false);
  assert.equal(evaluatePlayAudit(recusada, null).state, 'unknown');
  assert.equal(evaluatePlayAudit(recusada, null).alert, false);
  assert.equal(evaluatePlayAudit(tracks.filter((t) => t.track !== 'production'), 404).state, 'no_production_release');
  const soDraft = [{ track: 'production', releases: [{ name: 'x', status: 'draft', versionCodes: ['1'] }] }];
  assert.equal(evaluatePlayAudit(soDraft, 404).alert, false);
});

test('evaluatePlayAudit registra rollout interrompido sem abrir issue de loja', () => {
  const halted = [{ track: 'production', releases: [{ name: '80', status: 'halted', versionCodes: ['80'] }] }];
  const audit = evaluatePlayAudit(halted, 200);
  assert.equal(audit.alert, false);
  assert.match(audit.reasons.join(' '), /interrompido/);
});

test('decideIssueAction: abre, lembra a cada 7 dias, fecha só com evidência', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const alerta = { alert: true, state: 'not_published' };
  assert.equal(decideIssueAction(alerta, null, now), 'create');
  assert.equal(decideIssueAction(alerta, { number: 1, updated_at: '2026-10-20T12:00:00Z' }, now), 'none');
  assert.equal(decideIssueAction(alerta, { number: 1, updated_at: '2026-10-14T12:00:00Z' }, now), 'remind');
  const issue = { number: 1, updated_at: '2026-10-20T12:00:00Z' };
  assert.equal(decideIssueAction({ alert: false, state: 'published' }, issue, now), 'close');
  assert.equal(decideIssueAction({ alert: false, state: 'unknown' }, issue, now), 'none');
  assert.equal(decideIssueAction({ alert: false, state: 'published' }, null, now), 'none');
});

test('buildIssueBody aponta Status da política e o botão Publicar', () => {
  const body = buildIssueBody(evaluatePlayAudit(recusada, 404), {
    packageName: 'com.futebadosparcas',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.futebadosparcas',
    runUrl: '',
    now: new Date('2026-10-14T12:00:00Z'),
  });
  assert.match(body, /Status da política/);
  assert.match(body, /Publicar/);
  assert.match(body, /82 \(1\.41\.0\)`: inProgress, 20%/);
  assert.ok(WATCHDOG_ISSUE_TITLE.length > 20);
});

test('closeComment explica o motivo do fechamento', () => {
  const { closeComment } = require('./play-track-status');
  const now = new Date('2026-11-05T12:00:00Z');
  assert.match(closeComment({ state: 'published' }, now), /respondeu 200/);
  assert.match(closeComment({ state: 'no_production_release' }, now), /não há mais release/);
});

test('parseArgs aceita o modo vigia', () => {
  const args = parseArgs(['--audit', '--github-repo', 'dono/repo']);
  assert.equal(args.audit, true);
  assert.equal(args.githubRepo, 'dono/repo');
});
