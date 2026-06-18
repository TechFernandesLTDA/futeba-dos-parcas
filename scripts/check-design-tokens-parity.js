#!/usr/bin/env node
/**
 * check-design-tokens-parity.js (issue #2746)
 *
 * Valida que os hex canônicos do shared/design-tokens.json aparecem em todas
 * as plataformas (web, Android :app, composeApp). Objetivo: pegar DRIFT, não
 * estilo. Sem dependências externas — só fs/path nativos.
 *
 * Tolerâncias:
 *  - Hex comparado case-insensitive.
 *  - Kotlin usa 0xFFRRGGBB; o prefixo de alpha 0xFF é ignorado (casa RRGGBB).
 *  - Web/TS usa #RRGGBB.
 *
 * Saída: lista erros e exit(1) se houver drift; senão exit(0).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TOKENS_PATH = path.join(ROOT, 'shared', 'design-tokens.json');

const PLATFORMS = [
  {
    name: 'web',
    file: path.join(ROOT, 'web', 'src', 'theme', 'index.ts'),
  },
  {
    name: 'android :app',
    file: path.join(
      ROOT,
      'app', 'src', 'main', 'java', 'com', 'futebadosparcas', 'ui', 'theme', 'Color.kt'
    ),
  },
  {
    name: 'composeApp',
    file: path.join(
      ROOT,
      'composeApp', 'src', 'commonMain', 'kotlin', 'com', 'futebadosparcas', 'ui', 'theme', 'Color.kt'
    ),
  },
];

/** Normaliza hex para 6 dígitos minúsculos sem '#'/'0x'/alpha. */
function normalizeHex(raw) {
  let h = String(raw).trim().toLowerCase();
  h = h.replace(/^#/, '').replace(/^0x/, '');
  // Remove prefixo alpha 0xFF (8 dígitos -> 6).
  if (h.length === 8 && h.startsWith('ff')) {
    h = h.slice(2);
  }
  return h;
}

/** Verifica se o texto contém o hex canônico (em qualquer formato suportado). */
function fileContainsHex(haystackLower, canonicalHex6) {
  // Casa #RRGGBB, 0xFFRRGGBB e 0xRRGGBB.
  const re = new RegExp('(?:#|0x(?:ff)?)' + canonicalHex6, 'i');
  return re.test(haystackLower);
}

function main() {
  if (!fs.existsSync(TOKENS_PATH)) {
    console.error(`[parity] design-tokens.json não encontrado em ${TOKENS_PATH}`);
    process.exit(1);
  }

  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));

  // Tokens canônicos a validar (nome -> hex).
  const canonical = {
    'brand.primary': tokens.brand.primary.hex,
    'gamification.gold': tokens.gamification.gold,
    'gamification.silver': tokens.gamification.silver,
    'gamification.bronze': tokens.gamification.bronze,
    'gamification.diamond': tokens.gamification.diamond,
    'gamification.platinum': tokens.gamification.platinum,
    'gamification.champion': tokens.gamification.champion,
    'gamification.xp': tokens.gamification.xp,
    'gamification.level': tokens.gamification.level,
    'gamification.streak': tokens.gamification.streak,
  };

  const errors = [];

  for (const platform of PLATFORMS) {
    if (!fs.existsSync(platform.file)) {
      errors.push(`[${platform.name}] arquivo de tema ausente: ${platform.file}`);
      continue;
    }
    const content = fs.readFileSync(platform.file, 'utf8').toLowerCase();

    for (const [tokenName, hexRaw] of Object.entries(canonical)) {
      const hex6 = normalizeHex(hexRaw);
      if (!fileContainsHex(content, hex6)) {
        errors.push(
          `[${platform.name}] token ausente: ${tokenName} (#${hex6.toUpperCase()}) — esperado em ${path.relative(ROOT, platform.file)}`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error('✗ DRIFT de design tokens detectado:');
    for (const e of errors) console.error('  - ' + e);
    console.error(`\nTotal: ${errors.length} divergência(s). Fonte canônica: shared/design-tokens.json`);
    process.exit(1);
  }

  console.log('✓ design tokens em paridade');
  process.exit(0);
}

main();
