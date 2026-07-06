#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const webDir = path.join(root, 'web');
const requiredMajor = 22;

function fail(message) {
  console.error(`[hosting-predeploy] ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) fail(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`);
}

function assertFile(relPath) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    fail(`required package entrypoint missing after npm ci: ${relPath}`);
  }
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== requiredMajor) {
  fail(`Node ${requiredMajor} is required; current version: ${process.version}`);
}

if (!fs.existsSync(path.join(webDir, 'package-lock.json'))) {
  fail('web/package-lock.json not found; npm ci cannot run reproducibly.');
}

run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: webDir });

assertFile('web/node_modules/typescript/bin/tsc');
assertFile('web/node_modules/vite/bin/vite.js');

run('npm', ['run', 'build'], { cwd: webDir });
