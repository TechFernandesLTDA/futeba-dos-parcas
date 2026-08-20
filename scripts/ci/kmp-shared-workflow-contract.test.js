'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');
const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ios-build.yml'), 'utf8');

function jobBody(id) {
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const match = jobs.match(new RegExp(`(?:^|\\n)  ${id}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9_-]*:\\n|$)`));
  assert.ok(match, `job '${id}' must exist`);
  return match[1];
}

test('KMP shared unit tests use hosted Linux with a complete Android SDK contract', () => {
  const tests = jobBody('kmp-shared-tests');

  assert.match(tests, /runs-on: ubuntu-latest/);
  assert.match(tests, /uses: android-actions\/setup-android@v3/);
  assert.match(tests, /sdkmanager "platforms;android-36"/);
  assert.match(tests, /echo "sdk\.dir=\$ANDROID_SDK_ROOT" > local\.properties/);
  assert.match(tests, /\.\/gradlew :shared:testDebugUnitTest/);
});

test('iOS build jobs remain on the configurable macOS runner pool', () => {
  for (const id of ['build-shared-framework', 'build-ios-app', 'notify']) {
    assert.match(
      jobBody(id),
      /runs-on: \$\{\{ fromJSON\(vars\.RUNNER_LABELS \|\| '\["self-hosted","macOS","ARM64"\]'\) \}\}/,
      `${id} must remain on the macOS runner pool`
    );
  }
});
