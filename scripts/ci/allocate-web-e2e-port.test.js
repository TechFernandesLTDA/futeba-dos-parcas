'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { allocatePort } = require('./allocate-web-e2e-port');

test('selects a free port while another preview is listening', async (t) => {
  const occupied = net.createServer();
  occupied.listen(0, '127.0.0.1');
  await once(occupied, 'listening');
  t.after(() => occupied.close());

  const port = await allocatePort();
  assert.notEqual(port, occupied.address().port);
  const preview = net.createServer();
  preview.listen(port, '127.0.0.1');
  await once(preview, 'listening');
  t.after(() => preview.close());
  assert.equal(occupied.listening, true);
});
