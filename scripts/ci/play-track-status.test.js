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
