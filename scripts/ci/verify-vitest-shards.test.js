'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
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
