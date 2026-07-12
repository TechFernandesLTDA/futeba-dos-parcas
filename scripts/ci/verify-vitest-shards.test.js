'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  EXPECTED,
  SHARD_MANIFEST,
  SHARD_EXPECTATIONS,
  loadShardReport,
  loadShardReports,
  validateSingleShard,
  validateShardManifest,
  validateShardReports,
} = require('./verify-vitest-shards');

function buildCompleteReports() {
  const passedFiles = (prefix, fileCount, passedTests) => {
    const files = Array.from({ length: fileCount }, (_, index) => ({
      name: `/workspace/web/src/example/${prefix}-${index + 1}.test.ts`,
      status: 'passed',
      assertionResults: [{ status: 'passed' }],
    }));
    files[0].assertionResults.push(
      ...Array.from(
        { length: passedTests - fileCount },
        () => ({ status: 'passed' })
      )
    );
    return files;
  };
  const skippedFile = {
    name: '/workspace/web/src/example/skipped.test.ts',
    status: 'passed',
    assertionResults: Array.from(
      { length: EXPECTED.skippedTests },
      () => ({ status: 'skipped' })
    ),
  };
  const shardFiles = [
    passedFiles('shard-1', 90, 540),
    [...passedFiles('shard-2', 88, 584), skippedFile],
  ];

  return shardFiles.map((testResults, index) => {
    const assertions = testResults.flatMap((file) => file.assertionResults);
    const numPassedTests = assertions.filter(({ status }) => status === 'passed').length;
    const numPendingTests = assertions.filter(({ status }) => status === 'skipped').length;
    return {
      name: `shard-${index + 1}-of-${EXPECTED.shards}.json`,
      report: {
        success: true,
        numTotalTests: assertions.length,
        numPassedTests,
        numFailedTests: 0,
        numPendingTests,
        numTodoTests: 0,
        testResults,
      },
    };
  });
}

function manifestForReports(reports) {
  return {
    version: 1,
    shardTotal: EXPECTED.shards,
    shards: Object.fromEntries(reports.map(({ report }, index) => [
      index + 1,
      report.testResults.map(({ name }) => name.slice(name.lastIndexOf('/src/') + 1)),
    ])),
  };
}

test('accepts two disjoint successful shards with the complete baseline', () => {
  const totals = validateShardReports(buildCompleteReports());

  assert.deepEqual(totals, {
    testFiles: 179,
    passedFiles: 178,
    skippedFiles: 1,
    totalTests: 1139,
    passedTests: 1124,
    failedTests: 0,
    skippedTests: 15,
    todoTests: 0,
  });
});

test('each shard independently enforces its measured coverage baseline', () => {
  const reports = buildCompleteReports();
  const manifest = manifestForReports(reports);

  assert.deepEqual(validateSingleShard(reports[0], 1, manifest), SHARD_EXPECTATIONS[1]);
  assert.deepEqual(validateSingleShard(reports[1], 2, manifest), SHARD_EXPECTATIONS[2]);

  reports[1].report.numPassedTests -= 1;
  assert.throws(
    () => validateSingleShard(reports[1], 2, manifest),
    /Vitest shard 2 drift/
  );
});

test('rejects same-cardinality path replacement inside a shard', () => {
  const reports = buildCompleteReports();
  const manifest = manifestForReports(reports);
  reports[0].report.testResults[0].name = '/workspace/web/src/example/replacement.test.ts';

  assert.throws(
    () => validateSingleShard(reports[0], 1, manifest),
    /Vitest shard 1 path drift/
  );
});

test('checked-in manifest covers 179 existing disjoint test files', () => {
  assert.equal(validateShardManifest(SHARD_MANIFEST), SHARD_MANIFEST);

  for (const testPath of Object.values(SHARD_MANIFEST.shards).flat()) {
    assert.equal(
      fs.existsSync(path.resolve(__dirname, '../../web', testPath)),
      true,
      `manifest path does not exist: ${testPath}`
    );
  }
});

test('rejects a failed matrix result before accepting reports', () => {
  assert.throws(
    () => validateShardReports(buildCompleteReports(), 'failure'),
    /web shard jobs finished with result: failure/
  );
});

test('rejects duplicate files and silent count drift', () => {
  const duplicate = buildCompleteReports();
  duplicate[1].report.testResults[0].name = duplicate[0].report.testResults[0].name;
  assert.throws(() => validateShardReports(duplicate), /duplicate test file/);

  const drifted = buildCompleteReports();
  drifted[0].report.testResults[0].assertionResults.pop();
  drifted[0].report.numTotalTests -= 1;
  drifted[0].report.numPassedTests -= 1;
  assert.throws(() => validateShardReports(drifted), /Vitest coverage drift/);
});

test('loads exactly the two named shard reports from disk', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-shards-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  for (const { name, report } of buildCompleteReports()) {
    fs.writeFileSync(path.join(directory, name), JSON.stringify(report));
  }
  assert.equal(
    loadShardReport(path.join(directory, 'shard-1-of-2.json')).name,
    'shard-1-of-2.json'
  );
  assert.equal(loadShardReports(directory).length, EXPECTED.shards);

  fs.rmSync(path.join(directory, 'shard-2-of-2.json'));
  assert.throws(() => loadShardReports(directory), /expected shard reports/);
});
