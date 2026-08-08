import { describe, expect, it } from 'vitest';
import { rarityColors } from './index';

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
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

describe('badge rarity light palette', () => {
  it('keeps normal chip labels at WCAG AA over the tinted background', () => {
    for (const rarity of ['COMUM', 'INCOMUM', 'RARO', 'EPICO', 'LENDARIO']) {
      const foreground = parseHex(rarityColors[rarity]);
      const background = blend(foreground, [255, 255, 255], 0.1);
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
