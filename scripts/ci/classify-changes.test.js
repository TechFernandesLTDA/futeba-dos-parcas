'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  changedFilesFromGit,
  classifyChangedFiles,
  diffRangeFromEvent,
  globToRegExp,
  loadConfig,
  main,
  parseArgs,
  writeGithubOutputs,
} = require('./classify-changes');

const config = loadConfig();

test('glob matcher supports recursive and filename wildcard patterns', () => {
  assert.equal(globToRegExp('web/**').test('web/src/App.tsx'), true);
  assert.equal(globToRegExp('**/*.md').test('README.md'), true);
  assert.equal(globToRegExp('.github/workflows/web-*.yml').test('.github/workflows/web-ci.yml'), true);
  assert.equal(globToRegExp('app/**').test('web/app/file.kt'), false);
});

test('web, Storage Rules and version metadata do not activate Android', () => {
  const result = classifyChangedFiles([
    'web/src/pages/Group/GroupDetailPage.tsx',
    'web/package-lock.json',
    'storage.rules',
    'versions.json',
    'release-notes/web/1.53.2.md',
  ], config);

  assert.deepEqual(result.scopes, {
    web: true,
    functions: false,
    android: false,
    ios: false,
    ios_app: false,
    rules: true,
    shared_config: true,
  });
  assert.deepEqual(result.unknown, []);
});

test('Android, Gradle and KMP shared paths activate Android gates', () => {
  const result = classifyChangedFiles([
    'app/src/main/java/com/futebadosparcas/MainActivity.kt',
    'gradle/libs.versions.toml',
    'shared/src/commonMain/kotlin/User.kt',
  ], config);

  assert.equal(result.scopes.android, true);
  assert.equal(result.scopes.ios, true, 'KMP shared code also impacts iOS');
  assert.equal(result.scopes.ios_app, false, 'KMP shared code does not require the iOS app job');
  assert.equal(result.scopes.shared_config, true);
  assert.equal(result.scopes.web, false);
});

test('design tokens activate every consumer without activating Functions or Rules', () => {
  const result = classifyChangedFiles(['shared/design-tokens.json'], config);
  assert.deepEqual(result.scopes, {
    web: true,
    functions: false,
    android: true,
    ios: true,
    ios_app: false,
    rules: false,
    shared_config: true,
  });
});

test('XP constants activate every runtime consumer before the broad shared rule', () => {
  const xpRuleIndex = config.rules.findIndex((rule) =>
    rule.patterns.includes('shared/xp-constants.json')
  );
  const sharedRuleIndex = config.rules.findIndex((rule) => rule.patterns.includes('shared/**'));
  assert.ok(xpRuleIndex >= 0, 'XP constants need an explicit classifier rule');
  assert.ok(xpRuleIndex < sharedRuleIndex, 'the exact XP rule must precede shared/**');

  const result = classifyChangedFiles(['shared/xp-constants.json'], config);
  assert.deepEqual(result.scopes, {
    web: true,
    functions: true,
    android: true,
    ios: true,
    ios_app: false,
    rules: false,
    shared_config: true,
  });
  assert.deepEqual(result.unknown, []);
});

test('Rules-only paths never activate Android compilation', () => {
  const result = classifyChangedFiles([
    'firestore.rules',
    'firestore-rules-tests/firestore.rules.test.ts',
  ], config);

  assert.equal(result.scopes.rules, true);
  assert.equal(result.scopes.android, false);
  assert.equal(result.scopes.web, false);
});

test('platform lockfiles stay in their owning scope', () => {
  assert.equal(classifyChangedFiles(['web/package-lock.json'], config).scopes.android, false);
  assert.equal(classifyChangedFiles(['functions/package-lock.json'], config).scopes.functions, true);
  assert.equal(classifyChangedFiles(['iosApp/Podfile.lock'], config).scopes.ios, true);
  assert.equal(classifyChangedFiles(['iosApp/Podfile.lock'], config).scopes.ios_app, true);
  assert.equal(classifyChangedFiles(['versions.json'], config).scopes.ios_app, false);
  assert.equal(classifyChangedFiles(['release-notes/android/1.0.0.md'], config).scopes.ios_app, false);
  assert.equal(classifyChangedFiles(['release-notes/web/1.0.0.md'], config).scopes.ios_app, false);
  assert.equal(classifyChangedFiles(['release-notes/functions/1.0.0.md'], config).scopes.ios_app, false);
  assert.equal(classifyChangedFiles(['gradle/dependency-locks/app.lockfile'], config).scopes.android, true);
});

test('workflow changes activate only the relevant gate unless classifier code changes', () => {
  const webWorkflow = classifyChangedFiles(['.github/workflows/web-ci.yml'], config);
  assert.equal(webWorkflow.scopes.web, true);
  assert.equal(webWorkflow.scopes.android, false);

  const androidWorkflow = classifyChangedFiles(['.github/workflows/android-ci.yml'], config);
  assert.equal(androidWorkflow.scopes.android, true);

  const classifier = classifyChangedFiles(['scripts/ci/classify-changes.js'], config);
  assert.equal(Object.values(classifier.scopes).every(Boolean), true);
});

