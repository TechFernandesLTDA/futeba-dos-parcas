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
  gamificationColorsOnLight: {
    gold: '#ONLIGHT_GOLD',
    silver: '#ONLIGHT_SILVER',
    bronze: '#ONLIGHT_BRONZE',
  },
  rarityColors: { COMUM: '#LIGHT_COMUM', RARO: '#LIGHT_RARO' },
  rarityColorsDark: { COMUM: '#DARK_COMUM', RARO: '#DARK_RARO' },
}));

import {
  getGamificationColors,
  getGamificationTextColor,
  getGamificationTextColors,
  getRarityColor,
  getRarityColors,
} from './gamificationColors';

function makeTheme(mode: 'light' | 'dark'): Theme {
  return { palette: { mode } } as unknown as Theme;
}

describe('gamificationColors', () => {
  describe('getGamificationColors (paleta de FUNDO)', () => {
    it('retorna a paleta light no modo light', () => {
      expect(getGamificationColors(makeTheme('light'))).toEqual({
        gold: '#LIGHT_GOLD',
        silver: '#LIGHT_SILVER',
        bronze: '#LIGHT_BRONZE',
      });
    });

    it('retorna a paleta dark no modo dark', () => {
      expect(getGamificationColors(makeTheme('dark'))).toEqual({
        gold: '#DARK_GOLD',
        silver: '#DARK_SILVER',
        bronze: '#DARK_BRONZE',
      });
    });
  });

  describe('getGamificationTextColors (paleta de TEXTO)', () => {
    it('retorna gamificationColorsOnLight no modo light', () => {
      expect(getGamificationTextColors(makeTheme('light'))).toEqual({
        gold: '#ONLIGHT_GOLD',
        silver: '#ONLIGHT_SILVER',
        bronze: '#ONLIGHT_BRONZE',
      });
    });

    it('retorna gamificationColorsDark no modo dark', () => {
      expect(getGamificationTextColors(makeTheme('dark'))).toEqual({
        gold: '#DARK_GOLD',
        silver: '#DARK_SILVER',
        bronze: '#DARK_BRONZE',
      });
    });
  });

  describe('getGamificationTextColor', () => {
    it('retorna a cor de texto light para o token', () => {
      expect(getGamificationTextColor('gold', makeTheme('light'))).toBe('#ONLIGHT_GOLD');
    });

    it('retorna a cor de texto dark para o token', () => {
      expect(getGamificationTextColor('bronze', makeTheme('dark'))).toBe('#DARK_BRONZE');
    });

    it('funciona para todos os tokens da paleta', () => {
      for (const token of ['gold', 'silver', 'bronze'] as const) {
        expect(typeof getGamificationTextColor(token, makeTheme('light'))).toBe('string');
      }
    });
  });

  describe('getRarityColors', () => {
    it('retorna rarityColors light no modo light', () => {
      expect(getRarityColors(makeTheme('light'))).toEqual({
        COMUM: '#LIGHT_COMUM',
        RARO: '#LIGHT_RARO',
      });
    });

    it('retorna rarityColorsDark no modo dark', () => {
      expect(getRarityColors(makeTheme('dark'))).toEqual({
        COMUM: '#DARK_COMUM',
        RARO: '#DARK_RARO',
      });
    });
  });

  describe('getRarityColor', () => {
    it('retorna a cor da raridade existente', () => {
      expect(getRarityColor('RARO', makeTheme('light'))).toBe('#LIGHT_RARO');
    });

    it('usa a paleta dark em dark mode', () => {
      expect(getRarityColor('RARO', makeTheme('dark'))).toBe('#DARK_RARO');
    });

    it('faz fallback para COMUM quando a raridade não existe', () => {
      expect(getRarityColor('DESCONHECIDA', makeTheme('light'))).toBe('#LIGHT_COMUM');
    });

    it('faz fallback para o COMUM dark em dark mode', () => {
      expect(getRarityColor('DESCONHECIDA', makeTheme('dark'))).toBe('#DARK_COMUM');
    });
  });
});
