'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

test('checkGameReminders legacy query has its exact composite index', () => {
  const reminders = fs.readFileSync(
    path.join(repoRoot, 'functions/src/reminders.ts'),
    'utf8'
  );
  assert.match(
    reminders,
    /\.where\("dateTime",\s*"==",\s*null\)\s*\.where\("date",\s*">=",\s*minDate\)\s*\.where\("date",\s*"<=",\s*maxDate\)/s,
    'legacy reminder query changed; update this contract and its index together'
  );

  const indexes = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'firestore.indexes.json'), 'utf8')
  );
  const expectedFields = [
    {fieldPath: 'dateTime', order: 'ASCENDING'},
    {fieldPath: 'date', order: 'ASCENDING'},
    {fieldPath: '__name__', order: 'ASCENDING'},
  ];
  const matching = indexes.indexes.filter(
    (index) => index.collectionGroup === 'games' &&
      index.queryScope === 'COLLECTION' &&
      JSON.stringify(index.fields) === JSON.stringify(expectedFields)
  );

  assert.equal(
    matching.length,
    1,
    'games needs exactly one dateTime ASC + date ASC + __name__ ASC index'
  );
});
