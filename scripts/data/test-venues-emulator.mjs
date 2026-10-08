#!/usr/bin/env node
/* eslint-disable */
/**
 * Teste de integração contra o EMULADOR do Firestore: prova a idempotência do
 * importador de venues e do repair snake_case (#4193) — sem tocar produção.
 *
 * Pré-requisito: emulador Firestore rodando (projeto demo-*), ex.:
 *   firebase emulators:start --only firestore --project demo-venues-test
 * Uso:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 VENUES_PROJECT_ID=demo-venues-test \
 *   NODE_PATH=functions/node_modules node scripts/data/test-venues-emulator.mjs
 * Variáveis opcionais: TSX_CLI (caminho do cli.mjs do tsx; padrão: npx tsx),
 *   VENUES_TEST_DATASETS (lista de datasets reais separados por vírgula para
 *   também provar idempotência com eles).
 *
 * Segurança: aborta se FIRESTORE_EMULATOR_HOST não estiver definido ou se o
 * projeto não começar com "demo-".
 */
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const require = createRequire(path.join(repoRoot, 'functions', 'package.json'));
const admin = require('firebase-admin');

const PROJECT = process.env.VENUES_PROJECT_ID;
if (!process.env.FIRESTORE_EMULATOR_HOST || !PROJECT || !PROJECT.startsWith('demo-')) {
  console.error('✗ Recusado: exige FIRESTORE_EMULATOR_HOST e VENUES_PROJECT_ID=demo-*.');
  process.exit(2);
}
admin.initializeApp({projectId: PROJECT});
const db = admin.firestore();

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({name, ok: true});
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({name, ok: false, error: err.message});
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function runTs(script, args) {
  const tsxCli = process.env.TSX_CLI;
  const cmd = tsxCli ? process.execPath : 'npx';
  const full = tsxCli ? [tsxCli, script, ...args] : ['tsx', script, ...args];
  return execFileSync(cmd, full, {
    cwd: repoRoot, encoding: 'utf8', shell: !tsxCli && process.platform === 'win32',
    env: process.env, timeout: 180000,
  });
}

async function clearAll() {
  const refs = await db.collection('locations').listDocuments();
  for (const ref of refs) await db.recursiveDelete(ref);
}

async function snapshotAll() {
  const out = {};
  const locs = await db.collection('locations').get();
  for (const l of locs.docs) {
    out[l.id] = JSON.stringify(l.data());
    const fs_ = await l.ref.collection('fields').get();
    for (const f of fs_.docs) out[`${l.id}/${f.id}`] = JSON.stringify(f.data());
  }
  return out;
}

const hasCamel = (obj) => Object.keys(obj).filter((k) => /^[a-z]+[A-Z]/.test(k));

async function seedLegacy() {
  const legacy = (name, extra = {}) => ({
    name, city: 'Curitiba', state: 'PR',
    ownerId: 'system-venue-import', isVerified: false, isActive: true,
    publicationStatus: 'DRAFT', ratingCount: 0, photoUrl: null,
    timeZone: 'America/Sao_Paulo', openingTime: '08:00', closingTime: '23:59',
    operatingDays: [1, 2, 3, 4, 5, 6, 0], minGameDurationMinutes: 60,
    fieldCount: 0, hasActiveFields: false,
    // calculados pelas Cloud Functions (snake já existe e é a verdade)
    rating_count: 0, field_count: extra.field_count ?? 0, has_active_fields: extra.has_active_fields ?? false,
    rating: 0, external_data: {imported_by: 'venue-dataset-import', confidence: 'media'},
    updated_by: 'venue-dataset-import',
    ...extra.doc,
  });
  const a = db.collection('locations').doc('legacy-a');
  const b = db.collection('locations').doc('legacy-b');
  await a.set(legacy('Legado A', {field_count: 2, has_active_fields: true}));
  await b.set(legacy('Legado B'));
  for (const i of [1, 2]) {
    await a.collection('fields').doc(`f${i}`).set({
      name: `Quadra ${i}`, type: 'SOCIETY', isActive: true, hourlyPrice: 120,
      isCovered: false, minBookingMinutes: 60, photoUrl: null, playersPerTeam: 7,
    });
  }
  // pré-existente snake com camelCase legado DIVERGENTE: precisa de revisão manual.
  await db.collection('locations').doc('pre-existing').set({
    name: 'Pré-existente', city: 'Curitiba', owner_id: 'mock_admin', is_verified: true,
    is_active: false, publication_status: 'SUSPENDED', isActive: true,
    external_data: {imported_by: 'venue-dataset-import'},
  });
}

