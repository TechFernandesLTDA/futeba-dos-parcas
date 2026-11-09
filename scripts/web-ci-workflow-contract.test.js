'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runsOnRegExp, selfHostedRunsOn } = require('./ci/runner-selector');
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
const settings = fs.readFileSync(
  path.join(repoRoot, '.github/settings.yml'),
  'utf8'
);
const shardPlanner = fs.readFileSync(
  path.join(repoRoot, 'scripts/ci/vitest-shard-plan.js'),
  'utf8'
);
const shardRunner = fs.readFileSync(
  path.join(repoRoot, 'scripts/ci/run-vitest-shard.js'),
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

function extractNamedStep(jobId, job, stepName) {
  const marker = `      - name: ${stepName}\n`;
  const stepIndex = job.indexOf(marker);
  assert.notEqual(stepIndex, -1, `${jobId} must contain step ${stepName}`);
  const nextStepIndex = job.indexOf('\n      - name:', stepIndex + marker.length);
  return nextStepIndex === -1
    ? job.slice(stepIndex)
    : job.slice(stepIndex, nextStepIndex);
}

function assertSelfHostedRunner(jobId, job) {
  const runnerLine = job
    .split('\n')
    .find((line) => line.trimStart().startsWith('runs-on:'));

  assert.equal(
    runnerLine?.trim(),
    selfHostedRunsOn('RUNNER_LABELS_LINUX'),
    `${jobId} must use the repository runner selector`
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
    'actions/setup-node@v6'
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
    'scripts/ci/vitest-shard-plan.js',
    'scripts/ci/run-vitest-shard.js',
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
  assert.match(shards, /name: Typecheck tests\n\s+if: matrix\.run_quality\n\s+run: npm run typecheck:test/);
  assert.match(shards, /name: TypeScript and production build\n\s+if: matrix\.run_quality\n\s+run: npm run build/);
  assert.match(
    shards,
    /node \.\.\/scripts\/ci\/run-vitest-shard\.js\s+\$\{\{ matrix\.shard_index \}\}\s+\$\{\{ matrix\.shard_total \}\}\s+reports\/vitest\/shard-\$\{\{ matrix\.shard_index \}\}-of-\$\{\{ matrix\.shard_total \}\}\.json/
  );
  assert.doesNotMatch(
    shards,
    /--(?:shard|retry|exclude|passWithNoTests|changed|related|project|testNamePattern)(?:[=\s]|$)/
  );
  assert.match(
    shards,
    /name: Verify Vitest shard coverage[\s\S]*?node \.\.\/scripts\/ci\/verify-vitest-shards\.js[\s\S]*?reports\/vitest\/shard-\$\{\{ matrix\.shard_index \}\}-of-\$\{\{ matrix\.shard_total \}\}\.json[\s\S]*?\$\{\{ matrix\.shard_index \}\}[\s\S]*?\$\{\{ matrix\.shard_total \}\}/
  );
  assert.doesNotMatch(shards, /actions\/(?:upload|download)-artifact/);

  assert.equal(
    countMatches(shards, /npm ci --legacy-peer-deps/g),
    1,
    'one matrix install command across two shards must yield exactly two npm ci executions'
  );
  assertNodeJobContract('web_shards', shards);
  assertSelfHostedRunner('web_shards', shards);

  assert.match(gate, /name: Web CI Gate/);
  assert.match(gate, /if: \$\{\{ always\(\) && github\.event_name != 'schedule' \}\}/);
  assert.match(gate, /needs: \[changes, web_shards\]/);
  assert.match(gate, /CHANGE_SCOPE_RESULT: \$\{\{ needs\.changes\.result \}\}/);
  assert.match(gate, /WEB_CHANGED: \$\{\{ needs\.changes\.outputs\.web \}\}/);
  assert.match(gate, /WEB_SHARDS_RESULT: \$\{\{ needs\.web_shards\.result \}\}/);
  assert.match(gate, /\[ "\$CHANGE_SCOPE_RESULT" != "success" \]/);
  assert.match(gate, /\[ "\$WEB_CHANGED" = "true" \]/);
  assert.match(gate, /\[ "\$WEB_SHARDS_RESULT" != "success" \]/);
  assert.match(gate, /\[ "\$WEB_SHARDS_RESULT" != "skipped" \]/);
  assert.doesNotMatch(
    gate,
    /npm ci|actions\/(?:setup-node|checkout|upload-artifact|download-artifact)/
  );
  assertSelfHostedRunner('web_gate', gate);

  assert.doesNotMatch(workflow, /\n  (?:lint|typecheck|test|build):\n/);
  assert.doesNotMatch(workflow, /npx tsc --noEmit/);
});

test('production build remains the TypeScript gate and tests remain Vitest', () => {
  assert.match(webPackage.scripts.build, /typescript\/bin\/tsc/);
  assert.match(webPackage.scripts.build, /vite(?:\.js)? build/);
  assert.match(webPackage.scripts.test, /^vitest run$/);
  assert.match(shardPlanner, /uniqueFiles\.forEach\(\(testFile, index\)/);
  assert.match(shardPlanner, /shards\[index % shardTotal\]\.push\(testFile\)/);
  assert.match(shardRunner, /'--pool=threads'/);
  assert.match(shardRunner, /'--maxWorkers=2'/);
  assert.match(shardRunner, /'--reporter=default'/);
  assert.match(shardRunner, /'--reporter=json'/);
  assert.doesNotMatch(
    shardRunner,
    /--(?:shard|retry|exclude|passWithNoTests|changed|related|project|testNamePattern)/
  );
});

test('mutation testing stays outside PR and preserves its report artifact', () => {
  const mutation = extractJob('mutation');
  const mutationTestStep = extractNamedStep(
    'mutation',
    mutation,
    'Run mutation testing'
  );
  const uploadStep = extractNamedStep(
    'mutation',
    mutation,
    'Upload mutation report'
  );

  assert.match(workflow, /^\s{2}workflow_dispatch:$/m);
  assert.match(workflow, /^\s{2}schedule:$/m);
  // Dispatch comum NÃO roda Stryker: só com run_mutation=true (ou no cron).
  assert.match(workflow, /run_mutation:\n\s+description: .*\n\s+type: boolean\n\s+default: false/);
  assert.match(
    mutation,
    /if: github\.event_name == 'schedule' \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.run_mutation\)/
  );
  // A linha runs-on cita push/pull_request no filtro de evento confiável; o que importa são os gatilhos do job.
  assert.doesNotMatch(mutation.replace(/^\s+runs-on:.*$/m, ''), /pull_request|push/);
  // O threshold continua bloqueando o job de mutation.
  const stryker = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'stryker.conf.json'), 'utf8'));
  assert.equal(stryker.thresholds.break, 60);
  assert.ok(stryker.concurrency <= 4, 'Stryker não pode ocupar todos os núcleos do host compartilhado');
  assertNodeJobContract('mutation', mutation);
  assert.match(mutationTestStep, /run: npm run test:mutation -- --concurrency 2/);
  assert.doesNotMatch(
    mutationTestStep,
    /continue-on-error/,
    'Stryker exit code must remain authoritative'
  );
  assert.match(uploadStep, /if: always\(\)/);
  assert.match(uploadStep, /continue-on-error: true/);
  assert.match(uploadStep, /uses: actions\/upload-artifact@v4/);
  assert.match(uploadStep, /name: mutation-report/);
  assert.match(uploadStep, /path: web\/reports\/mutation\//);
  assert.match(uploadStep, /if-no-files-found: warn/);
  assert.match(uploadStep, /retention-days: 1/);
  assert.match(uploadStep, /compression-level: 9/);
});

test('Lighthouse reads PR metadata with a Linux Chromium runner', () => {
  const lighthouse = extractJob('lighthouse', lighthouseWorkflow);

  assert.match(
    lighthouseWorkflow,
    /^permissions:\n\s+contents: read\n\s+pull-requests: read$/m
  );
  assertNodeJobContract('lighthouse', lighthouse);
  assert.match(lighthouse, runsOnRegExp('RUNNER_LABELS_HEAVY'));
  assert.match(lighthouse, /npx playwright install chromium/);
  assert.doesNotMatch(lighthouse, /--with-deps/);
  assert.match(lighthouse, /CHROME_PATH=.*chromium\.executablePath/);
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
  assert.match(
    settings,
    /required_status_checks:[\s\S]*?contexts:[\s\S]*?\n\s+- Web CI Gate(?:\n|$)/
  );
});
