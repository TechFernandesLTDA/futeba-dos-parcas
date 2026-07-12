'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  TEST_FILE_PATTERN,
  discoverTestFiles,
  planVitestShards,
  plannedFilesForShard,
} = require('./vitest-shard-plan');
const { buildVitestArgs } = require('./run-vitest-shard');
const { loadShardReport, validateShardReport } = require('./verify-vitest-shards');

function createFixtureWebRoot(context) {
  const webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-plan-'));
  context.after(() => fs.rmSync(webRoot, { recursive: true, force: true }));
  const testFiles = [
    'src/a/alpha.test.ts',
    'src/a/bravo.test.tsx',
    'src/b/charlie.spec.ts',
    'src/b/delta.spec.tsx',
    'src/c/echo.test.ts',
    'src/c/foxtrot.test.tsx',
    'src/golf.test.ts',
  ];
  for (const testFile of [...testFiles, 'src/not-a-test.ts']) {
    const absolutePath = path.join(webRoot, testFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'export {};\n');
  }
  return { webRoot, testFiles: testFiles.sort() };
}

function reportForPaths(testFiles) {
  return {
    success: true,
    numTotalTests: testFiles.length,
    numPassedTests: testFiles.length,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: testFiles.map((testFile) => ({
      name: `/workspace/web/${testFile}`,
      status: 'passed',
      assertionResults: [{ status: 'passed' }],
    })),
  };
}

test('planner discovers every test once and partitions deterministically', (context) => {
  const { webRoot, testFiles } = createFixtureWebRoot(context);
  const discovered = discoverTestFiles(webRoot);
  const firstPlan = planVitestShards(discovered, 2);
  const secondPlan = planVitestShards([...discovered].reverse(), 2);

  assert.deepEqual(discovered, testFiles);
  assert.deepEqual(firstPlan, secondPlan);
  assert.deepEqual([...firstPlan[0], ...firstPlan[1]].sort(), testFiles);
  assert.equal(firstPlan[0].filter((file) => firstPlan[1].includes(file)).length, 0);
  assert.deepEqual(plannedFilesForShard(webRoot, 1, 2), firstPlan[0]);
  assert.deepEqual(plannedFilesForShard(webRoot, 2, 2), firstPlan[1]);
});

test('validator accepts exactly the dynamically planned subset', (context) => {
  const { webRoot } = createFixtureWebRoot(context);
  const expectedPaths = plannedFilesForShard(webRoot, 1, 2);

  assert.deepEqual(
    validateShardReport(reportForPaths(expectedPaths), expectedPaths, 1, 2),
    { testFiles: expectedPaths.length, passedTests: expectedPaths.length, skippedTests: 0 }
  );
});

test('validator rejects same-cardinality replacement and duplicate paths', (context) => {
  const { webRoot } = createFixtureWebRoot(context);
  const expectedPaths = plannedFilesForShard(webRoot, 1, 2);
  const replaced = reportForPaths(expectedPaths);
  replaced.testResults[0].name = '/workspace/web/src/replacement.test.ts';
  assert.throws(
    () => validateShardReport(replaced, expectedPaths, 1, 2),
    /path drift/
  );

  const duplicated = reportForPaths(expectedPaths);
  duplicated.testResults[0].name = duplicated.testResults[1].name;
  assert.throws(
    () => validateShardReport(duplicated, expectedPaths, 1, 2),
    /duplicate test paths/
  );
});

test('validator rejects failed Vitest results', (context) => {
  const { webRoot } = createFixtureWebRoot(context);
  const expectedPaths = plannedFilesForShard(webRoot, 2, 2);
  const report = reportForPaths(expectedPaths);
  report.success = false;
  report.numFailedTests = 1;

  assert.throws(
    () => validateShardReport(report, expectedPaths, 2, 2),
    /did not succeed/
  );
});

test('runner passes only explicit planned files and safe Vitest flags', () => {
  const files = ['src/a.test.ts', 'src/b.test.tsx'];
  const args = buildVitestArgs(files, 'reports/vitest/shard-1-of-2.json');
  assert.deepEqual(args.slice(0, 3), ['run', ...files]);
  assert.match(args.join(' '), /--pool=threads/);
  assert.match(args.join(' '), /--maxWorkers=2/);
  assert.match(args.join(' '), /--reporter=default --reporter=json/);
  assert.doesNotMatch(
    args.join(' '),
    /--(?:shard|retry|exclude|passWithNoTests|changed|related|project|testNamePattern)/
  );
});

test('checked-in Web suite has a complete disjoint dynamic plan', () => {
  const webRoot = path.resolve(__dirname, '../../web');
  const discovered = discoverTestFiles(webRoot);
  const shards = planVitestShards(discovered, 2);

  assert.ok(discovered.length > 0);
  assert.deepEqual([...shards[0], ...shards[1]].sort(), discovered);
  assert.equal(shards[0].filter((file) => shards[1].includes(file)).length, 0);
});

