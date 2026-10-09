'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, buildTrackBody } = require('./play-promote');

test('rollout gradual gera inProgress com userFraction', () => {
  const body = buildTrackBody({ track: 'production', versionCode: 81, userFraction: '0.2', name: '1.40.0' });
  assert.deepEqual(body, {
    track: 'production',
    releases: [{ versionCodes: ['81'], status: 'inProgress', userFraction: 0.2, name: '1.40.0' }],
  });
});

test('sem userFraction (ou 1) gera completed', () => {
  assert.equal(buildTrackBody({ track: 'beta', versionCode: 81, userFraction: '' }).releases[0].status, 'completed');
  const full = buildTrackBody({ track: 'production', versionCode: 81, userFraction: '1' }).releases[0];
  assert.equal(full.status, 'completed');
  assert.equal(full.userFraction, undefined);
});

test('valida trilha, versionCode e fração', () => {
  assert.throws(() => parseArgs(['--track', 'prod', '--version-code', '81']), /track inválida/);
  assert.throws(() => parseArgs(['--track', 'beta', '--version-code', 'x']), /version-code/);
  assert.throws(() => buildTrackBody({ track: 'beta', versionCode: 81, userFraction: '0' }), /user-fraction/);
  assert.throws(() => buildTrackBody({ track: 'beta', versionCode: 81, userFraction: '1.5' }), /user-fraction/);
});

test('workflow exige confirmação e usa a service account da Play', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'play-promote.yml'), 'utf8');
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /confirm/);
  assert.match(wf, /PLAY_STORE_SERVICE_ACCOUNT_JSON/);
  assert.match(wf, /scripts\/ci\/play-promote\.js/);
  assert.match(wf, /play-track-status\.js/);
});
