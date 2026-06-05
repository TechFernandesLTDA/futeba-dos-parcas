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

// Escopos de commit relevantes para cada plataforma (versionamento independente).
// Commit SEM escopo conta para todas; escopos cross-cutting (shared/firebase)
// contam para as plataformas que dependem deles. Assim um `feat(web):` nao
// bumpa o Android, e vice-versa.
const RELEVANT_SCOPES = {
  android: ['android', 'shared', 'firebase'],
  ios: ['ios', 'shared', 'firebase'],
  web: ['web', 'firebase'],
  functions: ['functions', 'firebase', 'shared'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Executa `git` com argumentos como array (execFile, sem shell — sem risco de
 * injecao de comando).
 */
function git(args, opts = {}) {
  // opts.silent: ignora stderr (ex.: `git describe` sem tags imprime "fatal:"
  // mesmo sendo um caso esperado/tratado).
  const stdio = opts.silent ? ['ignore', 'pipe', 'ignore'] : undefined;
  return execFileSync('git', args, { encoding: 'utf8', stdio }).trim();
}

function fail(msg) {
  console.error('Erro: ' + msg);
  process.exit(1);
}

function usage() {
  console.error('Uso: node scripts/bump-version.js <android|web|ios|functions> [major|minor|patch] [--dry-run]');
  console.error('  --dry-run: calcula e imprime o bump/tag sem alterar nenhum arquivo.');
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

function getLastTag(platform) {
  // Tag escopada por plataforma: `<platform>-v1.2.3`. Para o android, durante a
  // transicao, aceita tambem a tag legada `v1.2.3` (releases antigas eram
  // repo-wide mas rastreavam o android).
  const args = ['describe', '--tags', '--abbrev=0', '--match', `${platform}-v*`];
  if (platform === 'android') args.push('--match', 'v*');
  try {
    return git(args, { silent: true });
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

/**
 * Verifica se um commit convencional e relevante para a plataforma, com base no
 * escopo. Commit sem escopo (`feat: ...`) e relevante para todas.
 */
function commitMatchesPlatform(msg, platform) {
  const m = msg.match(/^[a-z]+\(([^)]+)\)!?:/i);
  if (!m) return true; // sem escopo -> relevante para todas as plataformas
  const scope = m[1].toLowerCase();
  return (RELEVANT_SCOPES[platform] || []).includes(scope);
}

function inferBumpType(commits, platform) {
  let bump = null; // null = sem mudanca relevante
  for (const msg of commits) {
    // Versionamento independente: ignora commits de outras plataformas.
    if (!commitMatchesPlatform(msg, platform)) continue;
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

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes('--dry-run');
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const [platform, explicitType] = positional;

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
  const lastTag = getLastTag(platform);
  const commits = getCommitsSinceTag(lastTag);
  console.log(`Ultima tag (${platform}): ${lastTag ?? '(nenhuma)'} — ${commits.length} commit(s) desde entao`);
  bumpType = inferBumpType(commits, platform);
  if (!bumpType) {
    console.log(`Nenhum commit relevante para "${platform}" — sem alteracao.`);
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
const tagName = `${platform}-v${newVersion}`; // tag escopada por plataforma

if (dryRun) {
  console.log(
    `\n[DRY RUN] Bump ${bumpType}: ${platform} ${oldVersion} -> ${newVersion}` +
    (hasBuild ? ` (build ${newBuild})` : '')
  );
  console.log(`[DRY RUN] Tag que seria criada: ${tagName}`);
  console.log('[DRY RUN] Nenhum arquivo foi alterado.');
  process.exit(0);
}

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
console.log(`\nTag desta versao: ${tagName}`);
if (platform !== 'android') {
  // Android e tagueado automaticamente pelo workflow version-bump.yml.
  // Plataformas manuais (web/ios/functions) criam a tag escopada na mao:
  console.log('Para publicar (plataforma manual):');
  console.log(`  git tag ${tagName} && git push origin ${tagName}`);
}
