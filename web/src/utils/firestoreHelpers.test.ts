import { describe, it, expect } from 'vitest';
import { snakeToCamel } from './firestoreHelpers';

describe('snakeToCamel', () => {
  it('converte chaves snake_case para camelCase', () => {
    const input = { user_name: 'João', total_games: 10 };
    const result = snakeToCamel(input);
    expect(result).toEqual({ userName: 'João', totalGames: 10 });
  });

  it('converte objetos aninhados', () => {
    const input = { game_data: { player_count: 14, field_type: 'SOCIETY' } };
    const result = snakeToCamel(input);
    expect(result).toEqual({ gameData: { playerCount: 14, fieldType: 'SOCIETY' } });
  });

  it('converte arrays de objetos', () => {
    const input = { players: [{ player_name: 'A' }, { player_name: 'B' }] };
    const result = snakeToCamel(input);
    expect(result).toEqual({ players: [{ playerName: 'A' }, { playerName: 'B' }] });
  });

  it('retorna null/undefined como está', () => {
    expect(snakeToCamel(null as any)).toBeNull();
    expect(snakeToCamel(undefined as any)).toBeUndefined();
  });

  it('mantém chaves que já são camelCase', () => {
    const input = { userName: 'João', totalGames: 10 };
    const result = snakeToCamel(input);
    expect(result).toEqual({ userName: 'João', totalGames: 10 });
  });

  it('preserva timestamps do Firestore (objetos com toDate)', () => {
    const mockTimestamp = { toDate: () => new Date(2026, 0, 1) };
    const input = { created_at: mockTimestamp, name: 'test' };
    const result = snakeToCamel(input);
    expect(result).toHaveProperty('createdAt');
    expect((result as any).createdAt).toBe(mockTimestamp);
  });

  it('converte arrays no nível raiz', () => {
    const input = [{ snake_key: 'value' }];
    const result = snakeToCamel(input);
    expect(result).toEqual([{ snakeKey: 'value' }]);
  });

  it('lida com objetos vazios', () => {
    expect(snakeToCamel({})).toEqual({});
  });

  it('lida com valores primitivos em arrays', () => {
    const input = { tags: ['a', 'b', 'c'] };
    const result = snakeToCamel(input);
    expect(result).toEqual({ tags: ['a', 'b', 'c'] });
  });
});
