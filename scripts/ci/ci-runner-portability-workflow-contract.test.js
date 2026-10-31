'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runsOnRegExp, MAC_IOS_RUNS_ON } = require('./runner-selector');
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

test('Firestore and media runtime gates use the configured runner pools', () => {
  const rulesWorkflow = read('.github/workflows/firestore-rules-ci.yml');
  const functionsWorkflow = read('.github/workflows/functions-ci.yml');
  // Jobs que sobem emuladores vão para o runner dedicado (futeba-emulators, Mac): portas fixas
  // 127.0.0.1:9099/8085. O job de mídia usa docker, que só o Mac tem (o runner da prod-01 não
  // pertence ao grupo docker), por isso fica em RUNNER_LABELS_HEAVY.
  const emulatorSelector = runsOnRegExp('RUNNER_LABELS_EMULATORS', 'RUNNER_LABELS_LINUX');

  assert.match(job(rulesWorkflow, 'rules-tests'), emulatorSelector);
  assert.match(job(functionsWorkflow, 'firestore-query-perf'), emulatorSelector);
  const mediaJob = job(functionsWorkflow, 'media-runtime-linux');
  assert.match(mediaJob, runsOnRegExp('RUNNER_LABELS_HEAVY'));
  assert.match(mediaJob, /docker run --rm --platform linux\/amd64/);
  assert.match(mediaJob, /node:22-bookworm@sha256:[a-f0-9]{64}/);
  assert.match(mediaJob, /test\/group-wall-media-ffmpeg\.test\.ts/);
  for (const jobId of ['test', 'build', 'lint']) {
    assert.match(job(functionsWorkflow, jobId), runsOnRegExp('RUNNER_LABELS_LINUX'), jobId);
  }
  assert.match(job(functionsWorkflow, 'mutation'), runsOnRegExp('RUNNER_LABELS_HEAVY'));
});

test('Android PR validation uses Linux runner and validates SDK 37', () => {
  const workflow = read('.github/workflows/pr-check.yml');
  const androidJobStart = workflow.indexOf('\n  android:\n');
  const validateJobStart = workflow.indexOf('\n  validate:\n');
  const androidJob = workflow.slice(androidJobStart, validateJobStart);

  assert.ok(androidJobStart >= 0, 'Android validation job must exist');
  assert.ok(validateJobStart > androidJobStart, 'Android job must precede validate');
  assert.match(androidJob, runsOnRegExp('RUNNER_LABELS_HEAVY'));
  assert.match(androidJob, /uses: android-actions\/setup-android@v4/);
  assert.match(androidJob, /sdkmanager --install[\s\S]*platforms;android-37\.0/);
  assert.match(androidJob, /platforms\/android-37\.0\/android\.jar/);
  assert.doesNotMatch(androidJob, /unzip|apt-get install|sudo/);
});

test('Lighthouse selects a Linux browser explicitly', () => {
  const workflow = read('.github/workflows/web-lighthouse-ci.yml');
  const lighthouseConfig = read('web/.lighthouserc.cjs');
  assert.match(workflow, runsOnRegExp('RUNNER_LABELS_HEAVY'));
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

test('Heavy emulator, browser and Android jobs run on the self-hosted Mac pools', () => {
  const emulators = runsOnRegExp('RUNNER_LABELS_EMULATORS', 'RUNNER_LABELS_LINUX');
  const heavyPool = runsOnRegExp('RUNNER_LABELS_HEAVY');
  const heavy = {
    'web-e2e-ci.yml': [['web-e2e', emulators]],
    'web-lighthouse-ci.yml': [['lighthouse', heavyPool]],
    'functions-integration-ci.yml': [['functions-integration', emulators]],
    'realtime-load-ci.yml': [['realtime-load', emulators]],
    'test-harness-ci.yml': [['test-harness', emulators]],
    'android-ci.yml': [['lint', heavyPool], ['detekt', heavyPool], ['test', heavyPool], ['build', heavyPool],
      ['gate', runsOnRegExp('RUNNER_LABELS_LINUX')]],
  };
  for (const [file, jobs] of Object.entries(heavy)) {
    const workflow = read(`.github/workflows/${file}`);
    for (const [jobId, selector] of jobs) {
      assert.match(job(workflow, jobId), selector, `${file}:${jobId} must use its runner pool`);
      assert.doesNotMatch(job(workflow, jobId), /runs-on: ubuntu-/, `${file}:${jobId} must not use hosted minutes`);
    }
  }
});

test('Android CI on Linux provisions the SDK instead of relying on a Mac install', () => {
  const workflow = read('.github/workflows/android-ci.yml');
  for (const jobId of ['lint', 'detekt', 'test', 'build']) {
    const body = job(workflow, jobId);
    assert.match(body, /uses: android-actions\/setup-android@v4/, jobId);
    assert.match(body, /platforms;android-37\.0/, jobId);
    assert.ok(
      body.indexOf('setup-android') < body.indexOf('sdk.dir='),
      `${jobId} must install the SDK before writing local.properties`
    );
  }
});

test('Sem runner macOS: macrobenchmark manual no Linux (x86_64) e iOS só com IOS_MAC_RUNNER', () => {
  const macro = read('.github/workflows/android-macrobenchmark.yml');
  assert.match(job(macro, 'macrobenchmark'), runsOnRegExp('RUNNER_LABELS_HEAVY'));
  assert.match(macro, /arch: x86_64/);
  assert.doesNotMatch(macro, /\n  push:/, 'macrobenchmark não roda em push (emulador pesado no pool compartilhado)');
  const ios = read('.github/workflows/ios-build.yml');
  assert.ok(ios.includes(MAC_IOS_RUNS_ON));
  assert.match(job(ios, 'build-shared-framework'), /if: vars\.IOS_MAC_RUNNER == 'true'/);
  assert.match(job(ios, 'build-ios-app'), /if: vars\.IOS_MAC_RUNNER == 'true' && /);
  assert.match(job(read('.github/workflows/ios-testflight.yml'), 'diagnose'), /if: vars\.IOS_MAC_RUNNER == 'true'/);
});

test('E2E Gate polling jobs use the light futeba-poller runners, never hosted minutes', () => {
  const gate = read('.github/workflows/e2e-gate.yml');
  for (const jobId of ['e2e-gate', 'post-merge-issue']) {
    assert.match(job(gate, jobId), runsOnRegExp('RUNNER_LABELS_POLLER', 'RUNNER_LABELS_LINUX'), jobId);
    assert.doesNotMatch(job(gate, jobId), /runs-on: ubuntu-/, jobId);
  }
});

test('Emulator jobs on the shared WSL host serialize through the dedicated emulator runner', () => {
  // Um único runner (label futeba-emulators) serializa os jobs de emulador.
  // O grupo global antigo cancelava runs pendentes de OUTROS refs (fila de 1).
  const emu = runsOnRegExp('RUNNER_LABELS_EMULATORS', 'RUNNER_LABELS_LINUX');
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
