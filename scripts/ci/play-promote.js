#!/usr/bin/env node
'use strict';

/**
 * Promove um versionCode já enviado ao Google Play para uma trilha
 * (beta/production), com lançamento gradual opcional (Play Developer API).
 *
 * Abre um edit, define a release da trilha com o versionCode e faz o commit.
 * O AAB precisa já existir no app, por exemplo enviado à internal por
 * deploy-production.yml.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=sa.json \
 *     node scripts/ci/play-promote.js --version-code 81 --track production \
 *       [--user-fraction 0.2] [--name "1.40.0"] [--dry-run]
 *
 * --user-fraction entre 0 e 1 (exclusivo) gera status "inProgress" (rollout
 * gradual). Sem esse parâmetro, ou com 1, gera status "completed" (100%).
 */

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const TRACKS = new Set(['internal', 'alpha', 'beta', 'production']);

function parseArgs(argv) {
  const args = { package: 'com.futebadosparcas', track: '', versionCode: '', userFraction: '', name: '', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--package') { args.package = value; i += 1; }
    else if (key === '--track') { args.track = value; i += 1; }
    else if (key === '--version-code') { args.versionCode = value; i += 1; }
    else if (key === '--user-fraction') { args.userFraction = value; i += 1; }
    else if (key === '--name') { args.name = value; i += 1; }
    else if (key === '--dry-run') { args.dryRun = true; }
    else throw new Error(`Argumento desconhecido: ${key}`);
  }
  if (!TRACKS.has(args.track)) throw new Error(`--track inválida: ${args.track}`);
  if (!/^\d+$/.test(String(args.versionCode))) throw new Error('--version-code obrigatório (inteiro)');
  return args;
}

/**
 * Monta o corpo de `edits.tracks.update`.
 * @returns {{track: string, releases: Array<Record<string, unknown>>}}
 */
function buildTrackBody({ track, versionCode, userFraction, name }) {
  const release = { versionCodes: [String(versionCode)], status: 'completed' };
  if (name) release.name = name;
  if (userFraction !== '' && userFraction !== undefined && userFraction !== null) {
    const f = Number(userFraction);
    if (!(f > 0 && f <= 1)) throw new Error(`--user-fraction deve estar em (0, 1]: ${userFraction}`);
    if (f < 1) {
      release.status = 'inProgress';
      release.userFraction = f;
    }
  }
  return { track, releases: [release] };
}

/** Pura: a resposta de erro da Play exige commit com changesNotSentForReview=true? */
function requiresManualReview(data) {
  const msg = JSON.stringify(data || {});
  return /changesNotSentForReview/.test(msg);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const body = buildTrackBody(args);
  console.log(`Plano: ${args.package} → trilha ${args.track}: ${JSON.stringify(body.releases[0])}`);
  if (args.dryRun) return;

  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  const base = `${API}/${encodeURIComponent(args.package)}`;

  const edit = (await client.request({ url: `${base}/edits`, method: 'POST', data: {} })).data;
  try {
    await client.request({ url: `${base}/edits/${edit.id}/tracks/${args.track}`, method: 'PUT', data: body });
    let committed;
    try {
      committed = (await client.request({ url: `${base}/edits/${edit.id}:commit`, method: 'POST' })).data;
    } catch (err) {
      // Com "publicação gerenciada" ou mudanças pendentes no Console, a Play recusa o envio
      // automático para revisão. Faz o commit sem enviar; um humano clica em "Enviar para revisão".
      if (!requiresManualReview(err.response && err.response.data)) throw err;
      committed = (await client.request({
        url: `${base}/edits/${edit.id}:commit?changesNotSentForReview=true`, method: 'POST',
      })).data;
      console.log('PENDENTE: a release foi gravada mas NÃO enviada para revisão. Abra o Play Console → ' +
        'Visão geral da publicação → "Enviar alterações para revisão".');
    }
    console.log(`OK commit do edit ${committed.id}: versionCode ${args.versionCode} em ${args.track}`);
  } catch (err) {
    await client.request({ url: `${base}/edits/${edit.id}`, method: 'DELETE' }).catch(() => {});
    const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Falha ao promover: ${detail}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { parseArgs, buildTrackBody, requiresManualReview };
