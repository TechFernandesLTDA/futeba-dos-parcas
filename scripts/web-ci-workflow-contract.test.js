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
const lighthouseWorkflow = fs.readFileSync(
  path.join(repoRoot, '.github/workflows/web-lighthouse-ci.yml'),
  'utf8'
);
const codeowners = fs.readFileSync(
  path.join(repoRoot, '.github/CODEOWNERS'),
  'utf8'
);
const webPackage = require(path.join(repoRoot, 'web/package.json'));

function extractJob(jobId, source = workflow) {
  const marker = `\n  ${jobId}:\n`;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `job ${jobId} must exist`);

  const start = markerIndex + 1;
  const remaining = source.slice(start + marker.length - 1);
  const nextJob = remaining.search(/\n  [a-zA-Z0-9_-]+:\n/);
  return nextJob === -1
    ? source.slice(start)
    : source.slice(start, start + marker.length - 1 + nextJob);
}

function countMatches(value, pattern) {
  return (value.match(pattern) ?? []).length;
}

function extractActionStep(jobId, job, action) {
  const actionIndex = job.indexOf(`uses: ${action}`);
  assert.notEqual(actionIndex, -1, `${jobId} must use ${action}`);
  const nextStepIndex = job.indexOf('\n      - name:', actionIndex);
  return nextStepIndex === -1
    ? job.slice(actionIndex)
    : job.slice(actionIndex, nextStepIndex);
}

function assertEphemeralPrRunner(jobId, job) {
  const runnerLine = job
    .split('\n')
    .find((line) => line.trimStart().startsWith('runs-on:'));

  assert.equal(
    runnerLine?.trim(),
    "runs-on: ${{ fromJSON(github.event_name == 'pull_request' && '[\"ubuntu-latest\"]' || (vars.RUNNER_LABELS || '[\"self-hosted\",\"macOS\",\"ARM64\"]')) }}",
    `${jobId} must isolate PR code from persistent self-hosted runners`
  );
}

function assertNodeJobContract(jobId, job) {
  const checkoutStep = extractActionStep(
    jobId,
    job,
    'actions/checkout@v4'
  );
  const setupNodeStep = extractActionStep(
    jobId,
    job,
    'actions/setup-node@v4'
  );

  assert.match(checkoutStep, /\n\s+with:/);
  assert.match(
    checkoutStep,
    /\n\s+persist-credentials: false/,
    `${jobId} checkout must not persist Git credentials`
  );
  assert.match(setupNodeStep, /\n\s+node-version: '22'/);
  assert.match(setupNodeStep, /\n\s+cache: 'npm'/);
  assert.match(setupNodeStep, /\n\s+cache-dependency-path: web\/package-lock\.json/);
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
  assert.match(tests, /run: npm test -- --maxWorkers=2/);
  assert.doesNotMatch(tests, /--(?:retry|shard|exclude|passWithNoTests)/);

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
  assertEphemeralPrRunner('web-quality', quality);
  assertEphemeralPrRunner('web-tests', tests);
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

test('Lighthouse reads PR metadata on an ephemeral runner with hardened checkout', () => {
  const lighthouse = extractJob('lighthouse', lighthouseWorkflow);

  assert.match(
    lighthouseWorkflow,
    /^permissions:\n\s+contents: read\n\s+pull-requests: read$/m
  );
  assertNodeJobContract('lighthouse', lighthouse);
  assertEphemeralPrRunner('lighthouse', lighthouse);
  assert.match(lighthouseWorkflow, /github\.rest\.pulls\.listFiles/);
  assert.match(
    lighthouseWorkflow,
    /isWebRelevantPath\(file\.filename\) \|\|\n\s+isWebRelevantPath\(file\.previous_filename\)/
  );
  assert.match(
    lighthouseWorkflow,
    /run: node --test \.\.\/scripts\/web-ci-workflow-contract\.test\.js/
  );
});

test('the executable CI contract requires code owner review', () => {
  assert.match(
    codeowners,
    /^\/scripts\/web-ci-workflow-contract\.test\.js\s+@TechFernandesLTDA\/dev-team$/m
  );
});
