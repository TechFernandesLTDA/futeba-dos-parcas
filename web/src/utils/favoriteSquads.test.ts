import { describe, expect, it } from 'vitest';
import type { FavoriteSquad } from '../types/favoriteSquad';
import {
  applyFavoriteSquadToTeams,
  getApplicableFavoriteSquads,
  normalizeFavoriteSquadInput,
  validateFavoriteSquadInput,
} from './favoriteSquads';

const squad: FavoriteSquad = {
  id: 'squad-1',
  ownerId: 'owner-1',
  name: 'Dupla',
  type: 'PAIR',
  playerIds: ['p1', 'p2'],
  playerNames: ['Ana', 'Bia'],
};

describe('favoriteSquads', () => {
  it('normaliza nomes, ids e remove jogadores duplicados', () => {
    expect(normalizeFavoriteSquadInput({
      name: '  Trio da resenha  ',
      playerIds: [' p1 ', 'p2', 'p1'],
      playerNames: ['Ana', 'Bia', 'Ana repetida'],
    })).toEqual({
      name: 'Trio da resenha',
      playerIds: ['p1', 'p2'],
      playerNames: ['Ana', 'Bia'],
    });
  });

  it('valida quantidade minima e nome obrigatorio', () => {
    expect(validateFavoriteSquadInput({ name: '', playerIds: ['p1', 'p2'], playerNames: ['A', 'B'] })).toBe('name');
    expect(validateFavoriteSquadInput({ name: 'Solo', playerIds: ['p1'], playerNames: ['A'] })).toBe('minPlayers');
    expect(validateFavoriteSquadInput({ name: 'Dupla', playerIds: ['p1', 'p2'], playerNames: ['A', 'B'] })).toBeNull();
  });

  it('retorna apenas favoritos com todos os jogadores presentes', () => {
    const suggestions = getApplicableFavoriteSquads([
      squad,
      { ...squad, id: 'missing', playerIds: ['p1', 'p3'] },
    ], [
      { id: 'p1', name: 'Ana' },
      { id: 'p2', name: 'Bia' },
    ]);

    expect(suggestions.map((item) => item.id)).toEqual(['squad-1']);
  });

  it('aplica favorito no time que ja tem mais membros da dupla', () => {
    const result = applyFavoriteSquadToTeams(
      squad,
      [{ id: 'p1', name: 'Ana' }, { id: 'p3', name: 'Caio' }],
      [{ id: 'p2', name: 'Bia' }],
    );

    expect(result.targetTeam).toBe('A');
    expect(result.teamA.map((player) => player.id)).toEqual(['p3', 'p1', 'p2']);
    expect(result.teamB).toEqual([]);
  });
});
