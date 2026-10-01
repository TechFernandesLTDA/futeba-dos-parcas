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
    // `file` continua apontando para Color.kt porque checkKotlinRadiusAndSpacing
    // deriva Shape.kt a partir dele.
    file: path.join(
      ROOT,
      'composeApp', 'src', 'commonMain', 'kotlin', 'com', 'futebadosparcas', 'ui', 'theme', 'Color.kt'
    ),
    // #4098: o composeApp NÃO tem paleta estática de gamificação — `GamificationColors`
    // (e as outras 4 paletas mortas) foram removidos de Color.kt por terem 0
    // consumidores e não serem theme-aware. O ColorScheme do módulo é gerado em
    // runtime pelo DynamicThemeEngine a partir das seeds de shared/ThemeConfig.kt
    // (validadas em checkKotlinSeedParity — brand.primary inclusive). Mesma
    // filosofia do #3934: validar o que RENDERIZA, não vals mortos.
    staticPalette: false,
    // Os únicos hexes de gamificação que o composeApp de fato renderiza são as
    // medalhas do pódio (PostGameReportScreen, #4096). checkGamificationParity
    // valida esses vals contra gamification.gold/silver/bronze.
    gamificationFile: path.join(
      ROOT,
      'composeApp', 'src', 'commonMain', 'kotlin', 'com', 'futebadosparcas', 'ui', 'core', 'PostGameReportScreen.kt'
    ),
    gamificationVals: { MedalGold: 'gold', MedalSilver: 'silver', MedalBronze: 'bronze' },
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

  return sliceBraceBlock(content, content.indexOf('{', match.index));
}

