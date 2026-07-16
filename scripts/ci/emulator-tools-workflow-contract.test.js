'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');
const workflows = [
  '.github/workflows/test-harness-ci.yml',
  '.github/workflows/web-e2e-ci.yml',
];

function extractNamedStep(workflow, stepName) {
  const marker = `      - name: ${stepName}\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `workflow must contain step ${stepName}`);
  const end = workflow.indexOf('\n      - name:', start + marker.length);
  return end === -1 ? workflow.slice(start) : workflow.slice(start, end);
}

for (const relativePath of workflows) {
  const workflow = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

  test(`${relativePath} isolates pinned emulator tools per job`, () => {
    const install = extractNamedStep(
      workflow,
      'Instalar Firebase CLI + tsx (isolado por job)'
    );

    assert.doesNotMatch(workflow, /npm\s+install\s+(?:-g|--global)\b/);
    assert.match(
      install,
      /tools_dir="\$RUNNER_TEMP\/futeba-ci-tools-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}-\$\{GITHUB_JOB\}"/
    );
    assert.match(install, /npm install \\\n\s+--prefix "\$tools_dir"/);
    assert.match(install, /firebase-tools@15\.23\.0/);
    assert.match(install, /tsx@4\.23\.1/);
    assert.match(install, /--no-save/);
    assert.match(install, /--package-lock=false/);
    assert.match(
      install,
      /printf '%s\\n' "\$tools_dir\/node_modules\/\.bin" >> "\$GITHUB_PATH"/
    );
    assert.match(install, /"\$tools_dir\/node_modules\/\.bin\/firebase" --version/);
    assert.match(install, /"\$tools_dir\/node_modules\/\.bin\/tsx" --version/);
  });
}

test('realtime load isolates the pinned Firebase CLI per job', () => {
  const workflow = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/realtime-load-ci.yml'),
    'utf8'
  );
  const install = extractNamedStep(
    workflow,
    'Install Firebase CLI (isolated per job)'
  );

  assert.doesNotMatch(workflow, /npm\s+install\s+(?:-g|--global)\b/);
  assert.match(
    install,
    /tools_dir="\$RUNNER_TEMP\/futeba-ci-tools-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}-\$\{GITHUB_JOB\}"/
  );
  assert.match(install, /npm install \\\n\s+--prefix "\$tools_dir"/);
  assert.match(install, /firebase-tools@15\.23\.0/);
  assert.match(install, /--no-save/);
  assert.match(install, /--package-lock=false/);
  assert.match(
    install,
    /printf '%s\\n' "\$tools_dir\/node_modules\/\.bin" >> "\$GITHUB_PATH"/
  );
  assert.match(install, /"\$tools_dir\/node_modules\/\.bin\/firebase" --version/);
});
