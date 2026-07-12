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

function assertHardenedCheckout(jobId, job) {
  const checkoutStep = extractActionStep(
    jobId,
    job,
    'actions/checkout@v4'
  );

  assert.match(checkoutStep, /\n\s+with:/);
  assert.match(
    checkoutStep,
    /\n\s+persist-credentials: false/,
    `${jobId} checkout must not persist Git credentials`
  );
}

function assertNodeJobContract(jobId, job) {
  assertHardenedCheckout(jobId, job);
  const setupNodeStep = extractActionStep(
    jobId,
    job,
    'actions/setup-node@v4'
  );

  assert.match(setupNodeStep, /\n\s+node-version: '22'/);
  assert.match(setupNodeStep, /\n\s+cache: 'npm'/);
  assert.match(setupNodeStep, /\n\s+cache-dependency-path: web\/package-lock\.json/);
}

test('Web CI triggers and permissions include its executable contract', () => {
  assert.match(
    workflow,
    /^  pull_request:\n\s+branches: \[master, develop\]\n\s+types: \[opened, synchronize, reopened\]\n  push:/m,
    'pull requests must always emit the stable Web CI Gate without path filtering'
  );
  for (const script of [
    'scripts/web-ci-workflow-contract.test.js',
    'scripts/ci/verify-vitest-shards.js',
    'scripts/ci/verify-vitest-shards.test.js',
  ]) {
    assert.equal(
      countMatches(workflow, new RegExp(`^\\s+- '${script.replaceAll('/', '\\/').replaceAll('.', '\\.')}'$`, 'gm')),
      1,
      `${script} must trigger push validation; pull requests are intentionally unfiltered`
    );
  }
  assert.match(workflow, /^permissions:\n\s+contents: read$/m);
});

test('Web CI uses two sharded PR lanes with exactly two installs and a stable gate', () => {
  const shards = extractJob('web_shards');
  const gate = extractJob('web_gate');
  const changes = extractJob('changes');
  const jobsSection = workflow.slice(workflow.indexOf('\njobs:\n'));
  const jobIds = [...jobsSection.matchAll(/^  ([a-zA-Z0-9_-]+):$/gm)]
    .map((match) => match[1]);

  assert.deepEqual(jobIds, ['changes', 'web_shards', 'web_gate', 'mutation']);
  assert.match(changes, /if: github\.event_name != 'schedule'/);
  assert.match(changes, /uses: \.\/\.github\/workflows\/change-scope\.yml/);
  assert.match(shards, /name: Web \$\{\{ matrix\.lane \}\}/);
  assert.match(shards, /needs: \[changes\]/);
  assert.match(shards, /if: github\.event_name != 'schedule' && needs\.changes\.outputs\.web == 'true'/);
  assert.match(shards, /fail-fast: false/);
  assert.equal(countMatches(shards, /^\s+- shard_index: [12]$/gm), 2);
  assert.equal(countMatches(shards, /^\s+shard_total: 2$/gm), 2);
  assert.equal(countMatches(shards, /^\s+run_quality: (?:true|false)$/gm), 2);
  assert.match(shards, /name: Run ESLint\n\s+if: matrix\.run_quality\n\s+run: npm run lint/);
  assert.match(shards, /name: TypeScript and production build\n\s+if: matrix\.run_quality\n\s+run: npm run build/);
  assert.match(
    shards,
    /npm test --\s+--pool=threads\s+--maxWorkers=2\s+--shard=\$\{\{ matrix\.shard_index \}\}\/\$\{\{ matrix\.shard_total \}\}\s+--reporter=default\s+--reporter=json\s+--outputFile\.json=reports\/vitest\/shard-\$\{\{ matrix\.shard_index \}\}-of-\$\{\{ matrix\.shard_total \}\}\.json/
  );
  assert.doesNotMatch(
    shards,
    /--(?:retry|exclude|passWithNoTests|changed|related|project|testNamePattern)(?:[=\s]|$)/
  );
  assert.match(shards, /name: Upload Vitest shard report\n\s+if: always\(\)/);
  assert.match(shards, /uses: actions\/upload-artifact@v4/);

  assert.equal(
    countMatches(shards, /npm ci --legacy-peer-deps/g),
    1,
    'one matrix install command across two shards must yield exactly two npm ci executions'
  );
  assertNodeJobContract('web_shards', shards);
  assertEphemeralPrRunner('web_shards', shards);

  assert.match(gate, /name: Web CI Gate/);
  assert.match(gate, /if: \$\{\{ always\(\) && github\.event_name != 'schedule' \}\}/);
  assert.match(gate, /needs: \[changes, web_shards\]/);
  assert.match(gate, /uses: actions\/download-artifact@v4/);
  assert.match(gate, /pattern: web-vitest-shard-\*-of-2/);
  assert.match(gate, /WEB_SHARDS_RESULT: \$\{\{ needs\.web_shards\.result \}\}/);
  assert.match(gate, /node scripts\/ci\/verify-vitest-shards\.js reports\/vitest/);
  assert.match(gate, /name: Accept non-Web change\n\s+if: needs\.changes\.outputs\.web != 'true'/);
  assert.doesNotMatch(gate, /npm ci|actions\/setup-node/);
  assertHardenedCheckout('web_gate', gate);
  assertEphemeralPrRunner('web_gate', gate);

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
    /^\/scripts\/ci\/\s+@TechFernandesLTDA\/dev-team$/m
  );
  assert.match(
    codeowners,
    /^\/scripts\/web-ci-workflow-contract\.test\.js\s+@TechFernandesLTDA\/dev-team$/m
  );
});