/** Retorna o bloco `{ ... }` balanceado a partir de `open` (índice da chave de abertura), ignorando strings. */
function sliceBraceBlock(content, open) {
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

function checkTsObjectHexes(content, objectName, expected, label, sourceFile, errors, lookupContent = content) {
  let object = extractTsObject(content, objectName);
  if (!object) {
    const propertyReference = new RegExp(
      `\\b${escapeRegExp(objectName)}\\s*:\\s*([A-Za-z_$][\\w$]*)\\s*[,}]`,
      'm'
    ).exec(content);
    if (propertyReference) {
      object = extractTsObject(lookupContent, propertyReference[1]);
    }
  }
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

function pxToRemString(px) {
  if (px === 0) return '0rem';
  const rem = px / 16;
  return `${Number(rem.toFixed(8))}rem`;
}

function typographyWeightValue(tokens, weightName) {
  if (weightName === 'normal') return tokens.typography.weights.regular;
  const value = tokens.typography.weights[weightName];
  return typeof value === 'number' ? value : null;
}

function checkTsTypographyScale(content, tokens, sourceFile, errors) {
  const scale = tokens.typography && tokens.typography.scale;
  if (!scale || !tokens.typography.weights) {
    errors.push('[typography] bloco `typography.scale` ausente ou incompleto em shared/design-tokens.json');
    return;
  }

  const md3TypeScale = extractTsObject(content, 'md3TypeScale');
  if (!md3TypeScale) {
    errors.push(`[web typography token] md3TypeScale ausente em ${relative(sourceFile)}`);
    return;
  }

  for (const [tokenName, token] of Object.entries(scale)) {
    const tokenBlock = extractTsObject(md3TypeScale, tokenName);
    if (!tokenBlock) {
      errors.push(`[web typography token] ${tokenName} ausente em md3TypeScale em ${relative(sourceFile)}`);
      continue;
    }

    const expectedWeight = typographyWeightValue(tokens, token.weight);
    if (expectedWeight === null) {
      errors.push(`[typography] peso desconhecido: ${tokenName}.weight="${token.weight}" em shared/design-tokens.json`);
    } else {
      const weightRe = new RegExp(`\\bfontWeight\\s*:\\s*${expectedWeight}\\b`);
      if (!weightRe.test(tokenBlock)) {
        errors.push(`[web typography token] ${tokenName}.fontWeight diverge — esperado ${expectedWeight} em ${relative(sourceFile)}`);
      }
    }

    const expectedLetterSpacing = pxToRemString(token.letterSpacing);
    const letterSpacingRe = new RegExp(`\\bletterSpacing\\s*:\\s*['"]${escapeRegExp(expectedLetterSpacing)}['"]`);
    if (!letterSpacingRe.test(tokenBlock)) {
      errors.push(`[web typography token] ${tokenName}.letterSpacing diverge — esperado "${expectedLetterSpacing}" em ${relative(sourceFile)}`);
    }
  }
}

function checkWebTypographyParity(tokens, errors) {
  const file = path.join(ROOT, 'web', 'src', 'theme', 'index.ts');
  const content = readRequiredFile(file, 'web typography tokens', errors);
  if (!content) return;

  checkTsTypographyScale(content, tokens, file, errors);
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
    // #4098: plataforma sem paleta estática — valida só os vals que renderizam
    // (ex.: medalhas do pódio no composeApp), mapeados em `gamificationVals`.
    const file = platform.gamificationFile || platform.file;
    const expected = platform.gamificationVals
      ? Object.fromEntries(
          Object.entries(platform.gamificationVals).map(([valName, tokenKey]) => [
            valName,
            tokens.gamification[tokenKey],
          ])
        )
      : kotlinGamification;

    const content = readRequiredFile(file, `${platform.name} gamification tokens`, errors);
    if (!content) continue;
    checkKotlinValHexes(
      content,
      expected,
      `${platform.name} gamification token`,
      file,
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
      checkTsObjectHexes(darkTheme, role, expected, `web dark ${role} token`, file, errors, content);
    }
  }
}

function checkIntraPlatformPaletteParity(tokens, errors) {
  for (const role of Object.keys(tokens.palette)) {
    const lightRole = tokens.palette[role];
    const darkRole = tokens.darkPalette && tokens.darkPalette[role];
    if (!lightRole || !darkRole || typeof lightRole !== 'object' || typeof darkRole !== 'object') continue;
    for (const shade of ['dark', 'light']) {
      if (lightRole[shade] && darkRole[shade] && lightRole[shade] === darkRole[shade]) {
        errors.push(
          `[intra-platform] ${role}.${shade} idêntico em palette e darkPalette (${tokenHex(lightRole[shade])}) — deve inverter entre temas (issue #3923)`
        );
      }
    }
  }
}

/**
 * Valida as SEEDS que de fato renderizam no Android/iOS — `ThemeConfig.kt`
 * (KMP commonMain), lidas por [DynamicThemeEngine] e por [ThemeRepositoryImpl].
 *
 * #3934 passo 3: o gate anterior validava os `md3_*` privados de `Color.kt`,
 * que eram codigo morto (zero consumidores) e divergiam do que renderizava.
 * Agora valida o que o engine de fato semeia: primary/secondary/tertiary.
 *
 * tertiary referencia `brand.tertiary` (#FF6D00) — se colapsar em secondary
 * o engine faz fallback e os dois acentos M3 renderizam iguais (#3933).
 */
function checkKotlinSeedParity(tokens, errors) {
  const file = path.join(
    ROOT,
    'shared', 'src', 'commonMain', 'kotlin', 'com', 'futebadosparcas',
    'domain', 'model', 'ThemeConfig.kt'
  );
  const content = readRequiredFile(file, 'shared seed (ThemeConfig.kt)', errors);
  if (!content) return;

  const expected = {
    primary: tokens.palette.primary.main,      // #00852A
    secondary: tokens.palette.secondary.main,  // #005FCC — paridade web
    tertiary: tokens.brand.tertiary.hex,        // #FF6D00 — distinto
  };

  for (const [name, rawHex] of Object.entries(expected)) {
    const hex6 = normalizeHex(rawHex);
    // Casa "PRIMARY_ARGB = 0xFF00852A" ou "PRIMARY_ARGB: Int = 0xFF00852A"
    // (com .toInt() opcional) dentro de DefaultSeeds.
    const re = new RegExp(
      '\\b' + name + '_ARGB\\s*(?::\\s*Int)?\\s*=\\s*0xFF' + hex6 + '(?:\\.toInt\\(\\))?',
      'i'
    );
    if (!re.test(content)) {
      errors.push(
        `[shared seed] DefaultSeeds.${name}_ARGB diverge — esperado 0xFF${hex6.toUpperCase()} em ${relative(file)}`
      );
    }
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

  // NOTA (#3934): a validacao Kotlin de `md3_*_surface*` foi REMOVIDA. Esses
  // vals privados (e os schemes FutebaLight/DarkColorScheme que consumiam) eram
  // codigo morto e foram apagados de Color.kt. No Android/iOS as superficies
  // sao derivadas em runtime pelo DynamicThemeEngine a partir do TonalPalette
  // neutro (hue do seed primary) — nao existe hex estatico para comparar.
  // A paridade viva das cores de acento fica em checkKotlinSeedParity.
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
    kind: 'ts',
    file: path.join(ROOT, 'web', 'src', 'theme', 'motion.ts'),
  },
  {
    name: 'android :app AppMotion.kt',
    kind: 'kotlin',
    file: path.join(
      ROOT,
      'app', 'src', 'main', 'java', 'com', 'futebadosparcas', 'ui', 'theme', 'AppMotion.kt'
    ),
  },
  {
    name: 'composeApp Motion.kt',
    kind: 'kotlin',
    file: path.join(
      ROOT,
      'composeApp', 'src', 'commonMain', 'kotlin', 'com', 'futebadosparcas', 'ui', 'theme', 'Motion.kt'
    ),
  },
];

/** `standard` -> `Standard` (nome do símbolo Kotlin para um token camelCase). */
function pascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Padrão regex para um número de curva. Inteiros aceitam a forma `0` e `0.0`
 * (Kotlin costuma escrever `0f`, o M3 upstream `0.0f`); decimais casam
 * literalmente. `suffix` é `f` para Kotlin e vazio para CSS.
 */
function curveNumberPattern(value, suffix) {
  const literal = String(value);
  const base = Number.isInteger(value) ? `${literal}(?:\\.0)?` : escapeRegExp(literal);
  return base + suffix;
}

/**
 * Regex que casa a DECLARAÇÃO do easing `name` ligada à curva `curve` na
 * plataforma `kind` (#4115). O nome do símbolo faz parte do padrão, então
 * trocar os valores de dois easings entre si deixa o gate vermelho:
 *  - kotlin: `val Standard: Easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)`
 *  - ts:     `standard: 'cubic-bezier(0.2, 0, 0, 1)'`
 */
function easingDeclarationPattern(name, curve, kind) {
  if (kind === 'kotlin') {
    const nums = curve.map((v) => curveNumberPattern(v, 'f')).join('\\s*,\\s*');
    return new RegExp(
      `\\bval\\s+${escapeRegExp(pascalCase(name))}\\s*(?::\\s*Easing)?\\s*=\\s*CubicBezierEasing\\(\\s*${nums}\\s*\\)`
    );
  }
  const nums = curve.map((v) => curveNumberPattern(v, '')).join('\\s*,\\s*');
  return new RegExp(`\\b${escapeRegExp(name)}\\s*:\\s*['"]cubic-bezier\\(\\s*${nums}\\s*\\)['"]`);
}

/**
 * Regex que casa a DECLARAÇÃO da duration `name` ligada ao valor `value`:
 *  - kotlin: `const val Short = 150`
 *  - ts:     `short: 150`
 */
function durationDeclarationPattern(name, value, kind) {
  if (kind === 'kotlin') {
    return new RegExp(`\\bconst\\s+val\\s+${escapeRegExp(pascalCase(name))}\\s*(?::\\s*Int)?\\s*=\\s*${value}\\b`);
  }
  return new RegExp(`\\b${escapeRegExp(name)}\\s*:\\s*${value}\\b`);
}

/** Extrai o corpo `{ ... }` de `object <name> {` em Kotlin (com balanceamento de chaves). */
function extractKotlinObject(content, objectName) {
  const header = new RegExp(`\\bobject\\s+${escapeRegExp(objectName)}\\s*\\{`).exec(content);
  if (!header) return null;
  return sliceBraceBlock(content, content.indexOf('{', header.index));
}

/**
 * Símbolos de easing DECLARADOS no bloco da plataforma. Usado para pegar
 * símbolo órfão: um `Emphasized`/`emphasized` que não existe mais nos tokens
 * canônicos (#4115).
 */
function declaredEasingNames(block, kind) {
  const re = kind === 'kotlin'
    ? /\bval\s+([A-Za-z_]\w*)\s*(?::\s*Easing)?\s*=\s*CubicBezierEasing\(/g
    : /^\s*([A-Za-z_$][\w$]*)\s*:\s*['"]cubic-bezier\(/gm;
  return [...block.matchAll(re)].map((m) => m[1]);
}

/** Símbolos de duration DECLARADOS no bloco da plataforma (`const val X = n` / `x: n`). */
function declaredDurationNames(block, kind) {
  const re = kind === 'kotlin'
    ? /\bconst\s+val\s+([A-Za-z_]\w*)\s*(?::\s*Int)?\s*=\s*\d+\b/g
    : /^\s*([A-Za-z_$][\w$]*)\s*:\s*\d+\s*,?\s*$/gm;
  return [...block.matchAll(re)].map((m) => m[1]);
}

/**
 * Valida durations e easings do bloco `motion` em todas as plataformas.
 *
 * #4115: a validação é NOME → VALOR, não "o valor aparece em algum lugar do
 * arquivo". Cada easing/duration canônico precisa estar ligado ao seu símbolo
 * na declaração (`val Standard = CubicBezierEasing(...)`, `standard: 'cubic-bezier(...)'`),
 * e todo símbolo declarado na plataforma precisa existir nos tokens — um
 * alias órfão (ex.: `Emphasized`) é drift tanto quanto um valor trocado.
 *
 * `motionFiles` é injetável para os testes (scripts/check-design-tokens-parity.test.js).
 */
function checkMotionParity(tokens, errors, motionFiles = MOTION_FILES) {
  const motion = tokens.motion;
  if (!motion || !motion.duration || !motion.easing) {
    errors.push('[motion] bloco `motion` ausente ou incompleto em shared/design-tokens.json');
    return;
  }

  // Durations canônicas a validar por nome (ignora as *Reduced=0, que são triviais
  // e nem toda plataforma declara). Para o check de símbolo órfão vale o bloco todo.
  const durations = {
    short: motion.duration.short,
    medium: motion.duration.medium,
    long: motion.duration.long,
  };
  const knownDurationNames = new Set(Object.keys(motion.duration).map((n) => n.toLowerCase()));

  // Easings canônicas (cada curva é um array [x1,y1,x2,y2]).
  const easings = motion.easing;
  const knownEasingNames = new Set(Object.keys(easings).map((n) => n.toLowerCase()));

  for (const platform of motionFiles) {
    const rel = path.relative(ROOT, platform.file);
    if (!fs.existsSync(platform.file)) {
      errors.push(`[${platform.name}] arquivo de motion ausente: ${rel}`);
      continue;
    }
    const content = fs.readFileSync(platform.file, 'utf8');
    const kind = platform.kind;
    const symbolPrefix = kind === 'kotlin' ? 'MotionEasing.' : 'motionEasing.';
    const durationPrefix = kind === 'kotlin' ? 'MotionDuration.' : 'motionDuration.';

    const durationBlock = kind === 'kotlin'
      ? extractKotlinObject(content, 'MotionDuration')
      : extractTsObject(content, 'motionDuration');
    if (!durationBlock) {
      errors.push(`[${platform.name}] bloco ${durationPrefix.slice(0, -1)} ausente em ${rel}`);
    } else {
      for (const [name, value] of Object.entries(durations)) {
        if (!durationDeclarationPattern(name, value, kind).test(durationBlock)) {
          errors.push(
            `[${platform.name}] duration diverge: ${durationPrefix}${kind === 'kotlin' ? pascalCase(name) : name} deve ser ${value} (motion.duration.${name}) em ${rel}`
          );
        }
      }
      for (const declared of declaredDurationNames(durationBlock, kind)) {
        if (!knownDurationNames.has(declared.toLowerCase())) {
          errors.push(
            `[${platform.name}] duration sem token canônico: ${durationPrefix}${declared} não existe em shared/design-tokens.json#motion.duration (${rel})`
          );
        }
      }
    }

    const easingBlock = kind === 'kotlin'
      ? extractKotlinObject(content, 'MotionEasing')
      : extractTsObject(content, 'motionEasing');
    if (!easingBlock) {
      errors.push(`[${platform.name}] bloco ${symbolPrefix.slice(0, -1)} ausente em ${rel}`);
      continue;
    }

    for (const [name, curve] of Object.entries(easings)) {
      if (!easingDeclarationPattern(name, curve, kind).test(easingBlock)) {
        errors.push(
          `[${platform.name}] easing diverge: ${symbolPrefix}${kind === 'kotlin' ? pascalCase(name) : name} deve ser [${curve.join(', ')}] (motion.easing.${name}) em ${rel}`
        );
      }
    }

    for (const declared of declaredEasingNames(easingBlock, kind)) {
      if (!knownEasingNames.has(declared.toLowerCase())) {
        errors.push(
          `[${platform.name}] easing sem token canônico: ${symbolPrefix}${declared} não existe em shared/design-tokens.json#motion.easing — remova o símbolo ou adicione o token (${rel})`
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
    // #4098: plataformas sem paleta estática (composeApp) não carregam os hexes
    // canônicos em Color.kt — brand.primary é validado nas seeds
    // (checkKotlinSeedParity) e gamificação nos vals que renderizam
    // (checkGamificationParity via `gamificationVals`).
    if (platform.staticPalette === false) continue;

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
  checkIntraPlatformPaletteParity(tokens, errors);
  checkKotlinSeedParity(tokens, errors);
  checkGamificationParity(tokens, errors);
  checkSurfaceParity(tokens, errors);

  // Paridade de radius + spacing — issue #2744.
  checkWebRadiusAndSpacing(tokens, errors);
  checkKotlinRadiusAndSpacing(tokens, errors);
  checkWebElevationParity(tokens, errors);
  checkWebTypographyParity(tokens, errors);

  // Paridade de motion (durations + easings) — issue #2755.
  checkMotionParity(tokens, errors);

  if (errors.length > 0) {
    console.error('✗ DRIFT de design tokens detectado:');
    for (const e of errors) console.error('  - ' + e);
    console.error(`\nTotal: ${errors.length} divergência(s). Fonte canônica: shared/design-tokens.json`);
    process.exit(1);
  }

  console.log('✓ design tokens em paridade (cores + gamificação + radius + spacing + surface + elevation + typography + motion)');
  process.exit(0);
}

if (require.main === module) {
  main();
}

// Exports para scripts/check-design-tokens-parity.test.js (#4115).
module.exports = {
  MOTION_FILES,
  checkMotionParity,
  easingDeclarationPattern,
  durationDeclarationPattern,
};
