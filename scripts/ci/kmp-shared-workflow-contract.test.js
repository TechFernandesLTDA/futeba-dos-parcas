'use strict';

const assert = require('node:assert/strict');
const { runsOnRegExp, MAC_IOS_RUNS_ON } = require('./runner-selector');
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

test('KMP shared unit tests run on the heavy Gradle pool with a complete Android SDK contract', () => {
  const tests = jobBody('kmp-shared-tests');

  assert.match(tests, runsOnRegExp('RUNNER_LABELS_HEAVY'));
  assert.match(tests, /uses: android-actions\/setup-android@v4/);
  assert.match(tests, /sdkmanager "platforms;android-37\.0"/);
  assert.match(tests, /echo "sdk\.dir=\$ANDROID_SDK_ROOT" > local\.properties/);
  assert.match(tests, /\.\/gradlew :shared:testDebugUnitTest/);
});

test('iOS framework and app builds stay pinned to the self-hosted Mac (no hosted macOS minutes)', () => {
  for (const id of ['build-shared-framework', 'build-ios-app']) {
    assert.ok(
      jobBody(id).includes(MAC_IOS_RUNS_ON),
      `${id} must run on the self-hosted futeba Mac`
    );
  }
  assert.doesNotMatch(workflow, /runs-on:\s*['"]?macos-/i, 'hosted macOS runners are 10x billed');

  assert.match(
    jobBody('notify'),
    runsOnRegExp('RUNNER_LABELS_LINUX'),
    'notify must remain on the configurable runner pool'
  );
});
