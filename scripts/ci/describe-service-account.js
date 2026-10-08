#!/usr/bin/env node
'use strict';

/**
 * Imprime apenas dados NAO secretos de um JSON de service account (tipo, e-mail
 * e projeto) e falha se o arquivo nao for uma service account. Nunca imprime a
 * chave privada.
 */
const fs = require('node:fs');

function describe(json) {
  if (!json || json.type !== 'service_account') {
    throw new Error('credencial nao e uma service account');
  }
  return `deployer=${json.client_email} project=${json.project_id}`;
}

if (require.main === module) {
  try {
    console.log(describe(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))));
  } catch (err) {
    console.error(`describe-service-account falhou: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { describe };