test('loader reads a shard JSON report from disk', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-report-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const reportPath = path.join(directory, 'shard.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportForPaths(['src/a.test.ts'])));

  assert.equal(loadShardReport(reportPath).numPassedTests, 1);
  assert.throws(() => loadShardReport(path.join(directory, 'missing.json')), /not found/);
});

// --- Contrato: include do Vitest (web/vite.config.ts) vs. TEST_FILE_PATTERN
// (scripts/ci/vitest-shard-plan.js) -------------------------------------
// Os dois padrões vivem em arquivos distintos e formatos diferentes (glob x
// regex). Hoje coincidem; se um for ampliado sem o outro, testes passam a rodar
// local mas ficam de fora dos shards silenciosamente. Este contrato detecta o
// drift em CI. Comparamos por conjuntos de tokens (ordem-independente) para
// ser imune a reordenação cosmética das chaves.

function readVitestIncludeGlob() {
  const viteConfigPath = path.resolve(__dirname, '../../web/vite.config.ts');
  const source = fs.readFileSync(viteConfigPath, 'utf8');
  const match = source.match(/include:\s*\[\s*'([^']+)'\s*\]/);
  assert.ok(match, `test.include glob não encontrado em ${viteConfigPath}`);
  return match[1];
}

function extractBraceTokens(glob) {
  // 'src/**/*.{test,spec}.{ts,tsx}' -> { suffixes: ['test','spec'], extensions: ['ts','tsx'] }
  const braceGroups = [...glob.matchAll(/\{([^}]+)\}/g)].map((m) => m[1].split(','));
  assert.equal(
    braceGroups.length,
    2,
    `glob fora do formato esperado (2 grupos entre chaves): ${glob}`
  );
  const [suffixes, extensions] = braceGroups;
  return { suffixes, extensions };
}

function extractRegexTokens(regexSource) {
  // '\\.(?:test|spec)\\.(?:ts|tsx)$' -> { suffixes: ['test','spec'], extensions: ['ts','tsx'] }
  const groups = [...regexSource.matchAll(/\(\?:([^)]+)\)/g)].map((m) => m[1].split('|'));
  assert.equal(
    groups.length,
    2,
    `regex fora do formato esperado (2 grupos não-capturantes): ${regexSource}`
  );
  const [suffixes, extensions] = groups;
  return { suffixes, extensions };
}

function assertIncludeMatchesPlanner(viteIncludeGlob, plannerRegexSource) {
  const fromVite = extractBraceTokens(viteIncludeGlob);
  const fromPlanner = extractRegexTokens(plannerRegexSource);
  assert.deepEqual(
    [...fromVite.suffixes].sort(),
    [...fromPlanner.suffixes].sort(),
    'TEST_FILE_PATTERN suffixes divergem do test.include do Vitest'
  );
  assert.deepEqual(
    [...fromVite.extensions].sort(),
    [...fromPlanner.extensions].sort(),
    'TEST_FILE_PATTERN extensions divergem do test.include do Vitest'
  );
}

test('contract: TEST_FILE_PATTERN matches test.include from web/vite.config.ts', () => {
  const viteGlob = readVitestIncludeGlob();
  const plannerSource = TEST_FILE_PATTERN.source;

  assertIncludeMatchesPlanner(viteGlob, plannerSource);
});

test('contract: planner covers all 4 variants test/spec x ts/tsx declared in include', () => {
  const viteGlob = readVitestIncludeGlob();
  const { suffixes, extensions } = extractBraceTokens(viteGlob);

  assert.deepEqual([...suffixes].sort(), ['spec', 'test']);
  assert.deepEqual([...extensions].sort(), ['ts', 'tsx']);

  for (const suffix of suffixes) {
    for (const ext of extensions) {
      const filename = `example.${suffix}.${ext}`;
      assert.ok(TEST_FILE_PATTERN.test(filename), `planner deveria casar ${filename}`);
    }
  }
});

test('contract: simulated widening of test.include (adds .js) is detected as drift', () => {
  // Se o include do Vitest for ampliado para .js sem atualizar TEST_FILE_PATTERN,
  // testes .js rodariam local mas ficariam de fora dos shards. O contrato deve
  // falhar explicitamente.
  const widenedGlob = 'src/**/*.{test,spec}.{ts,tsx,js}';
  assert.throws(
    () => assertIncludeMatchesPlanner(widenedGlob, TEST_FILE_PATTERN.source),
    /extensions divergem/
  );
});

test('contract: cosmetic brace reorder (e.g. {tsx,ts}) does not cause a false negative', () => {
  assertIncludeMatchesPlanner(
    'src/**/*.{spec,test}.{tsx,ts}',
    TEST_FILE_PATTERN.source
  );
});
