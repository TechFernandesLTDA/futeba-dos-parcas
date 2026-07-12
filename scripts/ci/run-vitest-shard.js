'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { plannedFilesForShard } = require('./vitest-shard-plan');

function buildVitestArgs(testFiles, outputFile) {
  return [
    'run',
    ...testFiles,
    '--pool=threads',
    '--maxWorkers=2',
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${outputFile}`,
  ];
}

function main() {
  const shardIndex = Number(process.argv[2]);
  const shardTotal = Number(process.argv[3]);
  const outputFile = process.argv[4];
  if (!outputFile) throw new Error('usage: run-vitest-shard.js <index> <total> <output-file>');

  const webRoot = path.resolve(__dirname, '../../web');
  const testFiles = plannedFilesForShard(webRoot, shardIndex, shardTotal);
  const vitestPackage = require.resolve('vitest/package.json', { paths: [webRoot] });
  const vitestBin = path.join(path.dirname(vitestPackage), 'vitest.mjs');
  const args = buildVitestArgs(testFiles, outputFile);

  console.log(`Vitest shard ${shardIndex}/${shardTotal}: ${testFiles.length} explicit test files.`);
  const result = spawnSync(process.execPath, [vitestBin, ...args], {
    cwd: webRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildVitestArgs };
