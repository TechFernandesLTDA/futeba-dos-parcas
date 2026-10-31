'use strict';

// Invariante de segurança do repositório público (#4394): nenhum job chega a um runner próprio
// a partir de um evento que qualquer conta do GitHub consegue disparar.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TRUSTED_EVENT, MAC_IOS_RUNS_ON, selfHostedRunsOn } = require('./runner-selector');

const root = path.resolve(__dirname, '../..');
const workflowsDir = path.join(root, '.github/workflows');
const workflows = fs.readdirSync(workflowsDir).filter((file) => file.endsWith('.yml'));

// Só workflow_dispatch, que exige permissão de escrita no repositório.
const DISPATCH_ONLY = new Set(['ios-testflight.yml']);

const runsOnLines = (file) => fs.readFileSync(path.join(workflowsDir, file), 'utf8')
  .split('\n')
  .filter((line) => line.trimStart().startsWith('runs-on:'))
  .map((line) => line.trim());

test('todo runs-on passa pelo filtro de evento confiável', () => {
  for (const file of workflows) {
    if (DISPATCH_ONLY.has(file)) continue;
    for (const line of runsOnLines(file)) {
      assert.ok(line.includes(TRUSTED_EVENT), `${file}: ${line}`);
    }
  }
});

test('evento não confiável sempre cai no runner hospedado', () => {
  for (const file of workflows) {
    if (DISPATCH_ONLY.has(file)) continue;
    for (const line of runsOnLines(file)) {
      assert.match(line, /\|\| '"(?:ubuntu-24\.04|macos-15)"'\) \}\}$/, `${file}: ${line}`);
    }
  }
});

test('Gradle, docker e deploys com segredo ficam no Mac (RUNNER_LABELS_HEAVY)', () => {
  const heavy = {
    'android-ci.yml': 4, 'android-macrobenchmark.yml': 1, 'deploy-beta.yml': 1,
    'deploy-functions.yml': 1, 'deploy-production.yml': 1, 'play-promote.yml': 1,
    'play-track-status.yml': 1, 'publish-release-notes.yml': 1, 'release.yml': 2,
    'pr-check.yml': 1, 'web-lighthouse-ci.yml': 1, 'functions-ci.yml': 2, 'web-ci.yml': 1,
    'ios-build.yml': 1,
  };
  const expected = selfHostedRunsOn('RUNNER_LABELS_HEAVY');
  for (const [file, count] of Object.entries(heavy)) {
    assert.equal(runsOnLines(file).filter((line) => line === expected).length, count, file);
  }
});

test('jobs iOS do PR usam o Mac próprio só em evento confiável', () => {
  const lines = runsOnLines('ios-build.yml').filter((line) => line.includes('macOS'));
  assert.equal(lines.length, 2);
  for (const line of lines) assert.equal(line, MAC_IOS_RUNS_ON);
});
