#!/usr/bin/env node
/**
 * Bump de versão automático baseado em commits convencionais.
 *
 * Regras de bump:
 *   BREAKING CHANGE ou feat!  → major
 *   feat                       → minor
 *   fix / perf / refactor / …  → patch
 *
 * Atualiza app/build.gradle.kts: versionName e versionCode (+1).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function getCurrentVersion(gradlePath) {
  const content = fs.readFileSync(gradlePath, 'utf8');
  const nameMatch = content.match(/versionName\s*=\s*"([^"]+)"/);
  const codeMatch = content.match(/versionCode\s*=\s*(\d+)/);
  if (!nameMatch || !codeMatch) {
    throw new Error('Não foi possível extrair versionName/versionCode de ' + gradlePath);
  }
  return {
    name: nameMatch[1],
    code: parseInt(codeMatch[1], 10),
  };
}

function parseVersion(versionString) {
  const parts = versionString.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error('versionName inválido: ' + versionString);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function getLastTag() {
  try {
    return run('git describe --tags --abbrev=0');
  } catch {
    // Sem tags: considera todos os commits
    return null;
  }
}

function getCommitsSinceTag(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  try {
    return run(`git log ${range} --pretty=format:"%s"`).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function determineBumpType(commits) {
  let bump = null; // null = sem mudança

  for (const msg of commits) {
    // BREAKING CHANGE → major
    if (/BREAKING[\s-]CHANGE/i.test(msg) || /^[a-z]+(\(.+\))?!:/.test(msg)) {
      return 'major';
    }
    // feat → minor (mas continua olhando por breaking)
    if (/^feat(\(.+\))?:/.test(msg)) {
      bump = 'minor';
      continue;
    }
    // fix/perf/refactor/chore/ci/docs/test/style/build → patch (se ainda sem minor)
    if (/^(fix|perf|refactor|chore|ci|docs|test|style|build|revert)(\(.+\))?:/.test(msg)) {
      if (bump !== 'minor') bump = 'patch';
    }
  }

  return bump;
}

function applyBump(version, bumpType) {
  const v = { ...version };
  if (bumpType === 'major') {
    v.major += 1;
    v.minor = 0;
    v.patch = 0;
  } else if (bumpType === 'minor') {
    v.minor += 1;
    v.patch = 0;
  } else {
    v.patch += 1;
  }
  return v;
}

function updateGradleFile(gradlePath, newName, newCode) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(
    /(versionName\s*=\s*")[^"]+(")/,
    `$1${newName}$2`
  );
  content = content.replace(
    /(versionCode\s*=\s*)\d+/,
    `$1${newCode}`
  );
  fs.writeFileSync(gradlePath, content, 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const GRADLE_PATH = path.resolve(__dirname, '..', 'app', 'build.gradle.kts');

const current = getCurrentVersion(GRADLE_PATH);
console.log(`Versão atual: ${current.name} (code ${current.code})`);

const lastTag = getLastTag();
console.log(`Última tag: ${lastTag ?? '(nenhuma)'}`);

const commits = getCommitsSinceTag(lastTag);
console.log(`Commits desde a última tag: ${commits.length}`);

if (commits.length === 0) {
  console.log('Nenhum commit novo — sem bump.');
  process.exit(0);
}

const bumpType = determineBumpType(commits);
if (!bumpType) {
  console.log('Nenhum commit relevante para bump — sem alteração.');
  process.exit(0);
}

const parsed = parseVersion(current.name);
const bumped = applyBump(parsed, bumpType);
const newName = `${bumped.major}.${bumped.minor}.${bumped.patch}`;
const newCode = current.code + 1;

console.log(`Bump: ${bumpType} → ${current.name} → ${newName} (code ${newCode})`);

updateGradleFile(GRADLE_PATH, newName, newCode);
console.log(`app/build.gradle.kts atualizado com sucesso.`);
