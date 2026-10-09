#!/usr/bin/env node
'use strict';

/**
 * Verifica (somente leitura) que todas as Cloud Functions do projeto estão
 * ACTIVE e imprime o resumo por geração/runtime. Usa a Cloud Functions API v2
 * com as credenciais do ambiente (GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Uso: node scripts/ci/verify-functions-active.js --project futebadosparcas
 * Exit 1 se alguma função não estiver ACTIVE ou se a lista vier vazia.
 */

function summarize(functions) {
  const byState = {};
  const byRuntime = {};
  for (const fn of functions) {
    const state = fn.state || 'UNKNOWN';
    byState[state] = (byState[state] || 0) + 1;
    const runtime = (fn.buildConfig && fn.buildConfig.runtime) || 'unknown';
    byRuntime[runtime] = (byRuntime[runtime] || 0) + 1;
  }
  const notActive = functions.filter((fn) => fn.state !== 'ACTIVE').map((fn) => fn.name.split('/').pop());
  return { total: functions.length, byState, byRuntime, notActive };
}

async function main() {
  const idx = process.argv.indexOf('--project');
  const project = idx >= 0 ? process.argv[idx + 1] : 'futebadosparcas';
  const { GoogleAuth } = require('google-auth-library');
  const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();

  const functions = [];
  let pageToken = '';
  do {
    const url =
      `https://cloudfunctions.googleapis.com/v2/projects/${encodeURIComponent(project)}/locations/-/functions` +
      `?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const { data } = await client.request({ url });
    functions.push(...(data.functions || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  const s = summarize(functions);
  console.log(`functions total=${s.total} state=${JSON.stringify(s.byState)} runtime=${JSON.stringify(s.byRuntime)}`);
  if (s.total === 0 || s.notActive.length > 0) {
    console.error(`Funcoes fora de ACTIVE: ${s.notActive.join(', ') || '(lista vazia)'}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`verify-functions-active falhou: ${err.message}`);
    process.exit(2);
  });
}

module.exports = { summarize };
