'use strict';
// #4382: nomes e XP dos níveis precisam ser idênticos entre shared/xp-constants.json
// (fonte da verdade de web/functions) e LevelTable.kt (Android/KMP).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const json = JSON.parse(fs.readFileSync(path.join(root, 'shared/xp-constants.json'), 'utf8'));
const copy = JSON.parse(fs.readFileSync(path.join(root, 'functions/src/_constants/xp-constants.json'), 'utf8'));
const kotlin = fs.readFileSync(
  path.join(root, 'shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/LevelTable.kt'),
  'utf8',
);

const kotlinLevels = [...kotlin.matchAll(/LevelDefinition\(\s*(\d+)\s*,\s*(\d+)L\s*,\s*"([^"]*)"/g)].map(m => ({
  level: Number(m[1]),
  xpRequired: Number(m[2]),
  name: m[3],
}));
const jsonLevels = json.levelTable.levels.map(({ level, xpRequired, name }) => ({ level, xpRequired, name }));

test('LevelTable.kt declara os 21 níveis (0-20)', () => {
  assert.equal(kotlinLevels.length, 21);
  assert.equal(jsonLevels.length, 21);
});

test('nomes e xpRequired de LevelTable.kt batem com shared/xp-constants.json', () => {
  assert.deepEqual(kotlinLevels, jsonLevels);
});

test('cópia de functions tem os mesmos nomes de nível', () => {
  assert.deepEqual(
    copy.levelTable.levels.map(({ level, xpRequired, name }) => ({ level, xpRequired, name })),
    jsonLevels,
  );
});
