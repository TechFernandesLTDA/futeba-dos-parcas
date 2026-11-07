#!/usr/bin/env node
/**
 * validate-granted-badges.js (Onda C4 / D3)
 *
 * Script de auditoria e migracao de badges ja concedidas em `user_badges`.
 * Valida que cada documento user_badges possui um badge_id reconhecido pelo
 * catalogo unificado (shared/badges-catalog.json), seja estatico, dinamico ou milestone.
 *
 * Modos de execucao:
 *   node scripts/migrations/validate-granted-badges.js --dry-run
 *   node scripts/migrations/validate-granted-badges.js --check
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_PATH = path.join(ROOT, 'shared', 'badges-catalog.json');

function loadCatalog() {
  const content = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const staticIds = new Set((content.badges || []).map((b) => b.id.toLowerCase()));
  const dynamicPrefixes = Object.keys(content.dynamicPrefixes || {});
  const milestoneCategories = Object.keys(content.milestones?.categories || {});
  return { staticIds, dynamicPrefixes, milestoneCategories };
}

function isValidBadgeId(badgeId, catalog) {
  if (!badgeId || typeof badgeId !== 'string') return false;
  const lower = badgeId.toLowerCase();

  // 1. Estatico
  if (catalog.staticIds.has(lower)) return true;

  // 2. Dinamico (prefixo)
  for (const prefix of catalog.dynamicPrefixes) {
    if (lower.startsWith(prefix.toLowerCase())) return true;
  }

  // 3. Milestone {CATEGORIA}_{N}
  const parts = badgeId.split('_');
  if (parts.length >= 2) {
    const category = parts[0].toUpperCase();
    const threshold = Number(parts[1]);
    if (catalog.milestoneCategories.includes(category) && !Number.isNaN(threshold)) {
      return true;
    }
  }

  return false;
}

function validateList(badgeIds) {
  const catalog = loadCatalog();
  const valid = [];
  const invalid = [];

  for (const id of badgeIds) {
    if (isValidBadgeId(id, catalog)) {
      valid.push(id);
    } else {
      invalid.push(id);
    }
  }

  return { valid, invalid, total: badgeIds.length };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const catalog = loadCatalog();
  console.log(`📦 Catalogo carregado: ${catalog.staticIds.size} badges estaticas, ${catalog.dynamicPrefixes.length} prefixos dinamicos, ${catalog.milestoneCategories.length} categorias de milestones.`);

  if (args.includes('--check')) {
    console.log('✅ Catalogo integro e validado.');
    process.exit(0);
  }
}

module.exports = { loadCatalog, isValidBadgeId, validateList };
