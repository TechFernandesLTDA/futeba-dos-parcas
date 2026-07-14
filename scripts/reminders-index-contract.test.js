'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

test('checkGameReminders legacy query stays independent of composite-index rollout', () => {
  const reminders = fs.readFileSync(
    path.join(repoRoot, 'functions/src/reminders.ts'),
    'utf8'
  );
  assert.match(
    reminders,
    /\.collection\("games"\)\s*\.where\("date",\s*">=",\s*minDate\)\s*\.where\("date",\s*"<=",\s*maxDate\)/s,
    'legacy reminder query must use the bounded date window'
  );
  assert.doesNotMatch(
    reminders,
    /\.where\("dateTime",\s*"==",\s*null\)\s*\.where\("date",\s*">=",\s*minDate\)/s,
    'dateTime null filtering would reintroduce a composite-index rollout dependency'
  );
});
