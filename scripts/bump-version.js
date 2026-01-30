#!/usr/bin/env node

/**
 * #028 - Semantic Versioning Automation
 *
 * Analisa conventional commits desde a última tag e incrementa a versão automaticamente:
 * - feat: -> MINOR version (1.5.0 -> 1.6.0)
 * - fix: -> PATCH version (1.5.0 -> 1.5.1)
 * - BREAKING CHANGE: -> MAJOR version (1.5.0 -> 2.0.0)
 *
 * Uso: node scripts/bump-version.js [--dry-run]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run');

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return '';
  }
}

function getCurrentVersion() {
  const buildGradle = fs.readFileSync(
    path.join(__dirname, '../app/build.gradle.kts'),
    'utf8'
  );

  const versionName = buildGradle.match(/versionName = "(.+)"/)[1];
  const versionCode = parseInt(buildGradle.match(/versionCode = (\d+)/)[1]);

  return { versionName, versionCode };
}

function getCommitsSinceLastTag() {
  const lastTag = exec('git describe --tags --abbrev=0') || 'HEAD~10';
  const commits = exec(`git log ${lastTag}..HEAD --pretty=format:"%s"`);
  return commits.split('\n').filter(c => c.length > 0);
}

function analyzeCommits(commits) {
  let hasMajor = false;
  let hasMinor = false;
  let hasPatch = false;

  commits.forEach(commit => {
    if (commit.includes('BREAKING CHANGE') || commit.match(/^[a-z]+!:/)) {
      hasMajor = true;
    } else if (commit.startsWith('feat:') || commit.startsWith('feat(')) {
      hasMinor = true;
    } else if (commit.startsWith('fix:') || commit.startsWith('fix(')) {
      hasPatch = true;
    }
  });

  if (hasMajor) return 'major';
  if (hasMinor) return 'minor';
  if (hasPatch) return 'patch';
  return null;
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      return version;
  }
}

function updateBuildGradle(newVersion, newVersionCode) {
  const buildGradlePath = path.join(__dirname, '../app/build.gradle.kts');
  let content = fs.readFileSync(buildGradlePath, 'utf8');

  content = content.replace(
    /versionCode = \d+/,
    `versionCode = ${newVersionCode}`
  );
  content = content.replace(
    /versionName = ".+"/,
    `versionName = "${newVersion}"`
  );

  if (!isDryRun) {
    fs.writeFileSync(buildGradlePath, content, 'utf8');
  }
}

function main() {
  console.log('🚀 Semantic Versioning Automation\n');

  const { versionName, versionCode } = getCurrentVersion();
  console.log(`Current version: ${versionName} (code ${versionCode})`);

  const commits = getCommitsSinceLastTag();
  console.log(`\nAnalyzing ${commits.length} commits since last tag...`);

  const bumpType = analyzeCommits(commits);

  if (!bumpType) {
    console.log('ℹ️  No version bump needed (no feat/fix commits)');
    return;
  }

  const newVersion = bumpVersion(versionName, bumpType);
  const newVersionCode = versionCode + 1;

  console.log(`\n📦 Bump type: ${bumpType.toUpperCase()}`);
  console.log(`New version: ${newVersion} (code ${newVersionCode})`);

  if (isDryRun) {
    console.log('\n🔍 Dry run mode - no changes made');
  } else {
    updateBuildGradle(newVersion, newVersionCode);
    console.log('\n✅ build.gradle.kts updated successfully!');
    console.log('\nNext steps:');
    console.log('  1. Review changes: git diff app/build.gradle.kts');
    console.log('  2. Commit: git add app/build.gradle.kts');
    console.log(`  3. Tag: git tag v${newVersion}`);
    console.log('  4. Push: git push && git push --tags');
  }
}

main();
