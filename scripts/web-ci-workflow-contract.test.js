'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(
  path.join(repoRoot, '.github/workflows/web-ci.yml'),
  'utf8'
);
const webPackage = require(path.join(repoRoot, 'web/package.json'));

function extractJob(jobId) {
  const marker = `\n  ${jobId}:\n`;
  const markerIndex = workflow.indexOf(marker);
  assert.notEqual(markerIndex, -1, `job ${jobId} must exist`);

  const start = markerIndex + 1;
  const remaining = workflow.slice(start + marker.length - 1);
  const nextJob = remaining.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return nextJob === -1
    ? workflow.slice(start)
    : workflow.slice(start, start + marker.length - 1 + nextJob);
}

function countMatches(value, pattern) {
  return (value.match(pattern) ?? []).length;
}

function assertNodeJobContract(jobId, job) {
  assert.match(
    job,
    /uses: actions\/checkout@v4\n\s+with:\n\s+persist-credentials: false/,
    `${jobId} checkout must not persist Git credentials`
  );
  assert.match(
    job,
    /uses: actions\/setup-node@v4\n\s+with:\n\s+node-version: '22'\n\s+cache: 'npm'\n\s+cache-dependency-path: web\/package-lock\.json/,
    `${jobId} must preserve Node 22 and the npm lockfile cache`
  );
}

test('Web CI triggers and permissions include its executable contract', () => {
  assert.equal(
    countMatches(
      workflow,
      /^\s+- 'scripts\/web-ci-workflow-contract\.test\.js'$/gm
    ),
    2,
    'pull_request and push must both run when the contract changes'
  );
  assert.match(workflow, /^permissions:\n\s+contents: read$/m);
});

test('Web CI uses two attributable PR jobs with one install each', () => {
  const quality = extractJob('web-quality');
  const tests = extractJob('web-tests');
  const jobsSection = workflow.slice(workflow.indexOf('\njobs:\n'));
  const jobIds = [...jobsSection.matchAll(/^  ([a-zA-Z0-9_-]+):$/gm)]
    .map((match) => match[1]);

  assert.deepEqual(jobIds, ['web-quality', 'web-tests', 'mutation']);
  assert.match(quality, /name: Web Quality/);
  assert.match(quality, /if: github\.event_name != 'schedule'/);
  assert.match(quality, /npm run lint/);
  assert.match(quality, /npm run build/);
  assert.match(tests, /name: Web Tests/);
  assert.match(tests, /if: github\.event_name != 'schedule'/);
  assert.match(tests, /npm test/);

  assert.equal(
    countMatches(quality, /npm ci --legacy-peer-deps/g),
    1,
    'web-quality must have exactly one npm ci install'
  );
  assert.equal(
    countMatches(tests, /npm ci --legacy-peer-deps/g),
    1,
    'web-tests must have exactly one npm ci install'
  );
  assertNodeJobContract('web-quality', quality);
  assertNodeJobContract('web-tests', tests);
  assert.doesNotMatch(workflow, /\n  (?:lint|typecheck|test|build):\n/);
  assert.doesNotMatch(workflow, /npx tsc --noEmit/);
});

test('production build remains the TypeScript gate and tests remain Vitest', () => {
  assert.match(webPackage.scripts.build, /typescript\/bin\/tsc/);
  assert.match(webPackage.scripts.build, /vite(?:\.js)? build/);
  assert.match(webPackage.scripts.test, /^vitest run$/);
});

test('mutation testing stays outside PR and preserves its report artifact', () => {
  const mutation = extractJob('mutation');

  assert.match(workflow, /^\s{2}workflow_dispatch:$/m);
  assert.match(workflow, /^\s{2}schedule:$/m);
  assert.match(
    mutation,
    /if: github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/
  );
  assertNodeJobContract('mutation', mutation);
  assert.match(mutation, /npm run test:mutation/);
  assert.match(mutation, /uses: actions\/upload-artifact@v4/);
  assert.match(mutation, /name: mutation-report/);
  assert.match(mutation, /path: web\/reports\/mutation\//);
});
