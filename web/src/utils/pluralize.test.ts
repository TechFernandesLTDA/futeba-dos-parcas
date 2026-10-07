import { describe, it, expect } from 'vitest';
import { pluralize, pluralizeCount } from './pluralize';

describe('pluralize', () => {
  it('retorna singular para count === 1', () => {
    expect(pluralize(1, 'jogo', 'jogos')).toBe('jogo');
  });

  it('retorna plural para count === 2', () => {
    expect(pluralize(2, 'jogo', 'jogos')).toBe('jogos');
  });

  it('retorna plural para count === 0', () => {
    expect(pluralize(0, 'jogo', 'jogos')).toBe('jogos');
  });

  it('retorna plural para count negativo', () => {
    expect(pluralize(-1, 'jogo', 'jogos')).toBe('jogos');
  });

  it('retorna plural para count grande', () => {
    expect(pluralize(1000, 'membro', 'membros')).toBe('membros');
  });

  it('funciona com palavras quaisquer (não altera as strings)', () => {
    expect(pluralize(1, 'pelada', 'peladas')).toBe('pelada');
    expect(pluralize(3, 'pelada', 'peladas')).toBe('peladas');
  });
});

describe('pluralizeCount', () => {
  it('formata "1 jogo" no singular', () => {
    expect(pluralizeCount(1, 'jogo', 'jogos')).toBe('1 jogo');
  });

  it('formata "5 membros" no plural', () => {
    expect(pluralizeCount(5, 'membro', 'membros')).toBe('5 membros');
  });

  it('formata "0 jogos" no plural', () => {
    expect(pluralizeCount(0, 'jogo', 'jogos')).toBe('0 jogos');
  });

  it('formata count negativo com plural', () => {
    expect(pluralizeCount(-2, 'item', 'itens')).toBe('-2 itens');
  });

  it('usa as strings passadas sem transformação', () => {
    expect(pluralizeCount(2, 'GOL', 'GOLs')).toBe('2 GOLs');
  });
});