const miniDataset = {
  gerado_em: '2026-10-07', rodada: 3, cidade: 'Pinhais', uf: 'PR',
  venues: [
    {
      nome: 'Arena Teste Um', endereco: {rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Pinhais', uf: 'PR', cep: '83320-000'},
      telefone: '(41) 3000-0001', qtd_quadras: 2, detalhe_quadras: '2 quadras society', tipo_piso: 'society',
      horarios: {segunda: '08:00-23:00', terca: '08:00-23:00'}, coordenadas: {lat: -25.44, lon: -49.19},
      fontes: [{url: 'https://example.com/um', dado: 'teste'}], confidence: 'alta', finalidade: 'comercial_aluguel', origem: 'web', rodada_dados: 'R3',
    },
    {
      nome: 'Arena Teste Dois', endereco: {cidade: 'Colombo', uf: 'PR'}, qtd_quadras: null,
      fontes: [{url: 'https://example.com/dois', dado: 'teste'}], confidence: 'baixa',
    },
    {
      nome: 'Arena Teste Um', endereco: {cidade: 'Colombo', uf: 'PR'}, qtd_quadras: 1, detalhe_quadras: '1 quadra futsal',
      fontes: [{url: 'https://example.com/um-colombo', dado: 'homônimo em outra cidade'}], confidence: 'média',
    },
  ],
};

async function importerProof(label, datasetPath) {
  console.log(`\n== Importador: ${label}`);
  const venues = JSON.parse(fs.readFileSync(datasetPath, 'utf8')).venues.length;
  const before = Object.keys(await snapshotAll()).length;
  const dry = runTs('scripts/data/import-venues-dataset.ts', ['--dataset', datasetPath]);
  const afterDry = Object.keys(await snapshotAll()).length;
  check(`${label}: dry-run não escreve`, () => assert.equal(afterDry, before));
  const run1 = runTs('scripts/data/import-venues-dataset.ts', ['--dataset', datasetPath, '--execute', '--owner-uid', 'system-venue-import']);
  const s1 = await snapshotAll();
  const created = Object.keys(s1).length - before;
  const locs1 = (await db.collection('locations').get()).size;
  check(`${label}: 1ª execução cria documentos`, () => assert.ok(created >= venues, `criou ${created}`));
  const run2 = runTs('scripts/data/import-venues-dataset.ts', ['--dataset', datasetPath, '--execute', '--owner-uid', 'system-venue-import']);
  const s2 = await snapshotAll();
  check(`${label}: 2ª execução NÃO cria locations/quadras novas`, () => {
    assert.equal(Object.keys(s2).length, Object.keys(s1).length);
    assert.equal((run2.match(/(\d+) criar/) || [])[1], '0', 'plano da 2ª execução deve ter 0 criar');
  });
  check(`${label}: 2ª execução só enriquece (patch = todos)`, () => {
    const n = (txt, re) => Number((txt.match(re) || [])[1]);
    assert.equal(n(run2, /(\d+) enriquecer/), n(run1, /(\d+) criar/) + n(run1, /(\d+) enriquecer/));
    assert.equal(n(run2, /(\d+) criar/), 0);
  });
  const locs = await db.collection('locations').get();
  const imported = locs.docs.filter((d) => d.get('updated_by') === 'venue-dataset-import' && d.get('owner_id') === 'system-venue-import');
  check(`${label}: docs importados em snake_case, DRAFT e não verificados`, () => {
    assert.ok(imported.length > 0);
    for (const d of imported) {
      assert.deepEqual(hasCamel(d.data()).filter((k) => k !== 'external_data'), [], `${d.get('name')} tem camelCase`);
      assert.equal(d.get('publication_status'), 'DRAFT');
      assert.equal(d.get('is_verified'), false);
    }
  });
  const dry3 = runTs('scripts/data/import-venues-dataset.ts', ['--dataset', datasetPath]);
  check(`${label}: dry-run final = 0 criar`, () => assert.match(dry3, /Plano: 0 criar/));
  return {created, locs1, run1Plan: run1.match(/Plano: .*/)[0], run2Plan: run2.match(/Plano: .*/)[0], dry: dry.match(/Plano: .*/)[0]};
}

async function main() {
  console.log(`Emulador: ${process.env.FIRESTORE_EMULATOR_HOST} projeto ${PROJECT}`);
  await clearAll();

  console.log('\n== Repair snake_case');
  await seedLegacy();
  const seeded = await snapshotAll();
  const planFile = path.join(os.tmpdir(), `venues-repair-plan-${Date.now()}.json`);
  runTs('scripts/data/repair-venues-snake-case.ts', ['--plan-out', planFile]);
  const afterDry = await snapshotAll();
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  check('repair dry-run não escreve', () => assert.deepEqual(afterDry, seeded));
  check('plano: 2 a corrigir (+2 quadras), 1 revisão manual', () => {
    assert.equal(plan.totals.locations_to_fix, 2);
    assert.equal(plan.totals.fields_to_fix, 2);
    assert.equal(plan.totals.locations_manual_review, 1);
    assert.equal(plan.write_performed, false);
  });
  runTs('scripts/data/repair-venues-snake-case.ts', ['--execute']);
  const a = (await db.collection('locations').doc('legacy-a').get()).data();
  const b = (await db.collection('locations').doc('legacy-b').get()).data();
  check('repair --execute remove camelCase e preserva snake calculado (field_count=2)', () => {
    assert.deepEqual(hasCamel(a).filter((k) => k !== 'external_data'), []);
    assert.deepEqual(hasCamel(b).filter((k) => k !== 'external_data'), []);
    assert.equal(a.field_count, 2);
    assert.equal(a.has_active_fields, true);
    assert.equal(a.owner_id, 'system-venue-import');
    assert.equal(a.publication_status, 'DRAFT');
    assert.equal(a.is_verified, false);
  });
  const f1 = (await db.collection('locations').doc('legacy-a').collection('fields').doc('f1').get()).data();
  check('repair converte quadras (hourly_price, is_active, players_per_team)', () => {
    assert.deepEqual(hasCamel(f1), []);
    assert.equal(f1.hourly_price, 120);
    assert.equal(f1.players_per_team, 7);
    assert.equal(f1.is_active, true);
  });
  const pre = (await db.collection('locations').doc('pre-existing').get()).data();
  check('pré-existente SUSPENDED/verificado/divergente NÃO é tocado', () => {
    assert.equal(pre.publication_status, 'SUSPENDED');
    assert.equal(pre.is_verified, true);
    assert.equal(pre.isActive, true);
  });
  const mid = await snapshotAll();
  const plan2File = path.join(os.tmpdir(), `venues-repair-plan2-${Date.now()}.json`);
  runTs('scripts/data/repair-venues-snake-case.ts', ['--execute', '--plan-out', plan2File]);
  const plan2 = JSON.parse(fs.readFileSync(plan2File, 'utf8'));
  const after2 = await snapshotAll();
  check('repair é idempotente (2ª execução: 0 a corrigir, nenhum doc muda)', () => {
    assert.equal(plan2.totals.locations_to_fix, 0);
    assert.equal(plan2.totals.fields_to_fix, 0);
    assert.deepEqual(after2, mid);
  });

  await clearAll();
  const tmpDataset = path.join(os.tmpdir(), `venues-mini-${Date.now()}.json`);
  fs.writeFileSync(tmpDataset, JSON.stringify(miniDataset));
  // location pré-existente com nome diferente mas MESMO endereço (rua+número):
  // o importador deve enriquecer (não duplicar) e preservar status/verificação.
  await db.collection('locations').doc('pre-addr').set({
    name: 'Arena Teste Um Futebol e Diversão', city: 'Pinhais', street: 'Av. Rua A', number: '10',
    owner_id: 'mock_admin', is_verified: true, publication_status: 'SUSPENDED', phone: null,
  });
  const summary = {mini: await importerProof('dataset sintético', tmpDataset)};
  const pinhais = await db.collection('locations').where('city', '==', 'Pinhais').get();
  const preAddr = (await db.collection('locations').doc('pre-addr').get()).data();
  check('dedupe por endereço: sem duplicata em Pinhais, status/verificação preservados e telefone preenchido', () => {
    assert.equal(pinhais.size, 1);
    assert.equal(preAddr.publication_status, 'SUSPENDED');
    assert.equal(preAddr.is_verified, true);
    assert.equal(preAddr.owner_id, 'mock_admin');
    assert.equal(preAddr.phone, '(41) 3000-0001');
  });

  const extra = (process.env.VENUES_TEST_DATASETS || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const ds of extra) {
    await clearAll();
    summary[path.basename(ds)] = await importerProof(path.basename(ds), path.resolve(ds));
  }
  await clearAll();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResumo: ${results.length - failed.length}/${results.length} verificações OK`);
  console.log('SUMMARY_JSON ' + JSON.stringify({results, summary}));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => { console.error('✗ Falha fatal:', err); process.exit(1); });
