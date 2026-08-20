'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

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

test('Android PR validation bootstraps and validates SDK 36', () => {
  const workflow = read('.github/workflows/pr-check.yml');
  assert.match(workflow, /uses: android-actions\/setup-android@v3/);
  assert.match(workflow, /sdkmanager --install[\s\S]*platforms;android-36/);
  assert.match(workflow, /platforms\/android-36\/android\.jar/);
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
