'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const androidWorkflow = read('.github/workflows/android-ci.yml');
const prWorkflow = read('.github/workflows/pr-check.yml');
const classifierWorkflow = read('.github/workflows/change-scope.yml');
const iosWorkflow = read('.github/workflows/ios-build.yml');
const iosDetector = read('scripts/ci/detect-ios-app-changes.js');
const codeowners = read('.github/CODEOWNERS');
const settings = read('.github/settings.yml');

function jobBody(workflow, id) {
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const match = jobs.match(new RegExp(`(?:^|\\n)  ${id}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9_-]*:\\n|$)`));
  assert.ok(match, `job '${id}' must exist`);
  return match[1];
}

test('Android CI always emits stable checks and preserves cancellation semantics', () => {
  assert.doesNotMatch(androidWorkflow, /paths-ignore:/);
  assert.match(androidWorkflow, /pull_request:\s*\n\s*branches: \[ master, develop \]\s*\n\s*types: \[opened, synchronize, reopened\]/);
  assert.match(androidWorkflow, /cancel-in-progress: true/);
  assert.match(androidWorkflow, /uses: \.\/\.github\/workflows\/change-scope\.yml/);
  assert.match(jobBody(androidWorkflow, 'gate'), /name: Android CI Gate/);
  assert.match(jobBody(androidWorkflow, 'gate'), /if: always\(\)/);
});

