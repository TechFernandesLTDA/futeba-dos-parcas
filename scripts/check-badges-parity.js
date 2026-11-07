#!/usr/bin/env node
/**
 * check-badges-parity.js (Onda C4 / D3)
 *
 * Valida que o catalogo canonico de badges em shared/badges-catalog.json
 * esta 100% sincronizado entre as plataformas:
 *  - web (web/src/types/gamification.ts -> BADGE_DEFINITIONS)
 *  - android :app (app/src/main/java/.../BadgeCatalog.kt -> entries)
 *
 * Sem dependencias externas — somente Node.js nativo (fs, path).
 * Saida: exit(1) se houver drift; exit(0) se consistente.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const CATALOG_JSON_PATH = path.join(ROOT, 'shared', 'badges-catalog.json');
const WEB_GAMIFICATION_PATH = path.join(ROOT, 'web', 'src', 'types', 'gamification.ts');
const ANDROID_CATALOG_PATH = path.join(
  ROOT,
  'app', 'src', 'main', 'java', 'com', 'futebadosparcas', 'data', 'model', 'BadgeCatalog.kt'
);

function relative(p) {
  return path.relative(ROOT, p);
}

function runCheck() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(CATALOG_JSON_PATH)) {
    errors.push(`[shared] Arquivo ausente: ${relative(CATALOG_JSON_PATH)}`);
    return { ok: false, errors, warnings };
  }

  const catalogRaw = JSON.parse(fs.readFileSync(CATALOG_JSON_PATH, 'utf8'));
  const catalogBadges = catalogRaw.badges || [];
  const catalogMap = new Map();
  for (const b of catalogBadges) {
    catalogMap.set(b.id, b);
  }

  // 1. Validar Web (gamification.ts)
  if (!fs.existsSync(WEB_GAMIFICATION_PATH)) {
    errors.push(`[web] Arquivo ausente: ${relative(WEB_GAMIFICATION_PATH)}`);
  } else {
    const webContent = fs.readFileSync(WEB_GAMIFICATION_PATH, 'utf8');
    const webBadgeIds = new Set();
    const regex = /id:\s*'([^']+)'/g;
    let match;
    while ((match = regex.exec(webContent)) !== null) {
      webBadgeIds.add(match[1]);
    }

    for (const badge of catalogBadges) {
      if (!webBadgeIds.has(badge.id)) {
        errors.push(`[web] Badge '${badge.id}' definida no catalogo compartilhado mas ausente em ${relative(WEB_GAMIFICATION_PATH)}`);
      }
    }
  }

  // 2. Validar Android (BadgeCatalog.kt)
  if (!fs.existsSync(ANDROID_CATALOG_PATH)) {
    errors.push(`[android] Arquivo ausente: ${relative(ANDROID_CATALOG_PATH)}`);
  } else {
    const androidContent = fs.readFileSync(ANDROID_CATALOG_PATH, 'utf8');
    const androidBadgeIds = new Set();
    // Procura chaves do mapa entries: "badge_id" to Entry(...)
    const entryRegex = /"([^"]+)"\s*to\s*Entry\(/g;
    let match;
    while ((match = entryRegex.exec(androidContent)) !== null) {
      androidBadgeIds.add(match[1].toLowerCase());
    }

    for (const badge of catalogBadges) {
      const normalizedId = badge.id.toLowerCase();
      if (!androidBadgeIds.has(normalizedId)) {
        errors.push(`[android] Badge '${badge.id}' definida no catalogo compartilhado mas ausente em ${relative(ANDROID_CATALOG_PATH)}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    count: catalogBadges.length,
  };
}

if (require.main === module) {
  const result = runCheck();
  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn(`⚠️  ${w}`);
    }
  }

  if (!result.ok) {
    console.error('❌ Paridade de Badges falhou:');
    for (const err of result.errors) {
      console.error(`   - ${err}`);
    }
    process.exit(1);
  }

  console.log(`✅ Paridade de Badges verificada: ${result.count} badges sincronizadas entre shared, web e Android.`);
  process.exit(0);
}

module.exports = { runCheck };
