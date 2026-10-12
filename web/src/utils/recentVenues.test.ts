import { describe, expect, it } from 'vitest';
import { mergeRecentLocationUsage } from './recentVenues';

describe('mergeRecentLocationUsage', () => {
  it('ordena da utilização mais recente para a mais antiga', () => {
    expect(mergeRecentLocationUsage([
      { locationId: 'a', usedAt: 100 },
      { locationId: 'b', usedAt: 300 },
      { locationId: 'c', usedAt: 200 },
    ])).toEqual(['b', 'c', 'a']);
  });

  it('não repete a quadra e usa o jogo mais recente dela', () => {
    expect(mergeRecentLocationUsage([
      { locationId: 'a', usedAt: 100 },
      { locationId: 'b', usedAt: 200 },
      { locationId: 'a', usedAt: 900 },
    ])).toEqual(['a', 'b']);
  });

  it('datas desconhecidas (0) ficam por último e mantêm a ordem de chegada', () => {
    expect(mergeRecentLocationUsage([
      { locationId: 'sem-data-1', usedAt: 0 },
      { locationId: 'com-data', usedAt: 50 },
      { locationId: 'sem-data-2', usedAt: 0 },
    ])).toEqual(['com-data', 'sem-data-1', 'sem-data-2']);
  });

  it('ignora entradas vazias e ids em branco', () => {
    expect(mergeRecentLocationUsage([null, undefined, { locationId: '', usedAt: 5 }, { locationId: 'x', usedAt: 1 }]))
      .toEqual(['x']);
  });

  it('lista vazia = nada', () => {
    expect(mergeRecentLocationUsage([])).toEqual([]);
  });
});
