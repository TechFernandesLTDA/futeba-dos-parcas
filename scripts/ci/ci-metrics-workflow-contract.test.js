import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/ci-metrics.yml', 'utf8');

function extractNamedStep(stepName) {
  const marker = `      - name: ${stepName}\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `workflow must contain step ${stepName}`);
  const end = workflow.indexOf('\n      - name:', start + marker.length);
  return end === -1 ? workflow.slice(start) : workflow.slice(start, end);
}

test('CI Metrics uses the configurable self-hosted runner pool', () => {
  assert.match(
    workflow,
    /runs-on: \$\{\{ fromJSON\(vars\.RUNNER_LABELS \|\| '\["self-hosted","macOS","ARM64"\]'\) \}\}/
  );
});

test('metrics collection remains authoritative while artifact upload is best-effort', () => {
  const collect = extractNamedStep('Coletar métricas via GitHub API');
  const upload = extractNamedStep('Upload JSON artifact (histórico)');

  assert.doesNotMatch(collect, /continue-on-error/);
  assert.match(upload, /if: always\(\)/);
  assert.match(upload, /continue-on-error: true/);
  assert.match(upload, /retention-days: 1/);
  assert.match(upload, /compression-level: 9/);
  assert.match(upload, /if-no-files-found: warn/);
});
