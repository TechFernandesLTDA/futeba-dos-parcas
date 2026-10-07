import { describe, expect, it, vi } from 'vitest';
import type { Theme } from '@mui/material/styles';

vi.mock('../theme', () => ({
  gamificationColors: {
    gold: '#LIGHT_GOLD',
    silver: '#LIGHT_SILVER',
    bronze: '#LIGHT_BRONZE',
  },
  gamificationColorsDark: {
    gold: '#DARK_GOLD',
    silver: '#DARK_SILVER',
    bronze: '#DARK_BRONZE',
  },
  gamificationColorsOnLight: { gold: '#ONLIGHT_GOLD' },
  rarityColors: { COMUM: '#LIGHT_COMUM' },
  rarityColorsDark: { COMUM: '#DARK_COMUM' },
}));

import { getPositionBadgeStyle } from './gamificationStyle';

function makeTheme(mode: 'light' | 'dark', contrastFor: Record<string, string> = {}): Theme {
  return {
    palette: {
      mode,
      getContrastText: vi.fn(
        (bg: string) => contrastFor[bg] ?? (bg === '#LIGHT_SILVER' ? '#000000' : '#FFFFFF'),
      ),
      action: { disabledBackground: '#ACTION_DISABLED' },
      text: { primary: '#TEXT_PRIMARY' },
    },
  } as unknown as Theme;
}

describe('gamificationStyle', () => {
  describe('getPositionBadgeStyle', () => {
    it('posição 1 usa gold como fundo', () => {
      const theme = makeTheme('light', { '#LIGHT_GOLD': '#111111' });
      expect(getPositionBadgeStyle(1, theme)).toEqual({
        bgcolor: '#LIGHT_GOLD',
        color: '#111111',
      });
    });

    it('posição 2 usa silver como fundo', () => {
      const theme = makeTheme('light', { '#LIGHT_SILVER': '#222222' });
      expect(getPositionBadgeStyle(2, theme)).toEqual({
        bgcolor: '#LIGHT_SILVER',
        color: '#222222',
      });
    });

    it('posição 3 usa bronze como fundo', () => {
      const theme = makeTheme('light', { '#LIGHT_BRONZE': '#333333' });
      expect(getPositionBadgeStyle(3, theme)).toEqual({
        bgcolor: '#LIGHT_BRONZE',
        color: '#333333',
      });
    });

    it('posições fora do pódio usam estilo neutro', () => {
      const theme = makeTheme('light');
      const expected = { bgcolor: '#ACTION_DISABLED', color: '#TEXT_PRIMARY' };
      expect(getPositionBadgeStyle(0, theme)).toEqual(expected);
      expect(getPositionBadgeStyle(4, theme)).toEqual(expected);
      expect(getPositionBadgeStyle(10, theme)).toEqual(expected);
      expect(getPositionBadgeStyle(-1, theme)).toEqual(expected);
    });

    it('usa a paleta dark quando o tema é dark', () => {
      const theme = makeTheme('dark', {
        '#DARK_GOLD': '#FFFFFF',
        '#DARK_SILVER': '#000000',
        '#DARK_BRONZE': '#111111',
      });
      expect(getPositionBadgeStyle(1, theme)).toEqual({ bgcolor: '#DARK_GOLD', color: '#FFFFFF' });
      expect(getPositionBadgeStyle(2, theme)).toEqual({ bgcolor: '#DARK_SILVER', color: '#000000' });
      expect(getPositionBadgeStyle(3, theme)).toEqual({ bgcolor: '#DARK_BRONZE', color: '#111111' });
    });

    it('a cor de texto vem de palette.getContrastText do bgcolor (não valor fixo)', () => {
      const theme = makeTheme('light', { '#LIGHT_GOLD': '#CONTRASTE' });
      const style = getPositionBadgeStyle(1, theme);
      expect(style.color).toBe('#CONTRASTE');
      expect(theme.palette.getContrastText).toHaveBeenCalledWith('#LIGHT_GOLD');
    });
  });
});
