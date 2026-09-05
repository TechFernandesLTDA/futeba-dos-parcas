'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const job = (workflow, jobId) => {
  const start = workflow.indexOf(`\n  ${jobId}:`);
  const nextMatch = /\n  [A-Za-z0-9_-]+:/.exec(workflow.slice(start + 1));
  const next = nextMatch ? start + 1 + nextMatch.index : -1;
  assert.ok(start >= 0, `${jobId} job must exist`);
  return workflow.slice(start, next >= 0 ? next : undefined);
};

test('workflow contracts do not require brew or rg', () => {
  const workflow = read('.github/workflows/validate-patterns.yml');
  const audit = read('scripts/audit-patterns.sh');
  const secrets = read('scripts/check-secrets.sh');

  assert.doesNotMatch(workflow, /Install ripgrep|brew install ripgrep/);
  assert.match(audit, /portable-search\.sh/);
  assert.match(secrets, /portable-search\.sh/);
});

test('Functions tests install the verified media runtime in the same job', () => {
  const workflow = read('.github/workflows/functions-ci.yml');
  const testJob = workflow.slice(workflow.indexOf('\n  test:\n'));
  assert.match(testJob, /run: npm run install:ffmpeg[\s\S]*?name: Run Tests/);
});

test('Firestore and media runtime gates use hosted Linux', () => {
  const rulesWorkflow = read('.github/workflows/firestore-rules-ci.yml');
  const functionsWorkflow = read('.github/workflows/functions-ci.yml');
  const hostedSelector = 'runs-on: ubuntu-latest';
  const selfHostedSelector = /runs-on: \$\{\{ fromJSON\(vars\.RUNNER_LABELS/;

  assert.match(job(rulesWorkflow, 'rules-tests'), new RegExp(hostedSelector));
  assert.match(job(functionsWorkflow, 'firestore-query-perf'), new RegExp(hostedSelector));
  const mediaJob = job(functionsWorkflow, 'media-runtime-linux');
  assert.match(mediaJob, new RegExp(hostedSelector));
  assert.match(mediaJob, /docker run --rm --platform linux\/amd64/);
  assert.match(mediaJob, /node:22-bookworm@sha256:[a-f0-9]{64}/);
  assert.match(mediaJob, /test\/group-wall-media-ffmpeg\.test\.ts/);
  assert.match(job(functionsWorkflow, 'test'), new RegExp(hostedSelector));
  for (const jobId of ['build', 'lint', 'mutation']) {
    assert.match(job(functionsWorkflow, jobId), selfHostedSelector, `${jobId} must remain self-hosted`);
  }
});

test('Android PR validation uses hosted Linux and validates SDK 36', () => {
  const workflow = read('.github/workflows/pr-check.yml');
  const androidJobStart = workflow.indexOf('\n  android:\n');
  const validateJobStart = workflow.indexOf('\n  validate:\n');
  const androidJob = workflow.slice(androidJobStart, validateJobStart);

  assert.ok(androidJobStart >= 0, 'Android validation job must exist');
  assert.ok(validateJobStart > androidJobStart, 'Android job must precede validate');
  assert.match(androidJob, /runs-on: ubuntu-latest/);
  assert.match(androidJob, /uses: android-actions\/setup-android@v3/);
  assert.match(androidJob, /sdkmanager --install[\s\S]*platforms;android-36/);
  assert.match(androidJob, /platforms\/android-36\/android\.jar/);
  assert.doesNotMatch(androidJob, /unzip|apt-get install|sudo/);
});

test('Lighthouse selects a Linux browser explicitly', () => {
  const workflow = read('.github/workflows/web-lighthouse-ci.yml');
  const lighthouseConfig = read('web/.lighthouserc.cjs');
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /CHROME_PATH=.*chromium\.executablePath/);
  assert.match(workflow, /LHCI passes --no-sandbox/);
  assert.match(lighthouseConfig, /chromeFlags: \['--no-sandbox'\]/);
});

test('Functions integration polling allows slow emulator triggers', () => {
  const integrationTest = read(
    'functions/test/integration/invite-redeemed.integration.test.ts'
  );
  assert.match(integrationTest, /INTEGRATION_POLL_TIMEOUT_MS = 60_000/);
  assert.doesNotMatch(integrationTest, /pollUntil[\s\S]*\b(?:30000|45000)\b/);
});
