'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx)$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function discoverTestFiles(webRoot) {
  const sourceRoot = path.join(webRoot, 'src');
  invariant(fs.existsSync(sourceRoot), `Web source directory not found: ${sourceRoot}`);

  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
        files.push(path.relative(webRoot, absolutePath).split(path.sep).join('/'));
      }
    }
  };
  visit(sourceRoot);
  return files.sort();
}

function planVitestShards(testFiles, shardTotal) {
  invariant(Number.isInteger(shardTotal) && shardTotal > 0, 'shard total must be a positive integer');
  const uniqueFiles = [...new Set(testFiles)].sort();
  invariant(uniqueFiles.length === testFiles.length, 'test file discovery contains duplicates');
  invariant(uniqueFiles.length >= shardTotal, 'not enough test files for requested shard total');

  const shards = Array.from({ length: shardTotal }, () => []);
  uniqueFiles.forEach((testFile, index) => {
    shards[index % shardTotal].push(testFile);
  });
  return shards;
}

function plannedFilesForShard(webRoot, shardIndex, shardTotal) {
  invariant(
    Number.isInteger(shardIndex) && shardIndex >= 1 && shardIndex <= shardTotal,
    `invalid shard index ${shardIndex}/${shardTotal}`
  );
  return planVitestShards(discoverTestFiles(webRoot), shardTotal)[shardIndex - 1];
}

module.exports = {
  TEST_FILE_PATTERN,
  discoverTestFiles,
  planVitestShards,
  plannedFilesForShard,
};
