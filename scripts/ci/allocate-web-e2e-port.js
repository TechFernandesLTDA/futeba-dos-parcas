'use strict';

const net = require('node:net');
const fs = require('node:fs');

// O sistema operacional escolhe uma porta livre sem tocar em outros processos.
function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

module.exports = { allocatePort };

if (require.main === module) {
  if (!process.env.GITHUB_ENV) {
    throw new Error('GITHUB_ENV is required to publish the E2E port');
  }
  allocatePort().then((port) => {
    fs.appendFileSync(process.env.GITHUB_ENV, `E2E_PORT=${port}\n`);
    console.log(`Web E2E preview port: ${port}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
