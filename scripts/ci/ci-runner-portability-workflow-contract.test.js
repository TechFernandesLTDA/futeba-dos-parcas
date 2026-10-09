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
  const hostedSelector = 'runs-on: ubuntu-24.04';
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
  assert.match(androidJob, /runs-on: ubuntu-24.04/);
  assert.match(androidJob, /uses: android-actions\/setup-android@v3/);
  assert.match(androidJob, /sdkmanager --install[\s\S]*platforms;android-36/);
  assert.match(androidJob, /platforms\/android-36\/android\.jar/);
  assert.doesNotMatch(androidJob, /unzip|apt-get install|sudo/);
});

test('Lighthouse selects a Linux browser explicitly', () => {
  const workflow = read('.github/workflows/web-lighthouse-ci.yml');
  const lighthouseConfig = read('web/.lighthouserc.cjs');
  assert.match(workflow, /runs-on: \$\{\{ fromJSON\(vars\.RUNNER_LABELS_LINUX \|\| vars\.RUNNER_LABELS \|\| '\[\"self-hosted\",\"macOS\",\"ARM64\"\]'\) \}\}/);
  assert.match(workflow, /playwright install chromium/);
  assert.doesNotMatch(workflow, /--with-deps/);
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

test('Heavy emulator, browser and Android jobs run on the Linux WSL runners', () => {
  const linux = new RegExp(String.raw`runs-on: \$\{\{ fromJSON\((vars\.RUNNER_LABELS_EMULATORS \|\| )?vars\.RUNNER_LABELS_LINUX \|\| vars\.RUNNER_LABELS \|\| '\[\"self-hosted\",\"macOS\",\"ARM64\"\]'\) \}\}`);
  const heavy = {
    'web-e2e-ci.yml': ['web-e2e'],
    'web-lighthouse-ci.yml': ['lighthouse'],
    'functions-integration-ci.yml': ['functions-integration'],
    'realtime-load-ci.yml': ['realtime-load'],
    'test-harness-ci.yml': ['test-harness'],
    'android-ci.yml': ['lint', 'detekt', 'test', 'build', 'gate'],
    'e2e-gate.yml': ['e2e-gate', 'post-merge-issue'],
  };
  for (const [file, jobs] of Object.entries(heavy)) {
    const workflow = read(`.github/workflows/${file}`);
    for (const jobId of jobs) {
      assert.match(job(workflow, jobId), linux, `${file}:${jobId} must use RUNNER_LABELS_LINUX`);
      assert.doesNotMatch(job(workflow, jobId), /runs-on: ubuntu-/, `${file}:${jobId} must not use hosted minutes`);
    }
  }
});

test('Android CI on Linux provisions the SDK instead of relying on a Mac install', () => {
  const workflow = read('.github/workflows/android-ci.yml');
  for (const jobId of ['lint', 'detekt', 'test', 'build']) {
    const body = job(workflow, jobId);
    assert.match(body, /uses: android-actions\/setup-android@v3/, jobId);
    assert.match(body, /platforms;android-36/, jobId);
    assert.ok(
      body.indexOf('setup-android') < body.indexOf('sdk.dir='),
      `${jobId} must install the SDK before writing local.properties`
    );
  }
});

test('Xcode and the arm64 macrobenchmark stay on the Mac runner', () => {
  const macro = read('.github/workflows/android-macrobenchmark.yml');
  assert.match(job(macro, 'macrobenchmark'), new RegExp(String.raw`runs-on: \$\{\{ fromJSON\(vars\.RUNNER_LABELS \|\| '\[\"self-hosted\",\"macOS\",\"ARM64\"\]'\) \}\}`));
  assert.match(macro, /arch: arm64-v8a/);
  const ios = read('.github/workflows/ios-build.yml');
  assert.match(ios, /runs-on: \[self-hosted, macOS, ARM64, futeba\]/);
});

test('Emulator jobs on the shared WSL host serialize through the dedicated emulator runner', () => {
  // Um único runner (label futeba-emulators) serializa os jobs de emulador.
  // O grupo global antigo cancelava runs pendentes de OUTROS refs (fila de 1).
  const emu = /runs-on: \$\{\{ fromJSON\(vars\.RUNNER_LABELS_EMULATORS \|\| /;
  for (const [file, jobId] of [['web-e2e-ci.yml', 'web-e2e'], ['test-harness-ci.yml', 'test-harness'],
    ['functions-integration-ci.yml', 'functions-integration'], ['realtime-load-ci.yml', 'realtime-load']]) {
    assert.match(job(read(`.github/workflows/${file}`), jobId), emu, `${file}:${jobId}`);
  }
  const perRef = /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\n\s+cancel-in-progress: false/;
  assert.match(read('.github/workflows/web-e2e-ci.yml'), perRef);
  assert.match(read('.github/workflows/test-harness-ci.yml'), perRef);
  for (const file of ['web-e2e-ci.yml', 'test-harness-ci.yml', 'functions-integration-ci.yml', 'realtime-load-ci.yml']) {
    assert.doesNotMatch(read(`.github/workflows/${file}`), /firebase-emulator-integration/, file);
  }
});

test('Mutation testing never runs on PR/push or plain dispatch', () => {
  for (const file of ['web-ci.yml', 'functions-ci.yml']) {
    const workflow = read(`.github/workflows/${file}`);
    assert.match(workflow, /run_mutation:\n\s+description: .*\n\s+type: boolean\n\s+default: false/, file);
    assert.match(
      job(workflow, 'mutation'),
      /if: github\.event_name == 'schedule' \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.run_mutation\)/,
      file
    );
  }
  const web = JSON.parse(read('web/stryker.conf.json'));
  const functions = JSON.parse(read('functions/stryker.conf.json'));
  assert.equal(web.thresholds.break, 60, 'web mutation threshold must keep blocking');
  assert.ok(web.concurrency <= 4 && functions.concurrency <= 4);
});
