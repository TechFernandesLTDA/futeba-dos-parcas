import { describe, expect, it } from 'vitest';
import {
  futebaDarkTheme,
  futebaTheme,
  gamificationColors,
  gamificationColorsDark,
  gamificationColorsOnLight,
  rarityColors,
  rarityColorsDark,
} from './index';

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  if (value.length === 4) {
    // #fff → #ffffff
    return [
      Number.parseInt(value.slice(1, 2).repeat(2), 16),
      Number.parseInt(value.slice(2, 3).repeat(2), 16),
      Number.parseInt(value.slice(3, 4).repeat(2), 16),
    ];
  }
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

/** Interpreta `#RRGGBB` ou `rgba(r, g, b, a)` (compondo o alpha sobre bg). */
function parseColor(value: string, background: Rgb): Rgb {
  if (value.startsWith('#')) return parseHex(value);
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
  if (!match) throw new Error(`Cor não suportada no teste de contraste: ${value}`);
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  return [
    r * alpha + background[0] * (1 - alpha),
    g * alpha + background[1] * (1 - alpha),
    b * alpha + background[2] * (1 - alpha),
  ];
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) => (
    channel * alpha + background[index] * (1 - alpha)
  )) as Rgb;
}

function luminance([red, green, blue]: Rgb): number {
  return [red, green, blue].reduce((sum, channel, index) => {
    const normalized = channel / 255;
    const linear = normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

// Superfícies canônicas dos temas (theme/index.ts)
const LIGHT_SURFACES: [string, Rgb][] = [
  ['background.paper (#FFFFFF)', [255, 255, 255]],
  ['background.default (#FCFCFC)', [252, 252, 252]],
];
const DARK_SURFACES: [string, Rgb][] = [
  ['background.paper (#1E293B)', parseHex('#1E293B')],
  ['background.default (#0F172A)', parseHex('#0F172A')],
];

describe('badge rarity light palette', () => {
  it('keeps normal chip labels at WCAG AA over the tinted background', () => {
    for (const rarity of ['COMUM', 'INCOMUM', 'RARO', 'EPICO', 'LENDARIO']) {
      const foreground = parseHex(rarityColors[rarity]);
      const background = blend(foreground, [255, 255, 255], 0.1);
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('badge rarity dark palette', () => {
  it('keeps normal chip labels at WCAG AA over the tinted dark background', () => {
    for (const rarity of ['COMUM', 'INCOMUM', 'RARO', 'EPICO', 'LENDARIO']) {
      const foreground = parseHex(rarityColorsDark[rarity]);
      const background = blend(foreground, parseHex('#1E293B'), 0.1);
      expect(contrastRatio(foreground, background), rarity).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// #4041 — paleta de gamificação usada como COR DE TEXTO. Os metais puros do
// light (silver #E0E0E0 = 1.32:1, gold #FFD700 = 1.40:1) reprovam; a variante
// de foreground `gamificationColorsOnLight` e a paleta dark precisam entregar
// AA (>= 4.5:1) sobre as superfícies canônicas de cada tema.
describe('gamification palette as TEXT (#4041)', () => {
  const tokens = Object.keys(gamificationColors) as (keyof typeof gamificationColors)[];

  it.each(tokens)('light foreground "%s" atinge AA sobre as superfícies light', (token) => {
    const foreground = parseHex(gamificationColorsOnLight[token]);
    for (const [surfaceName, surface] of LIGHT_SURFACES) {
      expect(contrastRatio(foreground, surface), `${token} sobre ${surfaceName}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(tokens)('dark palette "%s" atinge AA como texto sobre as superfícies dark', (token) => {
    const foreground = parseHex(gamificationColorsDark[token]);
    for (const [surfaceName, surface] of DARK_SURFACES) {
      expect(contrastRatio(foreground, surface), `${token} sobre ${surfaceName}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// #4056 — getContrastText() com contrastThreshold 4.5. A paleta base do light
// é de FUNDO (medalha/badge); o texto que o helper escolher precisa medir
// AA de verdade (compondo o alpha do darkText rgba(0,0,0,0.87) sobre o fundo,
// como o medidor ao vivo fazia — bronze com branco dava 3.14:1).
describe('getContrastText parity sobre a paleta de gamificação (#4056)', () => {
  const lightTokens = Object.keys(gamificationColors) as (keyof typeof gamificationColors)[];
  const darkTokens = Object.keys(gamificationColorsDark) as (keyof typeof gamificationColorsDark)[];

  it.each(lightTokens)('light: texto escolhido para fundo "%s" mede >= 4.5:1', (token) => {
    const background = parseHex(gamificationColors[token]);
    const chosen = futebaTheme.palette.getContrastText(gamificationColors[token]);
    // resolve rgba(0,0,0,0.87)/#fff compondo sobre o próprio fundo
    const effective = parseColor(chosen, background);
    expect(contrastRatio(effective, background), `${token} + ${chosen}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(darkTokens)('dark: texto escolhido para fundo "%s" mede >= 4.5:1', (token) => {
    const background = parseHex(gamificationColorsDark[token]);
    const chosen = futebaDarkTheme.palette.getContrastText(gamificationColorsDark[token]);
    const effective = parseColor(chosen, background);
    expect(contrastRatio(effective, background), `${token} + ${chosen}`).toBeGreaterThanOrEqual(4.5);
  });

  it('threshold do tema é AA (4.5) — bronze/streak/champion não recebem mais branco marginal', () => {
    expect(futebaTheme.palette.contrastThreshold).toBe(4.5);
    expect(futebaDarkTheme.palette.contrastThreshold).toBe(4.5);
  });
});
