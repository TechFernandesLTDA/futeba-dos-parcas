#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../..');
const defaultConfigPath = path.join(repoRoot, '.github/ci/change-scopes-v1.json');

function globToRegExp(glob) {
  let source = '^';

  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*') {
      if (glob[index + 1] === '*') {
        index += 1;
        if (glob[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[\\^$.[\]{}()+|]/g, '\\$&');
    }
  }

  return new RegExp(`${source}$`);
}

function loadConfig(configPath = defaultConfigPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!Number.isInteger(config.version) || config.version < 1) {
    throw new Error('Change-scope config must declare a positive integer version');
  }
  if (!Array.isArray(config.scopes) || config.scopes.length === 0) {
    throw new Error('Change-scope config must declare at least one scope');
  }

  return {
    ...config,
    ignoreMatchers: config.ignore.map(globToRegExp),
    compiledRules: config.rules.map((rule) => ({
      scopes: rule.scopes,
      matchers: rule.patterns.map(globToRegExp),
    })),
  };
}

function allScopes(config, value) {
  return Object.fromEntries(config.scopes.map((scope) => [scope, value]));
}

function normalizeFile(file) {
  return file.trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function classifyChangedFiles(files, config = loadConfig()) {
  const result = allScopes(config, false);
  const unknown = [];
  const normalizedFiles = [...new Set(files.map(normalizeFile).filter(Boolean))];

  for (const file of normalizedFiles) {
    if (config.ignoreMatchers.some((matcher) => matcher.test(file))) {
      continue;
    }

    let matched = false;
    for (const rule of config.compiledRules) {
      if (!rule.matchers.some((matcher) => matcher.test(file))) {
        continue;
      }
      matched = true;
      for (const scope of rule.scopes) {
        if (!(scope in result)) {
          throw new Error(`Unknown scope '${scope}' in classifier v${config.version}`);
        }
        result[scope] = true;
      }
    }

    if (!matched) {
      unknown.push(file);
      Object.assign(result, allScopes(config, true));
    }
  }

  return { version: config.version, scopes: result, files: normalizedFiles, unknown };
}

function diffRangeFromEvent(eventName, event) {
  if (eventName === 'workflow_dispatch') {
    return { forceAll: true };
  }
  if (eventName === 'pull_request') {
    return {
      base: event.pull_request?.base?.sha,
      head: event.pull_request?.head?.sha,
      mergeBase: true,
    };
  }
  if (eventName === 'push') {
    return { base: event.before, head: event.after };
  }
  throw new Error(`Unsupported GitHub event '${eventName}'`);
}

function changedFilesFromGit(base, head, cwd = repoRoot, mergeBase = false) {
  if (!head) {
    throw new Error('Missing head SHA for change classification');
  }

  const zeroSha = /^0+$/.test(base || '');
  const args = zeroSha || !base
    ? ['diff-tree', '--root', '--no-commit-id', '--name-only', '--no-renames', '-r', head]
    : [
      'diff',
      '--name-only',
      '--no-renames',
      '--diff-filter=ACDMRTUXB',
      mergeBase ? `${base}...${head}` : base,
      ...(mergeBase ? [] : [head]),
    ];
  const output = execFileSync('git', args, { cwd, encoding: 'utf8' });
  return output.split(/\r?\n/).map(normalizeFile).filter(Boolean);
}

function writeGithubOutputs(outputPath, classification) {
  const lines = [
    `scope_version=${classification.version}`,
    ...Object.entries(classification.scopes).map(([scope, value]) => `${scope}=${value}`),
  ];
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--all') {
      result.forceAll = true;
    } else if (argument === '--files-from') {
      result.filesFrom = argv[++index];
    } else if (argument === '--github-output') {
      result.githubOutput = argv[++index];
    } else if (argument === '--config') {
      result.configPath = argv[++index];
    } else {
      throw new Error(`Unknown argument '${argument}'`);
    }
  }
  return result;
}

function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const config = loadConfig(args.configPath || defaultConfigPath);
  let files = [];
  let forceAll = args.forceAll === true;

  if (args.filesFrom) {
    files = fs.readFileSync(args.filesFrom, 'utf8').split(/\r?\n/);
  } else if (!forceAll) {
    const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
    const range = diffRangeFromEvent(env.GITHUB_EVENT_NAME, event);
    forceAll = range.forceAll === true;
    if (!forceAll) {
      try {
        files = changedFilesFromGit(range.base, range.head, repoRoot, range.mergeBase);
      } catch (error) {
        console.warn(`::warning::Could not determine changed files; enabling every scope: ${error.message}`);
        forceAll = true;
      }
    }
  }

  const classification = forceAll
    ? { version: config.version, scopes: allScopes(config, true), files, unknown: [] }
    : classifyChangedFiles(files, config);

  const outputPath = args.githubOutput || env.GITHUB_OUTPUT;
  if (outputPath) {
    writeGithubOutputs(outputPath, classification);
  }

  const active = Object.entries(classification.scopes)
    .filter(([, value]) => value)
    .map(([scope]) => scope);
  console.log(
    `change-scope-v${classification.version}: ${classification.files.length} file(s); `
      + `active=${active.join(',') || 'none'}`
  );
  if (classification.unknown.length > 0) {
    console.warn(`::warning::Unknown paths enabled every scope: ${classification.unknown.join(', ')}`);
  }

  return classification;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Change-scope classifier failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  allScopes,
  changedFilesFromGit,
  classifyChangedFiles,
  diffRangeFromEvent,
  globToRegExp,
  loadConfig,
  main,
  normalizeFile,
  parseArgs,
  writeGithubOutputs,
};
