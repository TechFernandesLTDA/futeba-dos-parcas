'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const gate = fs.readFileSync(path.join(repoRoot, '.github/workflows/e2e-gate.yml'), 'utf8');
const e2e = fs.readFileSync(path.join(repoRoot, '.github/workflows/web-e2e-ci.yml'), 'utf8');
const doc = fs.readFileSync(path.join(repoRoot, 'docs/ci/E2E_GATE.md'), 'utf8');

test('gate roda em PR e em push para master (pós-merge)', () => {
  assert.match(gate, /on:\n  pull_request:\n    branches: \[master\]\n  push:\n    branches: \[master\]/);
});

test('gate tem permissão explícita para disparar workflow e nada além de leitura', () => {
  assert.match(gate, /permissions:\n  contents: read\n  actions: write/);
});

test('job chama-se E2E Gate (nome do check que a convenção exige verde)', () => {
  assert.match(gate, /\n  e2e-gate:\n    name: E2E Gate\n/);
  assert.match(doc, /E2E Gate/);
});

test('gate roda nos runners Linux do WSL e classifica escopo para sempre reportar', () => {
  assert.match(gate, /\n  changes:\n    name: Classify changes\n    uses: \.\/\.github\/workflows\/change-scope\.yml/);
  assert.match(gate, /needs: \[changes\]/);
  assert.match(gate, /runs-on: \$\{\{ fromJSON\(vars\.RUNNER_LABELS_POLLER \|\| vars\.RUNNER_LABELS_LINUX \|\| '\["self-hosted","Linux","X64","futeba-general"\]'\) \}\}/);
  assert.doesNotMatch(gate, /runs-on: ubuntu-/);
  // Falha da classificação reprova o check (não fica skipped).
  assert.match(gate, /if: \$\{\{ !cancelled\(\) \}\}/);
  assert.match(gate, /CHANGES_RESULT" != "success"[\s\S]*?exit 1/);
});

test('PR cancela o gate anterior; master mantém um gate por SHA', () => {
  assert.match(gate, /group: e2e-gate-\$\{\{ github\.event_name == 'pull_request' && github\.ref \|\| github\.sha \}\}/);
  assert.match(gate, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
});

test('verificação pós-merge abre issue com permissão mínima só no push de master', () => {
  const issueJob = gate.slice(gate.indexOf('\n  post-merge-issue:'));
  assert.match(issueJob, /needs: \[e2e-gate\]/);
  assert.match(issueJob, /if: \$\{\{ failure\(\) && github\.event_name == 'push' \}\}/);
  assert.match(issueJob, /permissions:\n      contents: read\n      issues: write/);
  assert.match(issueJob, /gh issue create/);
  assert.match(issueJob, /gh issue comment/);
});

test('o script cancela o E2E órfão quando o gate é cancelado ou estoura o tempo', () => {
  const script = fs.readFileSync(path.join(repoRoot, 'scripts/ci/e2e-gate.js'), 'utf8');
  assert.match(script, /'gh', \['run', 'cancel'/);
  assert.match(script, /process\.on\(signal/);
});

test('gate nunca mascara falha (sem continue-on-error, || true, pipes ou tail/grep)', () => {
  assert.doesNotMatch(gate, /continue-on-error/);
  assert.doesNotMatch(gate, /\|\|\s*true/);
  assert.doesNotMatch(gate, /\|\s*(tail|grep|head)\b/);
  assert.doesNotMatch(gate, /if:\s*always\(\)/);
});

test('gate tem timeout limitado e confirma SHA esperado', () => {
  assert.match(gate, /timeout-minutes: 60/);
  assert.match(gate, /--expect-sha "\$GATE_EXPECT_SHA"/);
  assert.match(gate, /GATE_EXPECT_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});

test('gate dispara o E2E real (web-e2e-ci) pelo script, sem check fabricado', () => {
  assert.match(gate, /node scripts\/ci\/e2e-gate\.js/);
  assert.match(gate, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  const script = fs.readFileSync(path.join(repoRoot, 'scripts/ci/e2e-gate.js'), 'utf8');
  assert.match(script, /const WORKFLOW_FILE = 'web-e2e-ci\.yml'/);
  assert.match(script, /'workflow', 'run', WORKFLOW_FILE/);
});

test('o E2E alvo continua disponível por dispatch (o gate depende disso)', () => {
  assert.match(e2e, /workflow_dispatch:/);
});

test('web-e2e-ci não ganhou pull_request solto (gate centraliza o disparo)', () => {
  assert.doesNotMatch(e2e, /^\s*pull_request:/m);
});

test('gate valida os próprios contratos antes de disparar E2E', () => {
  assert.match(gate, /node --test scripts\/ci\/e2e-gate\.test\.js scripts\/ci\/e2e-gate-workflow-contract\.test\.js/);
});
