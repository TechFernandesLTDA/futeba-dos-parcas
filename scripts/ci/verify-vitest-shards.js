'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { plannedFilesForShard } = require('./vitest-shard-plan');

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalTestPath(testPath) {
  const normalized = testPath.replaceAll('\\', '/');
  const sourceIndex = normalized.lastIndexOf('/src/');
  return sourceIndex === -1 ? normalized : normalized.slice(sourceIndex + 1);
}

function loadShardReport(reportPath) {
  invariant(fs.existsSync(reportPath), `shard report not found: ${reportPath}`);
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON report ${path.basename(reportPath)}: ${error.message}`);
  }
}

function validateShardReport(report, expectedPaths, shardIndex, shardTotal) {
  invariant(report.success === true, `Vitest shard ${shardIndex}/${shardTotal} did not succeed`);
  invariant(report.numFailedTests === 0, `Vitest shard ${shardIndex}/${shardTotal} contains failed tests`);
  invariant(Array.isArray(report.testResults), 'Vitest JSON has no testResults array');

  const actualPaths = report.testResults.map(({ name }) => canonicalTestPath(name)).sort();
  const plannedPaths = [...expectedPaths].sort();
  invariant(
    new Set(actualPaths).size === actualPaths.length,
    `Vitest shard ${shardIndex}/${shardTotal} contains duplicate test paths`
  );
  invariant(
    JSON.stringify(actualPaths) === JSON.stringify(plannedPaths),
    `Vitest shard ${shardIndex}/${shardTotal} path drift: expected ${JSON.stringify(plannedPaths)}, received ${JSON.stringify(actualPaths)}`
  );

  for (const file of report.testResults) {
    invariant(
      file.status === 'passed',
      `${canonicalTestPath(file.name)} finished with status ${file.status}`
    );
  }

  return {
    testFiles: actualPaths.length,
    passedTests: report.numPassedTests,
    skippedTests: report.numPendingTests,
  };
}

function main() {
  const reportPath = path.resolve(process.argv[2] ?? 'reports/vitest/shard.json');
  const shardIndex = Number(process.argv[3]);
  const shardTotal = Number(process.argv[4]);
  const webRoot = path.resolve(__dirname, '../../web');
  const expectedPaths = plannedFilesForShard(webRoot, shardIndex, shardTotal);
  const totals = validateShardReport(
    loadShardReport(reportPath),
    expectedPaths,
    shardIndex,
    shardTotal
  );
  console.log(
    `Vitest shard ${shardIndex}/${shardTotal} verified: ${totals.testFiles} files, ` +
    `${totals.passedTests} tests passed, ${totals.skippedTests} skipped.`
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

module.exports = { canonicalTestPath, loadShardReport, validateShardReport };
