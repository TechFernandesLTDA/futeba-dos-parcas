'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const androidWorkflow = read('.github/workflows/android-ci.yml');
const prWorkflow = read('.github/workflows/pr-check.yml');
const classifierWorkflow = read('.github/workflows/change-scope.yml');

function jobBody(workflow, id) {
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const match = jobs.match(new RegExp(`(?:^|\\n)  ${id}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9_-]*:\\n|$)`));
  assert.ok(match, `job '${id}' must exist`);
  return match[1];
}

test('Android CI always emits stable checks and preserves cancellation semantics', () => {
  assert.doesNotMatch(androidWorkflow, /paths-ignore:/);
  assert.match(androidWorkflow, /pull_request:\s*\n\s*branches: \[ master, develop \]\s*\n\s*types: \[opened, synchronize, reopened\]/);
  assert.match(androidWorkflow, /cancel-in-progress: true/);
  assert.match(androidWorkflow, /uses: \.\/\.github\/workflows\/change-scope\.yml/);
  assert.match(jobBody(androidWorkflow, 'gate'), /name: Android CI Gate/);
  assert.match(jobBody(androidWorkflow, 'gate'), /if: always\(\)/);
});

test('Android heavy jobs are conditioned by the checked-in classifier', () => {
  for (const id of ['lint', 'detekt', 'test', 'build']) {
    assert.match(
      jobBody(androidWorkflow, id),
      /needs\.changes\.outputs\.android == 'true'/,
      `${id} must require Android impact`
    );
  }

  assert.match(jobBody(androidWorkflow, 'lint'), /\.\/gradlew .* lint/);
  assert.match(jobBody(androidWorkflow, 'build'), /\.\/gradlew .* assembleDebug/);
  assert.match(jobBody(prWorkflow, 'android'), /\.\/gradlew .* detekt/);
  assert.match(jobBody(prWorkflow, 'android'), /\.\/gradlew .* :app:testDebugUnitTest/);
});

test('PR Check keeps Validate PR stable while moving Gradle to a scoped job', () => {
  assert.doesNotMatch(prWorkflow, /paths-ignore:/);
  assert.match(prWorkflow, /types: \[opened, synchronize, reopened\]/);
  assert.match(prWorkflow, /cancel-in-progress: true/);
  assert.match(jobBody(prWorkflow, 'android'), /needs\.changes\.outputs\.android == 'true'/);
  assert.match(jobBody(prWorkflow, 'validate'), /name: Validate PR/);
  assert.match(jobBody(prWorkflow, 'validate'), /if: always\(\)/);
  assert.doesNotMatch(jobBody(prWorkflow, 'validate'), /gradlew|setup-gradle/i);
});

test('reusable classifier exports every versioned domain and manual runs remain full', () => {
  assert.match(classifierWorkflow, /workflow_call:/);
  for (const output of ['web', 'functions', 'android', 'ios', 'rules', 'shared_config']) {
    assert.match(classifierWorkflow, new RegExp(`^      ${output}:`, 'm'));
  }
  assert.match(classifierWorkflow, /node scripts\/ci\/classify-changes\.js/);

  const script = read('scripts/ci/classify-changes.js');
  assert.match(script, /eventName === 'workflow_dispatch'/);
  assert.match(script, /forceAll: true/);
});
