import { describe, expect, it } from 'vitest';
import type { Group } from '../types/group';
import { getDaysSince, getReconnectSuggestions } from './reconnectSuggestions';

function group(overrides: Partial<Group>): Group {
  return {
    id: overrides.id ?? 'group-1',
    name: overrides.name ?? 'Parcas da quarta',
    type: 'PRIVATE',
    isPublic: false,
    ownerId: 'owner-1',
    ownerName: 'Dono',
    members: [],
    memberCount: 8,
    totalGamesPlayed: 4,
    createdAt: new Date(2026, 0, 1, 12),
    updatedAt: new Date(2026, 0, 1, 12),
    ...overrides,
  } as Group;
}

describe('getReconnectSuggestions', () => {
  const now = new Date(2026, 5, 27, 12);

  it('sugere grupos com historico e sem proximo jogo', () => {
    const suggestions = getReconnectSuggestions([
      group({ id: 'stale', nextGameDate: undefined, totalGamesPlayed: 3 }),
      group({ id: 'new', nextGameDate: undefined, totalGamesPlayed: 0 }),
    ], now);

    expect(suggestions.map((suggestion) => suggestion.groupId)).toEqual(['stale']);
    expect(suggestions[0].daysWithoutGame).toBeNull();
  });

  it('nao sugere grupos que ja tem jogo futuro', () => {
    const suggestions = getReconnectSuggestions([
      group({ id: 'scheduled', nextGameDate: new Date(2026, 5, 30, 12) }),
    ], now);

    expect(suggestions).toEqual([]);
  });

  it('aplica janela minima e ordena pela maior distancia sem jogo', () => {
    const suggestions = getReconnectSuggestions([
      group({ id: 'recent', nextGameDate: new Date(2026, 5, 20, 12) }),
      group({ id: 'old', nextGameDate: new Date(2026, 4, 1, 12) }),
      group({ id: 'older', nextGameDate: new Date(2026, 3, 1, 12) }),
    ], now, 21);

    expect(suggestions.map((suggestion) => suggestion.groupId)).toEqual(['older', 'old']);
  });
});

describe('getDaysSince', () => {
  it('calcula diferenca por dia civil', () => {
    expect(getDaysSince(new Date(2026, 5, 1, 23, 59), new Date(2026, 5, 27, 0, 1))).toBe(26);
  });
});
