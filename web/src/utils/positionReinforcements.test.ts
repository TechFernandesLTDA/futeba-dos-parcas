import { describe, expect, it } from 'vitest';
import type { User } from '../types/user';
import {
  buildReinforcementCandidates,
  getConfirmationPositionForNeed,
} from './positionReinforcements';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-id',
    email: 'player@test.com',
    name: 'Jogador',
    role: 'PLAYER',
    level: 1,
    experiencePoints: 0,
    strikerRating: 0,
    midRating: 0,
    defenderRating: 0,
    gkRating: 0,
    autoStrikerRating: 0,
    autoMidRating: 0,
    autoDefenderRating: 0,
    autoGkRating: 0,
    autoRatingSamples: 0,
    preferredFieldTypes: [],
    totalGames: 0,
    totalGoals: 0,
    totalAssists: 0,
    totalWins: 0,
    totalDraws: 0,
    totalLosses: 0,
    totalSaves: 0,
    mvpCount: 0,
    yellowCards: 0,
    redCards: 0,
    isSearchable: true,
    isVerified: true,
    inviteCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    ...overrides,
  };
}

describe('positionReinforcements', () => {
  it('prioriza quem esta procurando jogo hoje e combina com a posicao', () => {
    const until = new Date(Date.now() + 60 * 60 * 1000);
    const candidates = buildReinforcementCandidates(
      [
        makeUser({ id: 'defender', name: 'Defensor', preferredPosition: 'ZAGUEIRO', defenderRating: 3 }),
        makeUser({ id: 'available', name: 'Livre Hoje', preferredPosition: 'LATERAL', defenderRating: 2, lookingForGameToday: true, lookingForGameTodayUntil: until }),
        makeUser({ id: 'striker', name: 'Atacante', preferredPosition: 'ATACANTE', strikerRating: 5 }),
      ],
      'DEFENDER',
      new Set(),
    );

    expect(candidates.map((candidate) => candidate.user.id)).toEqual(['available', 'defender']);
    expect(candidates[0].isLookingToday).toBe(true);
  });

  it('remove usuarios ja vinculados ao jogo e perfis nao pesquisaveis', () => {
    const candidates = buildReinforcementCandidates(
      [
        makeUser({ id: 'confirmed', preferredPosition: 'GOLEIRO', gkRating: 5 }),
        makeUser({ id: 'hidden', preferredPosition: 'GOLEIRO', gkRating: 5, isSearchable: false }),
        makeUser({ id: 'candidate', preferredPosition: 'GOLEIRO', gkRating: 3 }),
      ],
      'GOALKEEPER',
      new Set(['confirmed']),
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].user.id).toBe('candidate');
  });

  it('mapeia necessidade para posicao de confirmacao existente', () => {
    expect(getConfirmationPositionForNeed('GOALKEEPER')).toBe('GOALKEEPER');
    expect(getConfirmationPositionForNeed('DEFENDER')).toBe('FIELD');
    expect(getConfirmationPositionForNeed('ANY_FIELD')).toBe('FIELD');
  });
});
