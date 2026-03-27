import { describe, it, expect } from 'vitest';
import {
  getLevelBadgeImage,
  getLevelBadgeDescription,
  isImmortalBadge,
  getAllBadgeLevels,
} from './levelBadge';

describe('levelBadge', () => {
  describe('getLevelBadgeImage', () => {
    it('retorna caminho correto para nível 0', () => {
      expect(getLevelBadgeImage(0)).toBe('/images/levels/level_0.png');
    });

    it('retorna caminho correto para nível 5', () => {
      expect(getLevelBadgeImage(5)).toBe('/images/levels/level_5.png');
    });

    it('retorna caminho correto para nível 10', () => {
      expect(getLevelBadgeImage(10)).toBe('/images/levels/level_10.png');
    });

    it('retorna caminho correto para cada nível de 0 a 10', () => {
      for (let i = 0; i <= 10; i++) {
        expect(getLevelBadgeImage(i)).toBe(`/images/levels/level_${i}.png`);
      }
    });

    it('limita nível > 10 ao brasão do nível 10 (Imortal)', () => {
      expect(getLevelBadgeImage(11)).toBe('/images/levels/level_10.png');
      expect(getLevelBadgeImage(15)).toBe('/images/levels/level_10.png');
      expect(getLevelBadgeImage(20)).toBe('/images/levels/level_10.png');
    });

    it('limita nível > 20 ao brasão do nível 10', () => {
      expect(getLevelBadgeImage(25)).toBe('/images/levels/level_10.png');
      expect(getLevelBadgeImage(100)).toBe('/images/levels/level_10.png');
    });

    it('limita nível negativo ao nível 0', () => {
      expect(getLevelBadgeImage(-1)).toBe('/images/levels/level_0.png');
      expect(getLevelBadgeImage(-10)).toBe('/images/levels/level_0.png');
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

  describe('isImmortalBadge', () => {
    it('retorna true para nível 10 (limite do Imortal)', () => {
      expect(isImmortalBadge(10)).toBe(true);
    });

    it('retorna true para níveis acima de 10', () => {
      expect(isImmortalBadge(11)).toBe(true);
      expect(isImmortalBadge(15)).toBe(true);
      expect(isImmortalBadge(20)).toBe(true);
    });

    it('retorna false para níveis 0-9', () => {
      for (let i = 0; i < 10; i++) {
        expect(isImmortalBadge(i)).toBe(false);
      }
    });
  });

  describe('getAllBadgeLevels', () => {
    it('retorna array com níveis 0 a 10', () => {
      const levels = getAllBadgeLevels();
      expect(levels).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('retorna array com 11 elementos', () => {
      expect(getAllBadgeLevels()).toHaveLength(11);
    });
  });
});
