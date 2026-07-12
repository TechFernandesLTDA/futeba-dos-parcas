'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  EXPECTED,
  loadShardReports,
  validateShardReports,
} = require('./verify-vitest-shards');

function buildCompleteReports() {
  const passedFiles = Array.from({ length: EXPECTED.passedFiles }, (_, index) => ({
    name: `/workspace/web/src/example/test-${index + 1}.test.ts`,
    status: 'passed',
    assertionResults: [{ status: 'passed' }],
  }));
  passedFiles[0].assertionResults.push(
    ...Array.from(
      { length: EXPECTED.passedTests - EXPECTED.passedFiles },
      () => ({ status: 'passed' })
    )
  );
  const skippedFile = {
    name: '/workspace/web/src/example/skipped.test.ts',
    status: 'passed',
    assertionResults: Array.from(
      { length: EXPECTED.skippedTests },
      () => ({ status: 'skipped' })
    ),
  };
  const files = [...passedFiles, skippedFile];
  const midpoint = Math.ceil(files.length / EXPECTED.shards);

  return [files.slice(0, midpoint), files.slice(midpoint)].map((testResults, index) => {
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
  assert.equal(loadShardReports(directory).length, EXPECTED.shards);

  fs.rmSync(path.join(directory, 'shard-2-of-2.json'));
  assert.throws(() => loadShardReports(directory), /expected shard reports/);
});