test('Android heavy jobs run only for trusted scoped events', () => {
  for (const id of ['lint', 'detekt', 'test', 'build']) {
    const body = jobBody(androidWorkflow, id);
    assert.match(
      body,
      /needs\.changes\.outputs\.android == 'true'/,
      `${id} must require Android impact`
    );
    assert.match(
      body,
      /github\.event_name != 'pull_request'/,
      `${id} must skip untrusted pull request code`
    );
    assert.match(body, /fromJSON\(vars\.RUNNER_LABELS/);
  }

  assert.match(jobBody(androidWorkflow, 'lint'), /\.\/gradlew .* lint/);
  assert.match(jobBody(androidWorkflow, 'build'), /\.\/gradlew .* assembleDebug/);
  assert.match(jobBody(prWorkflow, 'android'), /\.\/gradlew .* compileDebugKotlin/);
  assert.match(jobBody(prWorkflow, 'android'), /\.\/gradlew .* detekt/);
  assert.match(jobBody(prWorkflow, 'android'), /\.\/gradlew .* :app:testDebugUnitTest/);
});

test('PR code uses read-only checkout credentials and hosted Android tooling', () => {
  assert.match(androidWorkflow, /permissions:\s*\n\s*contents: read/);
  assert.match(prWorkflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(prWorkflow, /\b(?:checks|security-events|contents): write\b/);

  for (const [name, workflow] of [
    ['Android CI', androidWorkflow],
    ['PR Check', prWorkflow],
    ['Change Scope', classifierWorkflow],
  ]) {
    const checkouts = (workflow.match(/uses: actions\/checkout@v4/g) ?? []).length;
    const nonPersistent = (workflow.match(/persist-credentials: false/g) ?? []).length;
    assert.equal(nonPersistent, checkouts, `${name} must not persist checkout credentials`);
  }

  assert.match(jobBody(prWorkflow, 'android'), /runs-on: ubuntu-24.04/);
  assert.doesNotMatch(jobBody(prWorkflow, 'android'), /Ensure unzip|apt-get|sudo/);
  assert.match(codeowners, /^\/scripts\/ci\/ @TechFernandesLTDA\/dev-team$/m);
  assert.match(codeowners, /^\/scripts\/web-ci-workflow-contract\.test\.js @TechFernandesLTDA\/dev-team$/m);
});

test('trusted Detekt alone can publish SARIF without weakening PR permissions', () => {
  const detekt = jobBody(androidWorkflow, 'detekt');
  assert.match(detekt, /github\.event_name != 'pull_request'/);
  assert.match(detekt, /permissions:\s*\n\s*contents: read\s*\n\s*security-events: write/);
  assert.equal(
    (androidWorkflow.match(/security-events: write/g) ?? []).length,
    1,
    'security-events write must remain exclusive to the trusted Detekt job'
  );
  assert.match(
    detekt,
    /name: Upload Detekt SARIF to GitHub Security[\s\S]*?uses: github\/codeql-action\/upload-sarif@[\s\S]*?continue-on-error: true/
  );
  assert.match(
    detekt,
    /name: Upload Detekt Report[\s\S]*?continue-on-error: true[\s\S]*?name: detekt-report[\s\S]*?retention-days: 7/
  );
  assert.doesNotMatch(jobBody(androidWorkflow, 'gate'), /\b(?:checks|security-events|contents): write\b/);
});

test('Android CI Gate requires explicit PR skips and complete trusted jobs', () => {
  const gate = jobBody(androidWorkflow, 'gate');
  assert.match(gate, /\[ "\$EVENT_NAME" = "pull_request" \]/);
  for (const result of ['LINT_RESULT', 'DETEKT_RESULT', 'TEST_RESULT', 'BUILD_RESULT']) {
    assert.match(gate, new RegExp(`\\[ "\\$${result}" != "skipped" \\]`));
    assert.match(gate, new RegExp(`\\[ "\\$${result}" != "success" \\]`));
  }
  assert.match(gate, /delegated to the required Validate PR check/);
});

test('PR Check keeps Validate PR stable while moving Gradle to a scoped job', () => {
  const validate = jobBody(prWorkflow, 'validate');
  assert.doesNotMatch(prWorkflow, /paths-ignore:/);
  assert.match(prWorkflow, /types: \[opened, synchronize, reopened\]/);
  assert.match(prWorkflow, /cancel-in-progress: true/);
  assert.match(jobBody(prWorkflow, 'android'), /needs\.changes\.outputs\.android == 'true'/);
  assert.match(validate, /name: Validate PR/);
  assert.match(validate, /if: always\(\)/);
  assert.match(validate, /\[ "\$ANDROID_CHANGED" = "true" \] && \[ "\$ANDROID_RESULT" != "success" \]/);
  assert.doesNotMatch(validate, /gradlew|setup-gradle/i);
});

test('PR Check keeps Android SDK validation and the placeholder on the hosted job', () => {
  const android = jobBody(prWorkflow, 'android');
  assert.match(android, /uses: android-actions\/setup-android@v3/);
  assert.match(android, /sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;36\.0\.0"/);
  assert.match(android, /test -f "\$\{ANDROID_SDK_ROOT:-\$\{ANDROID_HOME:-\}\}\/platforms\/android-36\/android\.jar"/);
  assert.match(android, /name: Create google-services\.json placeholder/);
});

test('declarative branch protection keeps stable gates and the single-owner review policy', () => {
  const requiredChecks = settings.match(/required_status_checks:[\s\S]*?contexts:\n((?:\s+- .+\n)+)/);
  assert.ok(requiredChecks, 'required status checks must be declared');
  assert.deepEqual(
    requiredChecks[1].trim().split('\n').map((line) => line.replace(/^\s*-\s+/, '')),
    ['Lighthouse CI', 'Validate PR', 'Android CI Gate', 'Web CI Gate']
  );
  assert.match(settings, /required_approving_review_count: 0/);
  assert.match(settings, /dismiss_stale_reviews: false/);
  assert.match(settings, /require_code_owner_reviews: false/);
});

test('reusable classifier exports every versioned domain and manual runs remain full', () => {
  assert.match(classifierWorkflow, /workflow_call:/);
  for (const output of ['web', 'functions', 'android', 'ios', 'ios_app', 'rules', 'shared_config']) {
    assert.match(classifierWorkflow, new RegExp(`^      ${output}:`, 'm'));
  }
  assert.match(classifierWorkflow, /node scripts\/ci\/classify-changes\.js/);

  const script = read('scripts/ci/classify-changes.js');
  assert.match(script, /eventName === 'workflow_dispatch'/);
  assert.match(script, /forceAll: true/);
});

test('iOS app build consumes the narrow classifier contract', () => {
  const iosAppJob = jobBody(iosWorkflow, 'build-ios-app');
  assert.match(iosWorkflow, /ios_app_scope:[\s\S]*?runs-on: ubuntu-24.04/);
  assert.match(iosWorkflow, /ios_app_scope:[\s\S]*?should_run: \$\{\{ steps\.detect\.outputs\.should_run \}\}/);
  assert.match(iosAppJob, /needs: \[build-shared-framework, ios_app_scope\]/);
  assert.match(iosAppJob, /if: needs\.ios_app_scope\.outputs\.should_run == 'true'/);
  assert.match(iosAppJob, /runs-on: \[self-hosted, macOS, ARM64\]/);
  assert.doesNotMatch(iosAppJob, /fromJSON\(vars\.RUNNER_LABELS/);
  assert.match(iosAppJob, /Setup Xcode/);
  assert.match(iosDetector, /ios_app_patterns/);
  assert.match(iosDetector, /should_run=/);
  const scopes = read('.github/ci/change-scopes-v1.json');
  assert.match(scopes, /"ios_app_patterns"/);
  assert.match(scopes, /"iosApp\/\*\*"/);
  assert.match(scopes, /"Podfile\.lock"/);
  assert.doesNotMatch(scopes, /"ios_app_patterns"[^\n]*\.github\/workflows\/ios-build\.yml/);
  assert.doesNotMatch(scopes, /"iosApp\/Podfile\.lock",\n\s+"\.github\/workflows\/ios-build\.yml"/);
  assert.doesNotMatch(iosWorkflow, /needs\.changes\.outputs\.ios_app/);
});

test('iOS workflow-only changes are excluded from the app-build contract', () => {
  const scopes = read('.github/ci/change-scopes-v1.json');
  const classifierTests = read('scripts/ci/classify-changes.test.js');

  assert.match(scopes, /"patterns": \["\.github\/workflows\/ios-build\.yml"\][\s\S]*?"scopes": \["ios", "shared_config"\]/);
  assert.match(classifierTests, /changing only the iOS workflow does not activate the iOS app build/);
});
