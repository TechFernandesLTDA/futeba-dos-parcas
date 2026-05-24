import { describe, it, expect } from 'vitest';
import {
  getLevelBadgeImage,
  getLevelBadgeDescription,
  isLegendBadge,
  getAllBadgeLevels,
  FALLBACK_BADGE,
  handleBadgeImageError,
} from './levelBadge';

describe('levelBadge', () => {
  describe('getLevelBadgeImage', () => {
    it('retorna caminho correto para cada nível de 0 a 20', () => {
      for (let i = 0; i <= 20; i++) {
        expect(getLevelBadgeImage(i)).toBe(`/images/levels/level_${i}.png`);
      }
    });

    it('retorna caminho correto para nível 0', () => {
      expect(getLevelBadgeImage(0)).toBe('/images/levels/level_0.png');
    });

    it('retorna caminho correto para nível 10', () => {
      expect(getLevelBadgeImage(10)).toBe('/images/levels/level_10.png');
    });

    it('retorna caminho correto para nível 20 (Pelé)', () => {
      expect(getLevelBadgeImage(20)).toBe('/images/levels/level_20.png');
    });

    it('retorna caminho correto para lendas (11-19)', () => {
      expect(getLevelBadgeImage(11)).toBe('/images/levels/level_11.png');
      expect(getLevelBadgeImage(15)).toBe('/images/levels/level_15.png');
      expect(getLevelBadgeImage(19)).toBe('/images/levels/level_19.png');
    });

    it('clampa nível > 20 ao nível máximo 20', () => {
      expect(getLevelBadgeImage(25)).toBe('/images/levels/level_20.png');
      expect(getLevelBadgeImage(100)).toBe('/images/levels/level_20.png');
    });

    it('clampa nível negativo ao nível 0', () => {
      expect(getLevelBadgeImage(-1)).toBe('/images/levels/level_0.png');
      expect(getLevelBadgeImage(-10)).toBe('/images/levels/level_0.png');
    });
  });

  describe('handleBadgeImageError', () => {
    it('substitui src por fallback quando não é o fallback ainda', () => {
      const img = { src: '/images/levels/level_15.png' } as HTMLImageElement;
      const event = { currentTarget: img } as React.SyntheticEvent<HTMLImageElement>;
      handleBadgeImageError(event);
      expect(img.src).toBe(FALLBACK_BADGE);
    });

    it('não faz nada se já é o fallback (evita loop)', () => {
      const img = { src: FALLBACK_BADGE } as HTMLImageElement;
      const event = { currentTarget: img } as React.SyntheticEvent<HTMLImageElement>;
      handleBadgeImageError(event);
      expect(img.src).toBe(FALLBACK_BADGE);
    });
  });

  describe('FALLBACK_BADGE', () => {
    it('é o badge do nível 10 (Imortal)', () => {
      expect(FALLBACK_BADGE).toBe('/images/levels/level_10.png');
    });
  });

  describe('getLevelBadgeDescription', () => {
    it('retorna descrição no formato correto', () => {
      expect(getLevelBadgeDescription(5, 'Habilidoso')).toBe(
        'Brasão de nível 5 - Habilidoso'
      );
    });

    it('retorna descrição para nível 0', () => {
      expect(getLevelBadgeDescription(0, 'Novato')).toBe(
        'Brasão de nível 0 - Novato'
      );
    });

    it('retorna descrição para nível máximo', () => {
      expect(getLevelBadgeDescription(20, 'Pelé')).toBe(
        'Brasão de nível 20 - Pelé'
      );
    });
  });

  describe('isLegendBadge', () => {
    it('retorna true para níveis 11+ (lendas)', () => {
      expect(isLegendBadge(11)).toBe(true);
      expect(isLegendBadge(15)).toBe(true);
      expect(isLegendBadge(20)).toBe(true);
    });

    it('retorna false para níveis 0-10', () => {
      for (let i = 0; i <= 10; i++) {
        expect(isLegendBadge(i)).toBe(false);
      }
    });
  });

  describe('getAllBadgeLevels', () => {
    it('retorna array com níveis 0 a 20', () => {
      const levels = getAllBadgeLevels();
      expect(levels).toEqual(Array.from({ length: 21 }, (_, i) => i));
    });

    it('retorna array com 21 elementos', () => {
      expect(getAllBadgeLevels()).toHaveLength(21);
    });
  });
});
