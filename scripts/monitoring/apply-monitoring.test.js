'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  desiredPolicy,
  loadConfig,
  parseArgs,
  planMetrics,
  planPolicies,
  unmanaged,
  validateConfig,
} = require('./apply-monitoring');

test('os arquivos versionados em monitoring/ passam na validação', () => {
  const config = loadConfig();
  assert.deepEqual(validateConfig(config), []);
  assert.ok(config.policies.length >= 12);
});

test('toda política gerenciada recebe o canal do manifesto', () => {
  const config = loadConfig();
  for (const { body } of config.policies) {
    const final = desiredPolicy(body, config.manifest.notificationChannels);
    assert.ok(final.notificationChannels.length > 0, body.displayName);
  }
});

test('a política de push token, que estava sem canal em produção, é gerenciada', () => {
  const config = loadConfig();
  assert.ok(config.manifest.alertPolicies.includes('push-token-registry-canonical-lookup-alert.json'));
});

test('validateConfig acusa log-match sem limite de notificação e métrica ausente', () => {
  const errors = validateConfig({
    manifest: { project: 'p', notificationChannels: ['c'], alertPolicies: ['a.json'], logMetrics: [] },
    metrics: [],
    topLevelJson: ['a.json', 'solto.json'],
    policies: [{
      file: 'a.json',
      body: {
        displayName: 'A',
        documentation: { content: 'x' },
        notificationChannels: ['c'],
        conditions: [
          { displayName: 'c1', conditionMatchedLog: { filter: 'severity>=ERROR' } },
          { displayName: 'c2', conditionThreshold: { filter: 'metric.type="logging.googleapis.com/user/nao_existe"' } },
        ],
      },
    }],
  });
  const joined = errors.join('\n');
  assert.match(joined, /solto\.json: não está/);
  assert.match(joined, /não declare notificationChannels/);
  assert.match(joined, /uma única condition/);
  assert.match(joined, /notificationRateLimit/);
  assert.match(joined, /nao_existe/);
});

test('validateConfig exige canal no manifesto', () => {
  const errors = validateConfig({
    manifest: { project: 'p', notificationChannels: [] },
    metrics: [], policies: [], topLevelJson: [],
  });
  assert.match(errors.join('\n'), /notificationChannels vazio/);
});

test('planPolicies casa por displayName e ignora campos gerados pelo servidor', () => {
  const body = {
    displayName: 'A',
    combiner: 'OR',
    documentation: { content: 'x', mimeType: 'text/markdown' },
    conditions: [{ displayName: 'c', conditionMatchedLog: { filter: 'f' } }],
    enabled: true,
    notificationChannels: ['ch'],
  };
  const remoteSame = {
    ...body,
    name: 'projects/p/alertPolicies/1',
    conditions: [{ ...body.conditions[0], name: 'projects/p/alertPolicies/1/conditions/9' }],
    creationRecord: { mutateTime: 't' },
  };
  assert.equal(planPolicies([{ file: 'a', body }], [remoteSame])[0].action, 'unchanged');

  const remoteSemCanal = { ...remoteSame, notificationChannels: undefined };
  const upd = planPolicies([{ file: 'a', body }], [remoteSemCanal])[0];
  assert.equal(upd.action, 'update');
  assert.equal(upd.remoteName, 'projects/p/alertPolicies/1');

  assert.equal(planPolicies([{ file: 'a', body }], [])[0].action, 'create');
  assert.equal(planPolicies([{ file: 'a', body }], [remoteSame, remoteSame])[0].action, 'conflict');
});

test('planMetrics compara filtro e descrição', () => {
  const body = { name: 'm', description: 'd', filter: 'f', metricDescriptor: { metricKind: 'DELTA' } };
  assert.equal(planMetrics([{ file: 'm.json', body }], [{ ...body, createTime: 'x' }])[0].action, 'unchanged');
  assert.equal(planMetrics([{ file: 'm.json', body }], [{ ...body, filter: 'g' }])[0].action, 'update');
  assert.equal(planMetrics([{ file: 'm.json', body }], [])[0].action, 'create');
});

test('unmanaged lista o que existe remoto e não está no manifesto', () => {
  const config = { policies: [{ body: { displayName: 'A' } }], metrics: [{ body: { name: 'm' } }] };
  assert.deepEqual(
    unmanaged([{ displayName: 'A' }, { displayName: 'Manual' }], [{ name: 'm' }, { name: 'x' }], config),
    { policies: ['Manual'], metrics: ['x'] },
  );
});

test('parseArgs: dry-run por padrão', () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs(['--apply']).apply, true);
  assert.deepEqual(parseArgs(['--channel', 'a', '--channel', 'b']).channels, ['a', 'b']);
  assert.throws(() => parseArgs(['--force']), /desconhecido/);
});
