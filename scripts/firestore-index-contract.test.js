'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../firestore.indexes.json'), 'utf8'));
const publicFields = ['deleted_at', 'status', 'visibility', 'dateTime'];

test('composite declarations contain at least two fields: single-field configuration belongs in fieldOverrides', () => {
  const invalid = manifest.indexes.filter(index => index.fields.length < 2);
  assert.deepEqual(invalid, [], 'A one-field composite aborts Firebase index deployment before missing game indexes can be created');
});
for (const direction of ['ASCENDING', 'DESCENDING']) {
  test(`games public list has the complete soft-delete/status/visibility index for dateTime ${direction}`, () => {
    const found = manifest.indexes.some(index => index.collectionGroup === 'games'
      && index.queryScope === 'COLLECTION'
      && JSON.stringify(index.fields.map(field => field.fieldPath)) === JSON.stringify(publicFields)
      && index.fields.slice(0, 3).every(field => field.order === 'ASCENDING')
      && index.fields[3].order === direction);
    assert.ok(found, `Missing games composite for ${direction}`);
  });
}

test('league season collection-group filter uses a single-field override while preserving default collection indexes', () => {
  const override = (manifest.fieldOverrides || []).find(field => field.collectionGroup === 'league_seasons' && field.fieldPath === 'is_active');
  assert.ok(override, 'Missing league_seasons.is_active fieldOverride');
  for (const order of ['ASCENDING', 'DESCENDING']) {
    assert.ok(override.indexes.some(index => index.queryScope === 'COLLECTION' && index.order === order), `Default ${order} collection index must remain enabled`);
  }
  assert.ok(override.indexes.some(index => index.queryScope === 'COLLECTION' && index.arrayConfig === 'CONTAINS'), 'Default array index must remain enabled');
  assert.ok(override.indexes.some(index => index.queryScope === 'COLLECTION_GROUP' && index.order === 'ASCENDING'), 'Missing collection-group single-field index');
});
