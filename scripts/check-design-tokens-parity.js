#!/usr/bin/env node
/**
 * check-design-tokens-parity.js (issue #2746)
 *
 * Valida que os tokens canônicos do shared/design-tokens.json aparecem em
 * todas as plataformas (web, Android :app, composeApp). Objetivo: pegar DRIFT,
 * não estilo. Sem dependências externas — só fs/path nativos.
 *
 * Tolerâncias:
 *  - Hex comparado case-insensitive.
 *  - Kotlin usa 0xFFRRGGBB; o prefixo de alpha 0xFF é ignorado (casa RRGGBB).
 *  - Web/TS usa #RRGGBB.
 *  - Radius/spacing comparam valores numéricos px/dp equivalentes.
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

function relative(file) {
  return path.relative(ROOT, file);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenHex(raw) {
  return `#${normalizeHex(raw).toUpperCase()}`;
}

function kotlinHex(raw) {
  return `0xFF${normalizeHex(raw).toUpperCase()}`;
}

function readRequiredFile(file, label, errors) {
  if (!fs.existsSync(file)) {
    errors.push(`[${label}] arquivo ausente: ${relative(file)}`);
    return null;
  }
  return fs.readFileSync(file, 'utf8');
}

function sliceBetween(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start === -1) return null;
  const end = endMarker ? content.indexOf(endMarker, start + startMarker.length) : -1;
  return end === -1 ? content.slice(start) : content.slice(start, end);
}

function extractTsObject(content, objectName) {
  const assignment = new RegExp(`\\b(?:export\\s+)?const\\s+${escapeRegExp(objectName)}\\s*(?::[^=\\n]+)?=\\s*\\{`, 'm');
  const property = new RegExp(`\\b${escapeRegExp(objectName)}\\s*:\\s*\\{`, 'm');
  const match = assignment.exec(content) || property.exec(content);
  if (!match) return null;

  const open = content.indexOf('{', match.index);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = open; i < content.length; i++) {
    const ch = content[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return content.slice(open, i + 1);
    }
  }
  return null;
}

function checkTsObjectHexes(content, objectName, expected, label, sourceFile, errors) {
  const object = extractTsObject(content, objectName);
  if (!object) {
    errors.push(`[${label}] objeto ausente: ${objectName} em ${relative(sourceFile)}`);
    return;
  }

  for (const [prop, rawHex] of Object.entries(expected)) {
    const expectedHex = tokenHex(rawHex);
    const re = new RegExp(`\\b${escapeRegExp(prop)}\\s*:\\s*['"]${escapeRegExp(expectedHex)}['"]`, 'i');
    if (!re.test(object)) {
      errors.push(`[${label}] ${objectName}.${prop} diverge — esperado ${expectedHex} em ${relative(sourceFile)}`);
    }
  }
}

function checkTsObjectNumbers(content, objectName, expected, label, sourceFile, errors) {
  const object = extractTsObject(content, objectName);
  if (!object) {
    errors.push(`[${label}] objeto ausente: ${objectName} em ${relative(sourceFile)}`);
    return;
  }

  for (const [prop, expectedValue] of Object.entries(expected)) {
    if (typeof expectedValue !== 'number') continue;
    const re = new RegExp(`\\b${escapeRegExp(prop)}\\s*:\\s*${expectedValue}\\b`);
    if (!re.test(object)) {
      errors.push(`[${label}] ${objectName}.${prop} diverge — esperado ${expectedValue} em ${relative(sourceFile)}`);
    }
  }
}

function checkTsObjectStrings(content, objectName, expected, label, sourceFile, errors) {
  const object = extractTsObject(content, objectName);
  if (!object) {
    errors.push(`[${label}] objeto ausente: ${objectName} em ${relative(sourceFile)}`);
    return;
  }

  for (const [prop, expectedValue] of Object.entries(expected)) {
    if (typeof expectedValue !== 'string') continue;
    const re = new RegExp(`\\b${escapeRegExp(prop)}\\s*:\\s*['"]${escapeRegExp(expectedValue)}['"]`);
    if (!re.test(object)) {
      errors.push(`[${label}] ${objectName}.${prop} diverge — esperado "${expectedValue}" em ${relative(sourceFile)}`);
    }
  }
}

function checkKotlinValHexes(content, expected, label, sourceFile, errors) {
  for (const [name, rawHex] of Object.entries(expected)) {
    const expectedHex = kotlinHex(rawHex);
    const re = new RegExp(`\\bval\\s+${escapeRegExp(name)}\\s*=\\s*Color\\(\\s*${expectedHex}\\s*\\)`, 'i');
    if (!re.test(content)) {
      errors.push(`[${label}] ${name} diverge — esperado Color(${expectedHex}) em ${relative(sourceFile)}`);
    }
  }
}

function checkGamificationParity(tokens, errors) {
  if (!tokens.gamification) {
    errors.push('[gamification] bloco `gamification` ausente em shared/design-tokens.json');
    return;
  }

  const webFile = path.join(ROOT, 'web', 'src', 'theme', 'index.ts');
  const webContent = readRequiredFile(webFile, 'web gamification tokens', errors);
  if (webContent) {
    checkTsObjectHexes(
      webContent,
      'gamificationColors',
      tokens.gamification,
      'web gamification token',
      webFile,
      errors
    );

    if (tokens.gamificationDark) {
      checkTsObjectHexes(
        webContent,
        'gamificationColorsDark',
        tokens.gamificationDark,
        'web dark gamification token',
        webFile,
        errors
      );
    }
  }

  const kotlinGamification = {
    Gold: tokens.gamification.gold,
    Silver: tokens.gamification.silver,
    Bronze: tokens.gamification.bronze,
    Diamond: tokens.gamification.diamond,
    Platinum: tokens.gamification.platinum,
    Champion: tokens.gamification.champion,
    Xp: tokens.gamification.xp,
    Level: tokens.gamification.level,
    Mvp: tokens.gamification.mvp,
    Streak: tokens.gamification.streak,
  };

  for (const platform of PLATFORMS.filter((platform) => platform.name !== 'web')) {
    const content = readRequiredFile(platform.file, `${platform.name} gamification tokens`, errors);
    if (!content) continue;
    checkKotlinValHexes(
      content,
      kotlinGamification,
      `${platform.name} gamification token`,
      platform.file,
      errors
    );
  }
}

function checkKotlinDpVals(content, expected, label, sourceFile, errors) {
  for (const [name, expectedValue] of Object.entries(expected)) {
    if (typeof expectedValue !== 'number') continue;
    const re = new RegExp(`\\bval\\s+${escapeRegExp(name)}\\s*=\\s*${expectedValue}\\.dp\\b`);
    if (!re.test(content)) {
      errors.push(`[${label}] ${name} diverge — esperado ${expectedValue}.dp em ${relative(sourceFile)}`);
    }
  }
}

function checkKotlinAliasAssignments(content, expected, label, sourceFile, errors) {
  for (const [name, rawTargets] of Object.entries(expected)) {
    const targets = Array.isArray(rawTargets) ? rawTargets : [rawTargets];
    const matched = targets.some((target) => {
      const re = new RegExp(`\\bval\\s+${escapeRegExp(name)}\\s*=\\s*${escapeRegExp(target)}\\b`);
      return re.test(content);
    });
    if (!matched) {
      errors.push(`[${label}] ${name} diverge — esperado alias para ${targets.join(' ou ')} em ${relative(sourceFile)}`);
    }
  }
}

function checkKotlinRoundedCornerShapes(content, expected, label, sourceFile, errors) {
  for (const [name, expectedValue] of Object.entries(expected)) {
    if (typeof expectedValue !== 'number') continue;
    const re = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*RoundedCornerShape\\(\\s*${expectedValue}\\.dp\\s*\\)`);
    if (!re.test(content)) {
      errors.push(`[${label}] ${name} diverge — esperado RoundedCornerShape(${expectedValue}.dp) em ${relative(sourceFile)}`);
    }
  }
}

function checkWebElevationParity(tokens, errors) {
  if (!tokens.elevation) {
    errors.push('[elevation] bloco `elevation` ausente em shared/design-tokens.json');
    return;
  }

  const file = path.join(ROOT, 'web', 'src', 'theme', 'index.ts');
  const content = readRequiredFile(file, 'web elevation tokens', errors);
  if (!content) return;

  checkTsObjectStrings(
    content,
    'shadowTokens',
    tokens.elevation,
    'web elevation token',
    file,
    errors
  );
}

function checkWebRadiusAndSpacing(tokens, errors) {
  const file = path.join(ROOT, 'web', 'src', 'theme', 'index.ts');
  const content = readRequiredFile(file, 'web radius/spacing', errors);
  if (!content) return;
  const spacing = tokens.spacing;

  checkTsObjectNumbers(content, 'radii', tokens.radius, 'web radius token', file, errors);

  const lightTheme = sliceBetween(content, 'export const futebaTheme = createTheme({', '// Dark theme');
  if (!lightTheme) {
    errors.push(`[web spacing token] futebaTheme ausente em ${relative(file)}`);
    return;
  }

  const spacingUnit = spacing && spacing.unit;
  if (typeof spacingUnit !== 'number') {
    errors.push('[spacing] token spacing.unit ausente ou inválido em shared/design-tokens.json');
    return;
  }

  const re = new RegExp(`\\bspacing\\s*:\\s*${spacingUnit}\\b`);
  if (!re.test(lightTheme)) {
    errors.push(`[web spacing token] spacing diverge — esperado spacing: ${spacingUnit} em ${relative(file)}`);
  }

  const pageTokensFile = path.join(ROOT, 'web', 'src', 'theme', 'pageTokens.ts');
  const pageTokensContent = readRequiredFile(pageTokensFile, 'web page tokens', errors);
  if (pageTokensContent) {
    const pageSpacingExpected = {
      sectionSpacing: spacing.md / spacingUnit,
      sectionSpacingLarge: spacing.lg / spacingUnit,
    };
    checkTsObjectNumbers(
      pageTokensContent,
      'pageSpacing',
      pageSpacingExpected,
      'web page spacing token',
      pageTokensFile,
      errors
    );
  }
}

function checkKotlinRadiusAndSpacing(tokens, errors) {
  const radius = tokens.radius;
  const spacing = tokens.spacing;
  if (!radius || !spacing) {
    errors.push('[radius/spacing] blocos `radius` ou `spacing` ausentes em shared/design-tokens.json');
    return;
  }

  const appDimensions = path.join(
    ROOT, 'app', 'src', 'main', 'java', 'com', 'futebadosparcas', 'ui', 'theme', 'AppDimensions.kt'
  );
  const appDimensionsContent = readRequiredFile(appDimensions, 'android :app dimensions', errors);
  if (appDimensionsContent) {
    checkKotlinDpVals(appDimensionsContent, {
      spacing_extraSmall: spacing.xs,
      spacing_small: spacing.sm,
      spacing_medium: spacing.md,
      spacing_large: spacing.lg,
      spacing_extraLarge: spacing.lg,
      spacing_huge: spacing.xl,
      spacing_massive: spacing.xxl,
    }, 'android :app spacing token', appDimensions, errors);

    checkKotlinDpVals(appDimensionsContent, {
      radius_small: radius.sm,
      radius_medium: radius.md,
      radius_large: radius.lg,
      radius_extraLarge: radius.xl,
      radius_full: radius.full,
    }, 'android :app radius token', appDimensions, errors);

    checkKotlinAliasAssignments(appDimensionsContent, {
      spacing_md: 'spacing_medium',
      spacing_lg: ['spacing_large', 'spacing_extraLarge'],
      spacing_xl: 'spacing_huge',
      spacing_xxl: 'spacing_massive',
      radius_xs: 'spacing_extraSmall',
      radius_sm: 'radius_small',
      radius_md: 'radius_medium',
      radius_lg: 'radius_large',
      radius_xl: 'radius_extraLarge',
    }, 'android :app spacing/radius alias token', appDimensions, errors);
  }

  const shapeExpected = {
    extraSmall: radius.xs,
    small: radius.sm,
    medium: radius.md,
    large: radius.lg,
    extraLarge: radius.xl,
  };

  for (const platform of PLATFORMS.filter((platform) => platform.name !== 'web')) {
    const shapeFile = platform.file.replace(/Color\.kt$/, 'Shape.kt');
    const content = readRequiredFile(shapeFile, `${platform.name} shape`, errors);
    if (content) {
      checkKotlinRoundedCornerShapes(content, shapeExpected, `${platform.name} shape token`, shapeFile, errors);
    }
  }

  const xmlDimens = path.join(ROOT, 'app', 'src', 'main', 'res', 'values', 'dimens.xml');
  const xmlContent = readRequiredFile(xmlDimens, 'android :app dimens.xml', errors);
  if (xmlContent) {
    const expectedDimens = {
      spacing_xs: spacing.xs,
      spacing_sm: spacing.sm,
      spacing_md: spacing.md,
      spacing_large: spacing.lg,
      spacing_lg: spacing.lg,
      spacing_xl: spacing.xl,
      spacing_xxl: spacing.xxl,
    };

    for (const [name, expectedValue] of Object.entries(expectedDimens)) {
      const re = new RegExp(`<dimen\\s+name=["']${escapeRegExp(name)}["']>\\s*${expectedValue}dp\\s*<\\/dimen>`);
      if (!re.test(xmlContent)) {
        errors.push(`[android :app dimens token] ${name} diverge — esperado ${expectedValue}dp em ${relative(xmlDimens)}`);
      }
    }
  }
}

function themeColorTags(html) {
  return [...html.matchAll(/<meta\b[^>]*\bname=["']theme-color["'][^>]*>/gi)].map((match) => {
    const tag = match[0];
    const attrs = {};
    for (const attr of tag.matchAll(/\b([a-zA-Z:-]+)=["']([^"']*)["']/g)) {
      attrs[attr[1].toLowerCase()] = attr[2];
    }
    return attrs;
  });
}

function checkWebThemeColor(tokens, errors) {
  const file = path.join(ROOT, 'web', 'index.html');
  const html = readRequiredFile(file, 'web theme-color', errors);
  if (!html) return;

  const tags = themeColorTags(html);
  const defaultTag = tags.find((tag) => !tag.media);
  const darkTag = tags.find((tag) => tag.media === '(prefers-color-scheme: dark)');
  const expectedDefault = tokenHex(tokens.brand.primary.hex);
  const expectedDark = tokenHex(tokens.darkPalette.primary.main);

  if (!defaultTag || defaultTag.content.toUpperCase() !== expectedDefault) {
    errors.push(`[web theme-color] default diverge — esperado ${expectedDefault} em ${relative(file)}`);
  }
  if (!darkTag || darkTag.content.toUpperCase() !== expectedDark) {
    errors.push(`[web theme-color] dark diverge — esperado ${expectedDark} em ${relative(file)}`);
  }
}

function checkWebSemanticPalette(tokens, errors) {
  const file = path.join(ROOT, 'web', 'src', 'theme', 'index.ts');
  const content = readRequiredFile(file, 'web semantic palette', errors);
  if (!content) return;

  checkTsObjectHexes(content, 'primary', tokens.palette.primary, 'web primary token', file, errors);
  checkTsObjectHexes(content, 'secondary', tokens.palette.secondary, 'web secondary token', file, errors);

  const lightTheme = sliceBetween(content, 'export const futebaTheme = createTheme({', '// Dark theme');
  const darkTheme = sliceBetween(content, 'export const futebaDarkTheme = createTheme({', 'export const futebaDarkOledTheme');
  if (!lightTheme) {
    errors.push(`[web semantic palette] futebaTheme ausente em ${relative(file)}`);
  } else {
    checkTsObjectHexes(lightTheme, 'error', tokens.palette.error, 'web light error token', file, errors);
    checkTsObjectHexes(lightTheme, 'warning', tokens.palette.warning, 'web light warning token', file, errors);
    checkTsObjectHexes(lightTheme, 'success', tokens.palette.success, 'web light success token', file, errors);
    checkTsObjectHexes(lightTheme, 'info', tokens.palette.info, 'web light info token', file, errors);
  }

  if (!darkTheme) {
    errors.push(`[web semantic palette] futebaDarkTheme ausente em ${relative(file)}`);
  } else {
    for (const [role, expected] of Object.entries(tokens.darkPalette)) {
      checkTsObjectHexes(darkTheme, role, expected, `web dark ${role} token`, file, errors);
    }
  }
}

function checkKotlinSemanticGreen(tokens, errors) {
  const expected = {
    md3_light_primary: tokens.palette.primary.main,
    md3_light_inversePrimary: tokens.darkPalette.primary.main,
    md3_dark_primary: tokens.darkPalette.primary.main,
    md3_dark_inversePrimary: tokens.palette.primary.main,
  };

  for (const platform of PLATFORMS.filter((platform) => platform.name !== 'web')) {
    const content = readRequiredFile(platform.file, platform.name, errors);
    if (!content) continue;
    checkKotlinValHexes(content, expected, `${platform.name} semantic green`, platform.file, errors);
  }
}

function checkSurfaceParity(tokens, errors) {
  const file = path.join(ROOT, 'web', 'src', 'theme', 'index.ts');
  const content = readRequiredFile(file, 'web surface tokens', errors);
  if (content) {
    const lightTheme = sliceBetween(content, 'export const futebaTheme = createTheme({', '// Dark theme');
    const darkTheme = sliceBetween(content, 'export const futebaDarkTheme = createTheme({', 'export const futebaDarkOledTheme');
    const webLightExpected = {
      surfaceDim: tokens.surface.light.dim,
      surfaceBright: tokens.surface.light.bright,
      surfaceContainerLowest: tokens.surface.light.containerLowest,
      surfaceContainerLow: tokens.surface.light.containerLow,
      surfaceContainer: tokens.surface.light.container,
      surfaceContainerHigh: tokens.surface.light.containerHigh,
      surfaceContainerHighest: tokens.surface.light.containerHighest,
    };
    const webDarkExpected = {
      surfaceDim: tokens.surface.dark.dim,
      surfaceBright: tokens.surface.dark.bright,
      surfaceContainerLowest: tokens.surface.dark.containerLowest,
      surfaceContainerLow: tokens.surface.dark.containerLow,
      surfaceContainer: tokens.surface.dark.container,
      surfaceContainerHigh: tokens.surface.dark.containerHigh,
      surfaceContainerHighest: tokens.surface.dark.containerHighest,
    };

    if (!lightTheme || !darkTheme) {
      errors.push(`[surface] temas web ausentes em ${relative(file)}`);
    } else {
      checkTsObjectHexes(lightTheme, 'palette', webLightExpected, 'web light surface token', file, errors);
      checkTsObjectHexes(darkTheme, 'palette', webDarkExpected, 'web dark surface token', file, errors);
    }
  }

  const lightExpected = {
    md3_light_surfaceDim: tokens.surface.light.dim,
    md3_light_surfaceBright: tokens.surface.light.bright,
    md3_light_surfaceContainerLowest: tokens.surface.light.containerLowest,
    md3_light_surfaceContainerLow: tokens.surface.light.containerLow,
    md3_light_surfaceContainer: tokens.surface.light.container,
    md3_light_surfaceContainerHigh: tokens.surface.light.containerHigh,
    md3_light_surfaceContainerHighest: tokens.surface.light.containerHighest,
  };

  const darkExpected = {
    md3_dark_surfaceDim: tokens.surface.dark.dim,
    md3_dark_surfaceBright: tokens.surface.dark.bright,
    md3_dark_surfaceContainerLowest: tokens.surface.dark.containerLowest,
    md3_dark_surfaceContainerLow: tokens.surface.dark.containerLow,
    md3_dark_surfaceContainer: tokens.surface.dark.container,
    md3_dark_surfaceContainerHigh: tokens.surface.dark.containerHigh,
    md3_dark_surfaceContainerHighest: tokens.surface.dark.containerHighest,
  };

  for (const platform of PLATFORMS.filter((platform) => platform.name !== 'web')) {
    const content = readRequiredFile(platform.file, `${platform.name} surface tokens`, errors);
    if (!content) continue;
    checkKotlinValHexes(content, lightExpected, `${platform.name} light surface token`, platform.file, errors);
    checkKotlinValHexes(content, darkExpected, `${platform.name} dark surface token`, platform.file, errors);
  }
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

  // Checks semânticos focados: os valores precisam estar nos roles certos, não
  // apenas aparecer em algum lugar do arquivo.
  checkWebThemeColor(tokens, errors);
  checkWebSemanticPalette(tokens, errors);
  checkKotlinSemanticGreen(tokens, errors);
  checkGamificationParity(tokens, errors);
  checkSurfaceParity(tokens, errors);

  // Paridade de radius + spacing — issue #2744.
  checkWebRadiusAndSpacing(tokens, errors);
  checkKotlinRadiusAndSpacing(tokens, errors);
  checkWebElevationParity(tokens, errors);

  // Paridade de motion (durations + easings) — issue #2755.
  checkMotionParity(tokens, errors);

  if (errors.length > 0) {
    console.error('✗ DRIFT de design tokens detectado:');
    for (const e of errors) console.error('  - ' + e);
    console.error(`\nTotal: ${errors.length} divergência(s). Fonte canônica: shared/design-tokens.json`);
    process.exit(1);
  }

  console.log('✓ design tokens em paridade (cores + gamificação + radius + spacing + surface + elevation + motion)');
  process.exit(0);
}

main();
