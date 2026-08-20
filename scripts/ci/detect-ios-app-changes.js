#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { changedFilesFromGit, diffRangeFromEvent, loadConfig, globToRegExp } = require('./classify-changes');

function detect(eventName, event, cwd = process.cwd()) {
  const config = loadConfig();
  const range = diffRangeFromEvent(eventName, event);
  if (range.forceAll) return { shouldRun: true, files: [] };

  const files = changedFilesFromGit(range.base, range.head, cwd, range.mergeBase);
  const matchers = config.ios_app_patterns.map(globToRegExp);
  return {
    shouldRun: files.some((file) => matchers.some((matcher) => matcher.test(file))),
    files,
  };
}

function main(env = process.env) {
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const result = detect(env.GITHUB_EVENT_NAME, event);
  fs.appendFileSync(env.GITHUB_OUTPUT, `should_run=${result.shouldRun}\n`, 'utf8');
  console.log(`ios-app-scope: should_run=${result.shouldRun}; files=${result.files.length}`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`iOS app scope detection failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { detect };
