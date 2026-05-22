#!/usr/bin/env node
/**
 * Bump de versao multi-plataforma baseado em Conventional Commits.
 *
 * Uso:
 *   node scripts/bump-version.js <android|web|ios|functions> [major|minor|patch]
 *
 * Sem o tipo explicito, o bump e inferido pelos commits convencionais desde a
 * ultima tag. Recomenda-se passar o tipo explicito em bumps manuais (web/ios/
 * functions); o fluxo de CI usa a inferencia para "android".
 *
 * Fonte de verdade: versions.json (raiz). O script atualiza versions.json E o
 * arquivo nativo da plataforma:
 *   android   -> app/build.gradle.kts      (versionName + versionCode +1)
 *   web       -> web/package.json          (version)
 *   ios       -> iosApp/iosApp/Info.plist  (CFBundleShortVersionString + CFBundleVersion +1)
 *   functions -> functions/package.json    (version)
 *
 * Regras de inferencia:
 *   BREAKING CHANGE ou tipo!  -> major
 *   feat                      -> minor
 *   fix/perf/refactor/...     -> patch
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSIONS_PATH = path.join(ROOT, 'versions.json');
const PLATFORMS = ['android', 'web', 'ios', 'functions'];
const BUMP_TYPES = ['major', 'minor', 'patch'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Executa `git` com argumentos como array (execFile, sem shell — sem risco de
 * injecao de comando).
 */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function fail(msg) {
  console.error('Erro: ' + msg);
  process.exit(1);
}

function usage() {
  console.error('Uso: node scripts/bump-version.js <android|web|ios|functions> [major|minor|patch]');
}

function readVersions() {
  if (!fs.existsSync(VERSIONS_PATH)) {
    fail('versions.json nao encontrado na raiz do projeto.');
  }
  return JSON.parse(fs.readFileSync(VERSIONS_PATH, 'utf8'));
}

function writeVersions(obj) {
  fs.writeFileSync(VERSIONS_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function parseVersion(versionString) {
  const parts = String(versionString).split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    fail('Versao invalida: ' + versionString);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
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
  return `${v.major}.${v.minor}.${v.patch}`;
}

function getLastTag() {
  try {
    return git(['describe', '--tags', '--abbrev=0']);
  } catch {
    return null;
  }
}

function getCommitsSinceTag(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  try {
    return git(['log', range, '--pretty=format:%s']).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function inferBumpType(commits) {
  let bump = null; // null = sem mudanca relevante
  for (const msg of commits) {
    if (/BREAKING[\s-]CHANGE/i.test(msg) || /^[a-z]+(\(.+\))?!:/.test(msg)) {
      return 'major';
    }
    if (/^feat(\(.+\))?:/.test(msg)) {
      bump = 'minor';
      continue;
    }
    if (/^(fix|perf|refactor|chore|ci|docs|test|style|build|revert)(\(.+\))?:/.test(msg)) {
      if (bump !== 'minor') bump = 'patch';
    }
  }
  return bump;
}

// ---------------------------------------------------------------------------
// Atualizadores de arquivo nativo
// ---------------------------------------------------------------------------

function updateAndroid(newVersion, newBuild) {
  const filePath = path.join(ROOT, 'app', 'build.gradle.kts');
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/(versionName\s*=\s*")[^"]+(")/, `$1${newVersion}$2`);
  content = content.replace(/(versionCode\s*=\s*)\d+/, `$1${newBuild}`);
  fs.writeFileSync(filePath, content, 'utf8');
  return 'app/build.gradle.kts';
}

function updateIos(newVersion, newBuild) {
  const filePath = path.join(ROOT, 'iosApp', 'iosApp', 'Info.plist');
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${newVersion}$2`
  );
  content = content.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${newBuild}$2`
  );
  fs.writeFileSync(filePath, content, 'utf8');
  return 'iosApp/iosApp/Info.plist';
}

function updatePackageJson(relPath, newVersion) {
  const filePath = path.join(ROOT, relPath);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!/"version"\s*:\s*"[^"]+"/.test(content)) {
    fail(`Campo "version" ausente em ${relPath} — adicione-o antes de usar o bump.`);
  }
  content = content.replace(/("version"\s*:\s*")[^"]+(")/, `$1${newVersion}$2`);
  fs.writeFileSync(filePath, content, 'utf8');
  return relPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [platform, explicitType] = process.argv.slice(2);

if (!platform || !PLATFORMS.includes(platform)) {
  usage();
  fail('plataforma invalida ou ausente: ' + (platform || '(vazio)'));
}
if (explicitType && !BUMP_TYPES.includes(explicitType)) {
  usage();
  fail('tipo de bump invalido: ' + explicitType);
}

const versions = readVersions();
const entry = versions[platform];
if (!entry || !entry.version) {
  fail(`versions.json nao tem entrada valida para "${platform}".`);
}

console.log(`Plataforma: ${platform}`);
console.log(
  `Versao atual: ${entry.version}` +
  (entry.buildNumber != null ? ` (build ${entry.buildNumber})` : '')
);

let bumpType = explicitType;
if (!bumpType) {
  const lastTag = getLastTag();
  const commits = getCommitsSinceTag(lastTag);
  console.log(`Ultima tag: ${lastTag ?? '(nenhuma)'} — ${commits.length} commit(s) desde entao`);
  bumpType = inferBumpType(commits);
  if (!bumpType) {
    console.log('Nenhum commit relevante para bump — sem alteracao.');
    process.exit(0);
  }
  console.log(`Tipo inferido: ${bumpType}`);
} else {
  console.log(`Tipo explicito: ${bumpType}`);
}

const oldVersion = entry.version;
const newVersion = applyBump(parseVersion(oldVersion), bumpType);
const hasBuild = entry.buildNumber != null;
const newBuild = hasBuild ? entry.buildNumber + 1 : undefined;

// Atualiza versions.json (fonte de verdade)
entry.version = newVersion;
if (hasBuild) entry.buildNumber = newBuild;
writeVersions(versions);

// Atualiza o arquivo nativo da plataforma
let nativeFile;
if (platform === 'android') {
  nativeFile = updateAndroid(newVersion, newBuild);
} else if (platform === 'ios') {
  nativeFile = updateIos(newVersion, newBuild);
} else if (platform === 'web') {
  nativeFile = updatePackageJson('web/package.json', newVersion);
} else {
  nativeFile = updatePackageJson('functions/package.json', newVersion);
}

console.log(
  `\nBump ${bumpType}: ${platform} ${oldVersion} -> ${newVersion}` +
  (hasBuild ? ` (build ${newBuild})` : '')
);
console.log(`Arquivos atualizados: versions.json, ${nativeFile}`);
