#!/usr/bin/env node

/**
 * Seed idempotente da coleção favorite_teams.
 *
 * Uso:
 *   GOOGLE_CLOUD_PROJECT=futebadosparcas node scripts/seed-favorite-teams.js
 *
 * Requer Application Default Credentials ou ambiente Firebase/GCP autenticado.
 */

const admin = require('firebase-admin');

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'futebadosparcas';

const teams = [
  { id: 'america-mg', name: 'América-MG', short_name: 'AME', category: 'Série B', state: 'MG' },
  { id: 'athletico-pr', name: 'Athletico-PR', short_name: 'CAP', category: 'Série A', state: 'PR' },
  { id: 'atletico-mg', name: 'Atlético-MG', short_name: 'CAM', category: 'Série A', state: 'MG' },
  { id: 'avai', name: 'Avaí', short_name: 'AVA', category: 'Série B', state: 'SC' },
  { id: 'bahia', name: 'Bahia', short_name: 'BAH', category: 'Série A', state: 'BA' },
  { id: 'botafogo', name: 'Botafogo', short_name: 'BOT', category: 'Série A', state: 'RJ' },
  { id: 'brasil', name: 'Brasil', short_name: 'BRA', category: 'Seleção', state: null },
  { id: 'ceara', name: 'Ceará', short_name: 'CEA', category: 'Série A', state: 'CE' },
  { id: 'corinthians', name: 'Corinthians', short_name: 'COR', category: 'Série A', state: 'SP' },
  { id: 'coritiba', name: 'Coritiba', short_name: 'CTB', category: 'Série B', state: 'PR' },
  { id: 'criciuma', name: 'Criciúma', short_name: 'CRI', category: 'Série B', state: 'SC' },
  { id: 'cruzeiro', name: 'Cruzeiro', short_name: 'CRU', category: 'Série A', state: 'MG' },
  { id: 'cuiaba', name: 'Cuiabá', short_name: 'CUI', category: 'Série B', state: 'MT' },
  { id: 'flamengo', name: 'Flamengo', short_name: 'FLA', category: 'Série A', state: 'RJ' },
  { id: 'fluminense', name: 'Fluminense', short_name: 'FLU', category: 'Série A', state: 'RJ' },
  { id: 'fortaleza', name: 'Fortaleza', short_name: 'FOR', category: 'Série A', state: 'CE' },
  { id: 'goias', name: 'Goiás', short_name: 'GOI', category: 'Série B', state: 'GO' },
  { id: 'gremio', name: 'Grêmio', short_name: 'GRE', category: 'Série A', state: 'RS' },
  { id: 'internacional', name: 'Internacional', short_name: 'INT', category: 'Série A', state: 'RS' },
  { id: 'juventude', name: 'Juventude', short_name: 'JUV', category: 'Série A', state: 'RS' },
  { id: 'mirassol', name: 'Mirassol', short_name: 'MIR', category: 'Série A', state: 'SP' },
  { id: 'nao-torcedor', name: 'Não torce para time nenhum', short_name: '-', category: 'Outros', state: null },
  { id: 'outro', name: 'Outro time', short_name: '?', category: 'Outros', state: null },
  { id: 'palmeiras', name: 'Palmeiras', short_name: 'PAL', category: 'Série A', state: 'SP' },
  { id: 'santos', name: 'Santos', short_name: 'SAN', category: 'Série A', state: 'SP' },
  { id: 'sao-paulo', name: 'São Paulo', short_name: 'SPO', category: 'Série A', state: 'SP' },
  { id: 'sport', name: 'Sport', short_name: 'SPT', category: 'Série A', state: 'PE' },
  { id: 'vasco', name: 'Vasco', short_name: 'VAS', category: 'Série A', state: 'RJ' },
  { id: 'vitoria', name: 'Vitória', short_name: 'VIT', category: 'Série A', state: 'BA' },
];

async function main() {
  admin.initializeApp({ projectId });
  const db = admin.firestore();
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const team of teams) {
    const { id, ...data } = team;
    batch.set(
      db.collection('favorite_teams').doc(id),
      {
        ...data,
        badge_url: null,
        active: true,
        source: 'seed-favorite-teams',
        updated_at: now,
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log(`Seeded ${teams.length} favorite teams into project ${projectId}.`);
}

main().catch((err) => {
  console.error(err && (err.stack || err.message || err));
  process.exit(1);
});
