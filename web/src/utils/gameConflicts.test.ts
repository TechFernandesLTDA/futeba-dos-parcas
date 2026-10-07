import { describe, it, expect } from 'vitest';
import { Game } from '../types/game';
import { getGameDateTimeMs, detectGameConflicts } from './gameConflicts';

const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;

const makeGame = (overrides: Partial<Game> = {}): Game =>
  ({
    id: 'game-1',
    date: '2026-03-14',
    time: '20:00',
    status: 'SCHEDULED',
    visibility: 'GROUP_ONLY',
    isPublic: false,
    maxPlayers: 10,
    maxGoalkeepers: 1,
    playersCount: 0,
    goalkeepersCount: 0,
    players: [],
    gameType: 'pelada',
    fieldType: 'SOCIETY',
    recurrence: 'none',
    locationId: 'loc-1',
    locationName: 'Quadra X',
    locationAddress: 'Rua Y',
    ...overrides,
  }) as Game;

describe('getGameDateTimeMs', () => {
  it('retorna o timestamp quando dateTime é uma instância de Date', () => {
    const d = new Date(2026, 2, 14, 20, 0, 0);
    const game = makeGame({ dateTime: d });
    expect(getGameDateTimeMs(game)).toBe(d.getTime());
  });

  it('prioriza dateTime sobre date/time em string', () => {
    const d = new Date(2026, 2, 14, 20, 0, 0);
    const game = makeGame({ date: '2026-03-14', time: '20:00', dateTime: d });
    expect(getGameDateTimeMs(game)).toBe(d.getTime());
  });

  it('parseia date "YYYY-MM-DD" + time "HH:mm" com offset de 3h (BRT → UTC)', () => {
    const game = makeGame({ date: '2026-03-14', time: '20:00' });
    const expectedLocal = new Date(2026, 2, 14, 20, 0, 0).getTime();
    expect(getGameDateTimeMs(game)).toBe(expectedLocal + 3 * 60 * 60 * 1000);
  });

  it('usa 20:00 como horário default quando time está vazio', () => {
    const game = makeGame({ date: '2026-03-14', time: '' });
    const expectedLocal = new Date(2026, 2, 14, 20, 0, 0).getTime();
    expect(getGameDateTimeMs(game)).toBe(expectedLocal + 3 * 60 * 60 * 1000);
  });

  it('parseia horário com minutos', () => {
    const game = makeGame({ date: '2026-03-14', time: '21:30' });
    const expectedLocal = new Date(2026, 2, 14, 21, 30, 0).getTime();
    expect(getGameDateTimeMs(game)).toBe(expectedLocal + 3 * 60 * 60 * 1000);
  });

  it('retorna null quando date está vazio', () => {
    expect(getGameDateTimeMs(makeGame({ date: '', time: '20:00' }))).toBeNull();
  });

  it('retorna null quando date é undefined', () => {
    expect(getGameDateTimeMs(makeGame({ date: undefined as unknown as string }))).toBeNull();
  });

  it('retorna null quando date é inválido (não numérico)', () => {
    expect(getGameDateTimeMs(makeGame({ date: 'abc-def-ghi' }))).toBeNull();
  });
});

describe('detectGameConflicts', () => {
  it('retorna conjunto vazio para lista vazia', () => {
    expect(detectGameConflicts([])).toEqual(new Set());
  });

  it('retorna conjunto vazio para um único jogo', () => {
    expect(detectGameConflicts([makeGame()])).toEqual(new Set());
  });

  it('detecta conflito entre dois jogos com menos de 2h de diferença', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-14', time: '21:00' }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set(['a', 'b']));
  });

  it('não detecta conflito com exatamente 2h de diferença (janela exclusiva)', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-14', time: '22:00' }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set());
  });

  it('não detecta conflito acima da janela', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-14', time: '23:00' }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set());
  });

  it('ignora jogos CANCELLED', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-14', time: '20:30', status: 'CANCELLED' }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set());
  });

  it('ignora jogos FINISHED', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-14', time: '20:30', status: 'FINISHED' }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set());
  });

  it('ignora jogos sem horário resolúvel', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '', time: '20:30' }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set());
  });

  it('detecta conflito em jogos de dias diferentes dentro da janela (dateTime)', () => {
    const games = [
      makeGame({ id: 'a', dateTime: new Date(2026, 2, 14, 23, 0) }),
      makeGame({ id: 'b', dateTime: new Date(2026, 2, 15, 0, 30) }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set(['a', 'b']));
  });

  it('quirk: horário "00:30" em string é interpretado como 20:30 (hour falsy → 20)', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-15', time: '00:30' }),
    ];
    // b resolvível em 15/03 20:30 (+3h) → diff de ~21h → sem conflito
    expect(detectGameConflicts(games)).toEqual(new Set());
    expect(getGameDateTimeMs(games[1])).toBe(
      new Date(2026, 2, 15, 20, 30, 0).getTime() + 3 * 60 * 60 * 1000,
    );
  });

  it('marca todos os jogos de um cluster de conflitos', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-14', time: '20:30' }),
      makeGame({ id: 'c', date: '2026-03-14', time: '21:00' }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('não cruza jogo sem horário com a janela de conflito', () => {
    const games = [
      makeGame({ id: 'a', date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: 'invalida', time: '20:30' }),
    ];
    const result = detectGameConflicts(games);
    expect(result.has('b')).toBe(false);
    expect(result.size).toBe(0);
  });

  it('usa dateTime quando presente para calcular a janela (dateTime × dateTime)', () => {
    const games = [
      makeGame({ id: 'a', dateTime: new Date(2026, 2, 14, 20, 0) }),
      makeGame({ id: 'b', dateTime: new Date(2026, 2, 14, 20, 30) }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set(['a', 'b']));
  });

  it('quirk: dateTime (Date) não recebe offset de 3h, string sim', () => {
    const games = [
      makeGame({ id: 'a', dateTime: new Date(2026, 2, 14, 20, 0), date: '2026-03-14', time: '20:00' }),
      makeGame({ id: 'b', date: '2026-03-14', time: '20:00' }),
    ];
    // a: 20:00 local; b: 20:00 local + 3h → diff 3h → sem conflito
    expect(detectGameConflicts(games)).toEqual(new Set());
  });

  it('janela de conflito é menor que 2h (2h - 1ms)', () => {
    const base = new Date(2026, 2, 14, 20, 0, 0);
    const games = [
      makeGame({ id: 'a', dateTime: base }),
      makeGame({ id: 'b', dateTime: new Date(base.getTime() + CONFLICT_WINDOW_MS - 1) }),
    ];
    expect(detectGameConflicts(games)).toEqual(new Set(['a', 'b']));
  });
});
