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

// ==========================================
// Paridade de MOTION (durations + easings) — issue #2755
// ==========================================

/**
 * Arquivos de motion por plataforma. Cada plataforma declara durations/easings
 * derivados de shared/design-tokens.json#motion; este check pega DRIFT de valor.
 */
const MOTION_FILES = [
  {
    name: 'web motion.ts',
    file: path.join(ROOT, 'web', 'src', 'theme', 'motion.ts'),
  },
  {
    name: 'android :app AppMotion.kt',
    file: path.join(
      ROOT,
      'app', 'src', 'main', 'java', 'com', 'futebadosparcas', 'ui', 'theme', 'AppMotion.kt'
    ),
  },
  {
    name: 'composeApp Motion.kt',
    file: path.join(
      ROOT,
      'composeApp', 'src', 'commonMain', 'kotlin', 'com', 'futebadosparcas', 'ui', 'theme', 'Motion.kt'
    ),
  },
];

/** Verifica se o número aparece como token isolado (não como substring). */
function fileContainsNumber(content, n) {
  const re = new RegExp('(?<![\\d.])' + n + '(?![\\d.])');
  return re.test(content);
}

/**
 * Constrói os padrões de easing aceitos a partir de [x1, y1, x2, y2].
 * Aceita o formato CSS `cubic-bezier(0.2, 0, 0, 1)` (web) e o Kotlin
 * `CubicBezierEasing(0.2f, 0f, 0f, 1f)` (Android/composeApp).
 */
function easingPatterns(curve) {
  const cssNums = curve.map((v) => String(v));
  const kotlinNums = curve.map((v) => `${v}f`);
  const css = new RegExp(
    'cubic-bezier\\(\\s*' + cssNums.map((n) => n.replace('.', '\\.')).join('\\s*,\\s*') + '\\s*\\)'
  );
  const kotlin = new RegExp(
    'cubicbeziereasing\\(\\s*' + kotlinNums.map((n) => n.replace('.', '\\.')).join('\\s*,\\s*') + '\\s*\\)'
  );
  return { css, kotlin };
}

/** Valida durations e easings do bloco `motion` em todas as plataformas. */
function checkMotionParity(tokens, errors) {
  const motion = tokens.motion;
  if (!motion || !motion.duration || !motion.easing) {
    errors.push('[motion] bloco `motion` ausente ou incompleto em shared/design-tokens.json');
    return;
  }

  // Durations canônicas a validar (ignora as *Reduced=0, que são triviais).
  const durations = {
    short: motion.duration.short,
    medium: motion.duration.medium,
    long: motion.duration.long,
  };

  // Easings canônicas (cada curva é um array [x1,y1,x2,y2]).
  const easings = motion.easing;

  for (const platform of MOTION_FILES) {
    if (!fs.existsSync(platform.file)) {
      errors.push(`[${platform.name}] arquivo de motion ausente: ${path.relative(ROOT, platform.file)}`);
      continue;
    }
    const content = fs.readFileSync(platform.file, 'utf8').toLowerCase();

    for (const [name, value] of Object.entries(durations)) {
      if (!fileContainsNumber(content, value)) {
        errors.push(
          `[${platform.name}] duration ausente: motion.duration.${name} (${value}ms) — esperado em ${path.relative(ROOT, platform.file)}`
        );
      }
    }

    for (const [name, curve] of Object.entries(easings)) {
      const { css, kotlin } = easingPatterns(curve);
      if (!css.test(content) && !kotlin.test(content)) {
        errors.push(
          `[${platform.name}] easing ausente: motion.easing.${name} ([${curve.join(', ')}]) — esperado em ${path.relative(ROOT, platform.file)}`
        );
      }
    }
  }
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

  // Paridade de motion (durations + easings) — issue #2755.
  checkMotionParity(tokens, errors);

  if (errors.length > 0) {
    console.error('✗ DRIFT de design tokens detectado:');
    for (const e of errors) console.error('  - ' + e);
    console.error(`\nTotal: ${errors.length} divergência(s). Fonte canônica: shared/design-tokens.json`);
    process.exit(1);
  }

  console.log('✓ design tokens em paridade (cores + motion)');
  process.exit(0);
}

main();
