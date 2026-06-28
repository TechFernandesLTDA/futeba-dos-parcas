'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyXpLog,
  hasAuditableSource,
  isLegacyUnattributed,
  parseArgs,
  shouldFail,
} = require('./check_xp_logs');

test('classifyXpLog: XP positivo com origem auditavel fica ok', () => {
  const item = classifyXpLog('log1', {
    user_id: 'user1',
    xp_earned: 30,
    source: 'game_finished',
    source_collection: 'games',
    source_event_id: 'game1',
  });

  assert.equal(item.status, 'ok');
  assert.equal(item.auditable, true);
  assert.equal(hasAuditableSource({
    source_collection: 'games',
    source_event_id: 'game1',
  }), true);
});

test('classifyXpLog: XP positivo sem origem vira violacao', () => {
  const item = classifyXpLog('log2', {
    user_id: 'user1',
    amount: 10,
  });

  assert.equal(item.status, 'missing_source');
  assert.equal(item.positive, true);
  assert.equal(item.auditable, false);
});

test('classifyXpLog: legado marcado fica separado de violacao nova', () => {
  const item = classifyXpLog('log3', {
    userId: 'user1',
    xpEarned: 10,
    audit_status: 'legacy_unattributed',
  });

  assert.equal(item.status, 'legacy_unattributed');
  assert.equal(item.legacyUnattributed, true);
  assert.equal(isLegacyUnattributed({ source: 'legacy_unattributed' }), true);
});

test('classifyXpLog: XP zero ou negativo nao exige origem', () => {
  assert.equal(classifyXpLog('zero', { xp_earned: 0 }).status, 'ok');
  assert.equal(classifyXpLog('neg', { xp_earned: -10 }).status, 'ok');
});

test('shouldFail: falha com missingSource e com legado sem allowLegacy', () => {
  const base = {
    summary: {
      missingSource: 0,
      legacyUnattributed: 0,
      missingReferencedSource: 0,
      markedLegacy: 0,
    },
  };

  assert.equal(shouldFail({
    summary: { ...base.summary, missingSource: 1 },
  }, { allowLegacy: true }), true);
  assert.equal(shouldFail({
    summary: { ...base.summary, missingSource: 1, markedLegacy: 1 },
  }, { allowLegacy: true, fix: true }), false);
  assert.equal(shouldFail({
    summary: { ...base.summary, legacyUnattributed: 1 },
  }, { allowLegacy: false }), true);
  assert.equal(shouldFail({
    summary: { ...base.summary, legacyUnattributed: 1 },
  }, { allowLegacy: true }), false);
});

test('parseArgs: valida limit e dry-run', () => {
  const opts = parseArgs([
    '--project=futebadosparcas',
    '--limit=10',
    '--max-details=0',
    '--allow-legacy',
  ]);
  assert.equal(opts.project, 'futebadosparcas');
  assert.equal(opts.maxDetails, 0);
  assert.throws(() => parseArgs(['--limit=0']), /inteiro positivo/);
  assert.throws(() => parseArgs(['--max-details=-1']), /maior ou igual a zero/);
  assert.throws(() => parseArgs(['--dry-run']), /--fix/);
});
