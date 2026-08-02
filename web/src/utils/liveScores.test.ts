import { describe, expect, it } from 'vitest';
import {
  buildTeamScores,
  MAX_LIVE_TEAMS,
  readScoresMap,
  TEAM_PALETTE_KEYS,
} from './liveScores';

describe('readScoresMap', () => {
  it('lê o mapa canônico scores (2-4 times)', () => {
    const map = readScoresMap({
      scores: { t1: 2, t2: 1, t3: 0, t4: 3 },
    });
    expect(Object.fromEntries(map)).toEqual({ t1: 2, t2: 1, t3: 0, t4: 3 });
  });

  it('reconstitui o mapa a partir de team1/team2 quando scores está ausente (fallback legado)', () => {
    const map = readScoresMap({
      team1_id: 'tA',
      team2_id: 'tB',
      team1_score: 3,
      team2_score: 2,
    });
    expect(Object.fromEntries(map)).toEqual({ tA: 3, tB: 2 });
  });

  it('ignora o fallback legado quando scores canônico existe (mesmo parcial)', () => {
    const map = readScoresMap({
      scores: { tX: 5 },
      team1_id: 'tA',
      team2_id: 'tB',
      team1_score: 3,
      team2_score: 2,
    });
    expect(Object.fromEntries(map)).toEqual({ tX: 5 });
  });

  it('trata scores vazio/objeto e cai no fallback legado', () => {
    expect(Object.fromEntries(readScoresMap({ scores: {} }))).toEqual({});
    expect(Object.fromEntries(readScoresMap({ scores: null }))).toEqual({});
    expect(Object.fromEntries(readScoresMap({ scores: 'x' }))).toEqual({});
  });

  it('retorna mapa vazio quando não há dados legados nem canônicos', () => {
    expect(Object.fromEntries(readScoresMap(null))).toEqual({});
    expect(Object.fromEntries(readScoresMap(undefined))).toEqual({});
    expect(Object.fromEntries(readScoresMap({}))).toEqual({});
  });

  it('normaliza valores inválidos/negativos/não-inteiros para 0 ou inteiro', () => {
    const map = readScoresMap({
      scores: {
        good: 4,
        negative: -2,
        nan: Number.NaN,
        floaty: 3.9,
        str: '5',
        // Chave de string vazia deve ser ignorada (teamId inválido).
        '': 9,
        '   ': 9,
      },
    });
    expect(map.get('good')).toBe(4);
    expect(map.get('negative')).toBe(0);
    expect(map.get('nan')).toBe(0);
    expect(map.get('floaty')).toBe(3);
    expect(map.get('str')).toBe(5);
    expect(map.has('')).toBe(false);
    expect(map.has('   ')).toBe(false);
  });

  it('faz trim nos teamIds do mapa canônico', () => {
    const map = readScoresMap({ scores: { '  t1  ': 1 } });
    expect(map.has('t1')).toBe(true);
  });
});

describe('buildTeamScores', () => {
  it('monta 2 times a partir do mapa canônico + times collection', () => {
    const result = buildTeamScores({
      scoresMap: new Map([
        ['t1', 2],
        ['t2', 1],
      ]),
      teams: {
        t1: { id: 't1', name: 'Azul' },
        t2: { id: 't2', name: 'Verde' },
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ teamId: 't1', name: 'Azul', score: 2, paletteKey: 'primary', isLeader: true });
    expect(result[1]).toMatchObject({ teamId: 't2', name: 'Verde', score: 1, paletteKey: 'secondary', isLeader: false });
  });

  it('monta 4 times distribuindo as paletas primary/secondary/info/warning', () => {
    const result = buildTeamScores({
      scoresMap: new Map([
        ['t1', 0],
        ['t2', 0],
        ['t3', 0],
        ['t4', 0],
      ]),
    });
    expect(result.map((t) => t.paletteKey)).toEqual([
      'primary',
      'secondary',
      'info',
      'warning',
    ]);
  });

  it('respeita seedTeamIds para ordem estável mesmo com mapa em ordem diferente', () => {
    const result = buildTeamScores({
      scoresMap: new Map([
        ['t2', 1],
        ['t1', 2],
        ['t3', 0],
      ]),
      seedTeamIds: ['t1', 't2'],
      fallbackLabel: (i) => `Time ${i + 1}`,
    });
    expect(result.map((t) => t.teamId)).toEqual(['t1', 't2', 't3']);
    expect(result[0].name).toBe('Time 1');
    expect(result[1].name).toBe('Time 2');
    expect(result[2].name).toBe('Time 3');
  });

  it('usa fallbackNames legados (game.team1Name) quando não há times collection', () => {
    const result = buildTeamScores({
      scoresMap: new Map([
        ['tA', 3],
        ['tB', 3],
      ]),
      seedTeamIds: ['tA', 'tB'],
      fallbackNames: { tA: 'Mandrakes', tB: 'Gremistas' },
    });
    expect(result.map((t) => t.name)).toEqual(['Mandrakes', 'Gremistas']);
    // Empate no topo (>0) → ambos isLeader e isTied.
    expect(result.every((t) => t.isLeader && t.isTied)).toBe(true);
  });

  it('marca nenhum líder quando todos estão em zero', () => {
    const result = buildTeamScores({
      scoresMap: new Map([
        ['t1', 0],
        ['t2', 0],
      ]),
    });
    expect(result.every((t) => !t.isLeader && !t.isTied)).toBe(true);
  });

  it('limita a MAX_LIVE_TEAMS times mesmo com mais no mapa', () => {
    const result = buildTeamScores({
      scoresMap: new Map([
        ['t1', 1],
        ['t2', 1],
        ['t3', 1],
        ['t4', 1],
        ['t5', 1],
      ]),
    });
    expect(result).toHaveLength(MAX_LIVE_TEAMS);
    expect(result.map((t) => t.teamId)).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('retorna array vazio quando não há times nem placares', () => {
    expect(buildTeamScores({})).toEqual([]);
    expect(buildTeamScores({ scoresMap: new Map(), seedTeamIds: ['', undefined] })).toEqual([]);
  });

  it('prioriza nome da collection sobre fallback e sobre label', () => {
    const result = buildTeamScores({
      scoresMap: new Map([['t1', 0]]),
      teams: { t1: { id: 't1', name: 'CollectionName' } },
      fallbackNames: { t1: 'LegacyName' },
      fallbackLabel: () => 'LabelName',
    });
    expect(result[0].name).toBe('CollectionName');
  });

  it('TEAM_PALETTE_KEYS tem 4 entradas cobrindo 0..MAX_LIVE_TEAMS-1', () => {
    expect(TEAM_PALETTE_KEYS).toHaveLength(MAX_LIVE_TEAMS);
  });
});