test('unknown runtime paths fail safe by activating every scope', () => {
  const result = classifyChangedFiles(['futurePlatform/src/main.future'], config);
  assert.equal(Object.values(result.scopes).every(Boolean), true);
  assert.deepEqual(result.unknown, ['futurePlatform/src/main.future']);
});

test('unknown GitHub infrastructure paths also activate every scope', () => {
  const result = classifyChangedFiles(['.github/actions/future-ci/action.yml'], config);
  assert.equal(Object.values(result.scopes).every(Boolean), true);
  assert.deepEqual(result.unknown, ['.github/actions/future-ci/action.yml']);
});

test('documentation-only changes are recognized without runtime scopes', () => {
  const result = classifyChangedFiles(['README.md', 'docs/CI.md', 'specs/example.md'], config);
  assert.equal(Object.values(result.scopes).some(Boolean), false);
  assert.deepEqual(result.unknown, []);
});

test('GitHub event ranges cover PR, push and manual full runs', () => {
  assert.deepEqual(diffRangeFromEvent('pull_request', {
    pull_request: { base: { sha: 'base' }, head: { sha: 'head' } },
  }), { base: 'base', head: 'head', mergeBase: true });
  assert.deepEqual(diffRangeFromEvent('push', { before: 'before', after: 'after' }), {
    base: 'before',
    head: 'after',
  });
  assert.deepEqual(diffRangeFromEvent('workflow_dispatch', {}), { forceAll: true });
});

test('paired CLI flags reject missing values', () => {
  for (const flag of ['--files-from', '--github-output', '--config']) {
    assert.throws(() => parseArgs([flag]), /requires a value/);
    assert.throws(() => parseArgs([flag, '--all']), /requires a value/);
  }
});

test('missing or malformed GitHub event payload conservatively enables every scope', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'futeba-ci-event-'));
  const malformedEvent = path.join(directory, 'malformed-event.json');
  fs.writeFileSync(malformedEvent, '{not-json');

  for (const [name, eventPath] of [
    ['missing', path.join(directory, 'missing-event.json')],
    ['malformed', malformedEvent],
  ]) {
    const outputPath = path.join(directory, `${name}-output`);
    const classification = main([], {
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outputPath,
    });
    assert.equal(Object.values(classification.scopes).every(Boolean), true);
    assert.match(fs.readFileSync(outputPath, 'utf8'), /^android=true$/m);
  }
});

test('git diff keeps both sides of cross-scope renames and deleted Android files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'futeba-ci-diff-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  git('init', '--quiet');
  git('config', 'user.name', 'CI Scope Test');
  git('config', 'user.email', 'ci-scope@example.invalid');

  fs.mkdirSync(path.join(directory, 'app'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'app/Player.kt'), 'class Player\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'base');
  const base = git('rev-parse', 'HEAD').trim();

  fs.mkdirSync(path.join(directory, 'web'), { recursive: true });
  fs.renameSync(path.join(directory, 'app/Player.kt'), path.join(directory, 'web/Player.ts'));
  git('add', '-A');
  git('commit', '--quiet', '-m', 'move');
  const head = git('rev-parse', 'HEAD').trim();

  assert.deepEqual(changedFilesFromGit(base, head, directory), [
    'app/Player.kt',
    'web/Player.ts',
  ]);
});

test('PR diff uses the merge base and ignores unrelated changes added to master', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'futeba-ci-merge-base-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  git('init', '--quiet', '--initial-branch=master');
  git('config', 'user.name', 'CI Scope Test');
  git('config', 'user.email', 'ci-scope@example.invalid');
  fs.writeFileSync(path.join(directory, 'README.md'), 'base\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'base');

  git('switch', '--quiet', '-c', 'feature');
  fs.mkdirSync(path.join(directory, 'web'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'web/App.tsx'), 'export {};\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'web feature');
  const head = git('rev-parse', 'HEAD').trim();

  git('switch', '--quiet', 'master');
  fs.mkdirSync(path.join(directory, 'app'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'app/Main.kt'), 'class Main\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'unrelated Android base change');
  const base = git('rev-parse', 'HEAD').trim();

  assert.deepEqual(changedFilesFromGit(base, head, directory, true), ['web/App.tsx']);
});

test('GitHub outputs are stable booleans plus classifier version', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'futeba-ci-scope-'));
  const outputPath = path.join(directory, 'github-output');
  const classification = classifyChangedFiles(['storage.rules'], config);
  writeGithubOutputs(outputPath, classification);

  const output = fs.readFileSync(outputPath, 'utf8');
  assert.match(output, /^scope_version=1$/m);
  assert.match(output, /^rules=true$/m);
  assert.match(output, /^android=false$/m);
});
