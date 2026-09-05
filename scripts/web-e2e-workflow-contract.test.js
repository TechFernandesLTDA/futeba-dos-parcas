'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const e2eWorkflow = read('.github/workflows/web-e2e-ci.yml');
const harnessWorkflow = read('.github/workflows/test-harness-ci.yml');
const playwrightConfig = read('web/playwright.config.ts');
const emulatorMode = read('web/src/services/firebaseEmulatorMode.ts');
const firebaseServices = [
  'web/src/services/firebase.ts',
  'web/src/services/firebaseFunctions.ts',
  'web/src/services/firebaseStorage.ts',
].map(read);

function extractJob(source, jobId) {
  const marker = `\n  ${jobId}:\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `job ${jobId} must exist`);
  const bodyStart = start + marker.length;
  const nextJob = source.slice(bodyStart).search(/\n  [a-zA-Z0-9_-]+:\n/);
  return nextJob === -1
    ? source.slice(start + 1)
    : source.slice(start + 1, bodyStart + nextJob);
}

function extractStep(job, stepName) {
  const marker = `      - name: ${stepName}\n`;
  const start = job.indexOf(marker);
  assert.notEqual(start, -1, `step ${stepName} must exist`);
  const nextStep = job.indexOf('\n      - name:', start + marker.length);
  return nextStep === -1 ? job.slice(start) : job.slice(start, nextStep);
}

test('Firebase emulator workflows share one non-cancelling concurrency group', () => {
  const concurrencyContract =
    /concurrency:\n  group: firebase-emulator-integration-\$\{\{ github\.repository \}\}\n  cancel-in-progress: false/;

  assert.match(e2eWorkflow, concurrencyContract);
  assert.match(harnessWorkflow, concurrencyContract);
  assert.match(e2eWorkflow, /name: Configurar Node\.js 22[\s\S]*?node-version: "22"/);
  assert.match(harnessWorkflow, /name: Configurar Node\.js 22[\s\S]*?node-version: '22'/);
  assert.doesNotMatch(e2eWorkflow, /pkill\s+-f/);
  assert.doesNotMatch(harnessWorkflow, /pkill\s+-f/);
  assert.match(
    e2eWorkflow,
    /name: Validar contratos dos workflows de emulador\n\s+run: node --test scripts\/ci\/emulator-tools-workflow-contract\.test\.js scripts\/web-e2e-workflow-contract\.test\.js/
  );
  assert.match(
    harnessWorkflow,
    /name: Validar contratos dos workflows de emulador\n\s+run: node --test scripts\/ci\/emulator-tools-workflow-contract\.test\.js scripts\/web-e2e-workflow-contract\.test\.js/
  );
});

test('Playwright has bounded execution and keeps the E2E exit code authoritative', () => {
  const job = extractJob(e2eWorkflow, 'web-e2e');
  const e2eStep = extractStep(job, 'E2E (emulador + seed + Playwright)');
  const uploadStep = extractStep(job, 'Upload — Playwright report');

  assert.match(job, /timeout-minutes: 30/);
  assert.match(e2eStep, /timeout-minutes: 20/);
  assert.match(e2eStep, /npx playwright test --project=chromium/);
  assert.match(e2eStep, /DEBUG: "pw:webserver"/);
  assert.doesNotMatch(e2eStep, /continue-on-error/);
  assert.match(playwrightConfig, /globalTimeout: process\.env\.CI \? 15 \* 60 \* 1000 : 0/);
  assert.match(playwrightConfig, /\['github'\]/);
  assert.match(playwrightConfig, /\['html', \{ outputFolder: 'playwright-report', open: 'never' \}\]/);
  assert.match(uploadStep, /if: always\(\)/);
  assert.match(uploadStep, /continue-on-error: true/);
  assert.match(uploadStep, /if-no-files-found: warn/);
  assert.match(uploadStep, /retention-days: 1/);
  assert.match(uploadStep, /compression-level: 9/);
});

test('optimized E2E preview opts into emulators without weakening production', () => {
  const job = extractJob(e2eWorkflow, 'web-e2e');
  const buildStep = extractStep(job, 'Build web (modo emulador)');

  assert.match(buildStep, /run: npm run build -- --mode e2e/);
  assert.match(emulatorMode, /env\.VITE_USE_EMULATOR === 'true'/);
  assert.match(emulatorMode, /env\.DEV \|\| env\.MODE === 'e2e'/);

  for (const service of firebaseServices) {
    assert.match(
      service,
      /import \{ shouldUseFirebaseEmulators \} from '\.\/firebaseEmulatorMode';/,
    );
    assert.match(service, /if \(shouldUseFirebaseEmulators\)/);
  }
});

test('CI allocates its own preview port without reusing an unrelated server', () => {
  assert.match(e2eWorkflow, /run: node scripts\/ci\/allocate-web-e2e-port\.js/);
  assert.ok(e2eWorkflow.indexOf('allocate-web-e2e-port.js') < e2eWorkflow.indexOf('- name: E2E ('));
  assert.match(playwrightConfig, /process\.env\.E2E_PORT \?\? '5173'/);
  assert.match(playwrightConfig, /url: localBaseURL/);
  assert.match(playwrightConfig, /reuseExistingServer: !process\.env\.CI/);
  assert.match(playwrightConfig, /--port \$\{localPort\} --strictPort/);
});
