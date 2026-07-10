'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const releaseWorkflow = fs.readFileSync(
  path.join(repoRoot, '.github/workflows/release.yml'),
  'utf8'
);
const playWorkflow = fs.readFileSync(
  path.join(repoRoot, '.github/workflows/deploy-production.yml'),
  'utf8'
);

test('GitHub Release does not depend on Actions artifact storage', () => {
  assert.doesNotMatch(
    releaseWorkflow,
    /actions\/(?:upload|download)-artifact/,
    'release.yml must attach files directly from the build workspace'
  );
  assert.match(releaseWorkflow, /workflow_dispatch:[\s\S]*release_tag:/);
  assert.match(releaseWorkflow, /refs\/tags\/\$\{RELEASE_TAG\}\^\{commit\}/);
  assert.match(releaseWorkflow, /softprops\/action-gh-release/);
  assert.match(
    releaseWorkflow,
    /files:\s*\|\s*\n\s*app\/build\/outputs\/bundle\/release\/app-release\.aab\s*\n\s*app\/build\/outputs\/apk\/release\/app-release\.apk/
  );
  assert.match(releaseWorkflow, /fail_on_unmatched_files:\s*true/);
  assert.match(releaseWorkflow, /overwrite_files:\s*true/);
  assert.match(
    releaseWorkflow,
    /publish-release-notes:[\s\S]*needs:\s*build-release/
  );
});

test('Play workflow has one responsibility and minimal permissions', () => {
  assert.match(playWorkflow, /r0adkll\/upload-google-play/);
  assert.match(playWorkflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(playWorkflow, /actions\/upload-artifact/);
  assert.doesNotMatch(playWorkflow, /softprops\/action-gh-release/);
});
