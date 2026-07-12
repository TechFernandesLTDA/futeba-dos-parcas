'use strict';

const fs = require('node:fs');
const path = require('node:path');
const SHARD_MANIFEST = require('./web-vitest-shards-v1.json');

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
const SHARD_EXPECTATIONS = Object.freeze({
  1: Object.freeze({
    testFiles: 90,
    passedFiles: 90,
    skippedFiles: 0,
    totalTests: 540,
    passedTests: 540,
    failedTests: 0,
    skippedTests: 0,
    todoTests: 0,
  }),
  2: Object.freeze({
    testFiles: 89,
    passedFiles: 88,
    skippedFiles: 1,
    totalTests: 599,
    passedTests: 584,
    failedTests: 0,
    skippedTests: 15,
    todoTests: 0,
  }),
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

function validateShardManifest(manifest = SHARD_MANIFEST) {
  invariant(manifest.version === 1, `unsupported shard manifest version: ${manifest.version}`);
  invariant(manifest.shardTotal === EXPECTED.shards, 'shard manifest total does not match contract');

  const allPaths = [];
  for (let shardIndex = 1; shardIndex <= EXPECTED.shards; shardIndex += 1) {
    const paths = manifest.shards?.[shardIndex];
    invariant(Array.isArray(paths), `manifest shard ${shardIndex} is missing`);
    invariant(
      paths.length === SHARD_EXPECTATIONS[shardIndex].testFiles,
      `manifest shard ${shardIndex} expected ${SHARD_EXPECTATIONS[shardIndex].testFiles} paths, found ${paths.length}`
    );
    allPaths.push(...paths);
  }

  invariant(allPaths.length === EXPECTED.testFiles, 'manifest does not cover every test file');
  invariant(new Set(allPaths).size === allPaths.length, 'manifest contains duplicate test paths');
  return manifest;
}

function loadShardReport(reportPath) {
  invariant(fs.existsSync(reportPath), `shard report not found: ${reportPath}`);
  try {
    return {
      name: path.basename(reportPath),
      report: JSON.parse(fs.readFileSync(reportPath, 'utf8')),
    };
  } catch (error) {
    throw new Error(`invalid JSON report ${path.basename(reportPath)}: ${error.message}`);
  }
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

  return reportNames.map((name) => loadShardReport(path.join(reportDirectory, name)));
}

function summarizeShardReport({ name, report }) {
  invariant(report.success === true, `${name} did not finish successfully`);
  invariant(report.numFailedTests === 0, `${name} contains failed tests`);
  invariant(Array.isArray(report.testResults), `${name} has no testResults array`);

  const totals = {
    testFiles: 0,
    passedFiles: 0,
    skippedFiles: 0,
    totalTests: report.numTotalTests,
    passedTests: report.numPassedTests,
    failedTests: report.numFailedTests,
    skippedTests: report.numPendingTests,
    todoTests: report.numTodoTests,
  };
  const filePaths = [];

  for (const file of report.testResults) {
    const testPath = canonicalTestPath(file.name);
    filePaths.push(testPath);
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

  return { totals, filePaths };
}

function validateSingleShard(shard, shardIndex, manifest = SHARD_MANIFEST) {
  const expected = SHARD_EXPECTATIONS[shardIndex];
  invariant(expected, `unsupported shard index: ${shardIndex}`);
  invariant(
    shard.name === `shard-${shardIndex}-of-${EXPECTED.shards}.json`,
    `unexpected report name for shard ${shardIndex}: ${shard.name}`
  );

  validateShardManifest(manifest);
  const { totals, filePaths } = summarizeShardReport(shard);
  const expectedPaths = [...manifest.shards[shardIndex]].sort();
  const actualPaths = [...filePaths].sort();
  invariant(
    JSON.stringify(actualPaths) === JSON.stringify(expectedPaths),
    `Vitest shard ${shardIndex} path drift: expected ${JSON.stringify(expectedPaths)}, received ${JSON.stringify(actualPaths)}`
  );
  invariant(
    JSON.stringify(totals) === JSON.stringify(expected),
    `Vitest shard ${shardIndex} drift: expected ${JSON.stringify(expected)}, received ${JSON.stringify(totals)}`
  );
  return totals;
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

  for (const shard of shards) {
    const summary = summarizeShardReport(shard);
    for (const key of Object.keys(totals)) {
      totals[key] += summary.totals[key];
    }
    for (const testPath of summary.filePaths) {
      invariant(!seenFiles.has(testPath), `duplicate test file across shards: ${testPath}`);
      seenFiles.add(testPath);
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
  const reportPath = path.resolve(process.argv[2] ?? 'reports/vitest');
  const shardIndex = Number(process.argv[3]);
  const totals = shardIndex
    ? validateSingleShard(loadShardReport(reportPath), shardIndex)
    : validateShardReports(
      loadShardReports(reportPath),
      process.env.WEB_SHARDS_RESULT ?? 'success'
    );
  console.log(
    `Vitest coverage verified: ${totals.passedFiles} files passed, ` +
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

module.exports = {
  EXPECTED,
  SHARD_MANIFEST,
  SHARD_EXPECTATIONS,
  loadShardReport,
  loadShardReports,
  validateShardManifest,
  validateSingleShard,
  validateShardReports,
};
