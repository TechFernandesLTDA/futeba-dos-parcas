import { describe, it, expect } from 'vitest';
import { camelToSnake } from './camelToSnake';

describe('camelToSnake', () => {
  it('converte chaves camelCase para snake_case', () => {
    const input = { userName: 'João', totalGames: 10 };
    const result = camelToSnake(input);
    expect(result).toEqual({ user_name: 'João', total_games: 10 });
  });

  it('converte objetos aninhados', () => {
    const input = { gameData: { playerCount: 14, fieldType: 'SOCIETY' } };
    const result = camelToSnake(input);
    expect(result).toEqual({ game_data: { player_count: 14, field_type: 'SOCIETY' } });
  });

  it('converte arrays de objetos', () => {
    const input = { players: [{ playerName: 'A' }, { playerName: 'B' }] };
    const result = camelToSnake(input);
    expect(result).toEqual({ players: [{ player_name: 'A' }, { player_name: 'B' }] });
  });

  it('retorna null/undefined como está', () => {
    expect(camelToSnake(null as unknown as Record<string, unknown>)).toBeNull();
    expect(camelToSnake(undefined as unknown as Record<string, unknown>)).toBeUndefined();
  });

  it('mantém chaves que já são snake_case', () => {
    const input = { user_name: 'João' };
    const result = camelToSnake(input);
    expect(result).toEqual({ user_name: 'João' });
  });

  it('preserva timestamps do Firestore (objetos com toDate)', () => {
    const mockTimestamp = { toDate: () => new Date(2026, 0, 1) };
    const input = { createdAt: mockTimestamp, name: 'test' };
    const result = camelToSnake(input);
    expect(result).toHaveProperty('created_at');
    expect((result as Record<string, unknown>).created_at).toBe(mockTimestamp);
  });

  it('preserva Date objects', () => {
    const date = new Date(2026, 2, 14);
    const input = { createdAt: date };
    const result = camelToSnake(input);
    expect((result as Record<string, unknown>).created_at).toBe(date);
  });

  it('converte arrays no nível raiz', () => {
    const input = [{ camelKey: 'value' }];
    const result = camelToSnake(input as unknown as Record<string, unknown>);
    expect(result).toEqual([{ camel_key: 'value' }]);
  });

  it('lida com objetos vazios', () => {
    expect(camelToSnake({})).toEqual({});
  });

  it('lida com valores primitivos em arrays', () => {
    const input = { tags: ['a', 'b', 'c'] };
    const result = camelToSnake(input);
    expect(result).toEqual({ tags: ['a', 'b', 'c'] });
  });
});
