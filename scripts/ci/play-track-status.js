#!/usr/bin/env node
'use strict';

/**
 * Consulta SOMENTE LEITURA das trilhas do Google Play (Play Developer API).
 *
 * Abre um edit temporário, lista as trilhas (`edits.tracks.list`) e descarta o
 * edit (`edits.delete`) — nada é commitado, nenhum release é alterado.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=sa.json \
 *     node scripts/ci/play-track-status.js --package com.futebadosparcas \
 *       [--track internal] [--version-code 81]
 *
 * Saída: resumo por trilha (nome do release, status, versionCodes). Com
 * `--version-code`, o exit code é 1 se o código não estiver na trilha pedida
 * (ou em nenhuma trilha, se `--track` for omitido).
 */

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

function parseArgs(argv) {
  const args = { package: 'com.futebadosparcas', track: '', versionCode: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--package') { args.package = value; i += 1; }
    else if (key === '--track') { args.track = value; i += 1; }
    else if (key === '--version-code') { args.versionCode = value; i += 1; }
    else throw new Error(`Argumento desconhecido: ${key}`);
  }
  return args;
}

/**
 * Procura um versionCode nas trilhas retornadas pela API.
 * @param {Array<{track: string, releases?: Array<{name?: string, status?: string, versionCodes?: string[]}>}>} tracks
 * @param {number|string} versionCode
 * @param {string} [onlyTrack] restringe a busca a uma trilha
 * @returns {Array<{track: string, status: string, name: string}>}
 */
function findVersionCode(tracks, versionCode, onlyTrack) {
  const wanted = String(versionCode);
  const hits = [];
  for (const t of tracks || []) {
    if (onlyTrack && t.track !== onlyTrack) continue;
    for (const r of t.releases || []) {
      if ((r.versionCodes || []).map(String).includes(wanted)) {
        hits.push({ track: t.track, status: r.status || '', name: r.name || '' });
      }
    }
  }
  return hits;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Dependência transitiva de firebase-admin (devDependency da raiz, instalada com `npm ci`).
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  const base = `${API}/${encodeURIComponent(args.package)}/edits`;

  const edit = (await client.request({ url: base, method: 'POST', data: {} })).data;
  let tracks = [];
  try {
    tracks = (await client.request({ url: `${base}/${edit.id}/tracks` })).data.tracks || [];
  } finally {
    await client.request({ url: `${base}/${edit.id}`, method: 'DELETE' }).catch(() => {});
  }

  for (const t of tracks) {
    const releases = (t.releases || []).map(
      (r) => `${r.name || '(sem nome)'} [${r.status}] versionCodes=${(r.versionCodes || []).join(',') || '-'}`
    );
    console.log(`track=${t.track}: ${releases.length ? releases.join(' | ') : '(sem releases)'}`);
  }

  if (args.versionCode) {
    const hits = findVersionCode(tracks, args.versionCode, args.track || undefined);
    if (hits.length === 0) {
      console.error(`versionCode ${args.versionCode} NAO encontrado${args.track ? ` na trilha ${args.track}` : ''}`);
      process.exit(1);
    }
    for (const h of hits) console.log(`OK versionCode ${args.versionCode} em ${h.track} (${h.status}) ${h.name}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    const detail = err && err.response && err.response.data ? JSON.stringify(err.response.data) : '';
    console.error(`play-track-status falhou: ${err.message} ${detail}`);
    process.exit(2);
  });
}

module.exports = { findVersionCode, parseArgs };
