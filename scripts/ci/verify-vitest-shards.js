'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXPECTED = Object.freeze({
  shards: 2,
  testFiles: 179,
  passedFiles: 178,
  skippedFiles: 1,
  totalTests: 1139,
  passedTests: 1124,
  skippedTests: 15,
  todoTests: 0,
});

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function canonicalTestPath(testPath) {
  const normalized = testPath.replaceAll('\\', '/');
  const sourceIndex = normalized.lastIndexOf('/src/');
  return sourceIndex === -1 ? normalized : normalized.slice(sourceIndex + 1);
}

function loadShardReports(reportDirectory) {
  invariant(fs.existsSync(reportDirectory), `report directory not found: ${reportDirectory}`);

  const expectedNames = Array.from(
    { length: EXPECTED.shards },
    (_, index) => `shard-${index + 1}-of-${EXPECTED.shards}.json`
  );
  const reportNames = fs.readdirSync(reportDirectory)
    .filter((name) => /^shard-\d+-of-\d+\.json$/.test(name))
    .sort();

  invariant(
    JSON.stringify(reportNames) === JSON.stringify(expectedNames),
    `expected shard reports ${expectedNames.join(', ')}, found ${reportNames.join(', ') || 'none'}`
  );

  return reportNames.map((name) => {
    const reportPath = path.join(reportDirectory, name);
    try {
      return { name, report: JSON.parse(fs.readFileSync(reportPath, 'utf8')) };
    } catch (error) {
      throw new Error(`invalid JSON report ${name}: ${error.message}`);
    }
  });
}

function validateShardReports(shards, shardsResult = 'success') {
  invariant(shardsResult === 'success', `web shard jobs finished with result: ${shardsResult}`);
  invariant(shards.length === EXPECTED.shards, `expected ${EXPECTED.shards} shard reports`);

  const totals = {
    testFiles: 0,
    passedFiles: 0,
    skippedFiles: 0,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    todoTests: 0,
  };
  const seenFiles = new Set();

  for (const { name, report } of shards) {
    invariant(report.success === true, `${name} did not finish successfully`);
    invariant(report.numFailedTests === 0, `${name} contains failed tests`);
    invariant(Array.isArray(report.testResults), `${name} has no testResults array`);

    totals.totalTests += report.numTotalTests;
    totals.passedTests += report.numPassedTests;
    totals.failedTests += report.numFailedTests;
    totals.skippedTests += report.numPendingTests;
    totals.todoTests += report.numTodoTests;

    for (const file of report.testResults) {
      const testPath = canonicalTestPath(file.name);
      invariant(!seenFiles.has(testPath), `duplicate test file across shards: ${testPath}`);
      seenFiles.add(testPath);
      totals.testFiles += 1;

      const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : [];
      const isFullySkipped = assertions.length > 0 && assertions.every(
        (assertion) => ['skipped', 'pending', 'todo', 'disabled'].includes(assertion.status)
      );
      if (isFullySkipped) {
        totals.skippedFiles += 1;
      } else {
        invariant(file.status === 'passed', `${testPath} finished with status ${file.status}`);
        totals.passedFiles += 1;
      }
    }
  }

  const expectedTotals = {
    testFiles: EXPECTED.testFiles,
    passedFiles: EXPECTED.passedFiles,
    skippedFiles: EXPECTED.skippedFiles,
    totalTests: EXPECTED.totalTests,
    passedTests: EXPECTED.passedTests,
    failedTests: 0,
    skippedTests: EXPECTED.skippedTests,
    todoTests: EXPECTED.todoTests,
  };

  invariant(
    JSON.stringify(totals) === JSON.stringify(expectedTotals),
    `Vitest coverage drift: expected ${JSON.stringify(expectedTotals)}, received ${JSON.stringify(totals)}`
  );

  return totals;
}

function main() {
  const reportDirectory = path.resolve(process.argv[2] ?? 'reports/vitest');
  const shards = loadShardReports(reportDirectory);
  const totals = validateShardReports(shards, process.env.WEB_SHARDS_RESULT ?? 'success');
  console.log(
    `Vitest shards verified: ${totals.passedFiles} files passed, ` +
    `${totals.skippedFiles} skipped; ${totals.passedTests} tests passed, ` +
    `${totals.skippedTests} skipped.`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { EXPECTED, loadShardReports, validateShardReports };
