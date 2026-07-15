import { describe, expect, it } from 'vitest';
import type { LeaguePlayerSummary } from '../services/cloudFunctions';
import {
  toPublicPlayerSearchResult,
  toReinforcementSignals,
  toReinforcementUser,
} from './publicPlayerProjection';

const player: LeaguePlayerSummary = {
  id: 'u1',
  userId: 'u1',
  userName: 'Ana Pública',
  userPhoto: 'https://img.test/ana.jpg',
  level: 4,
  points: 10,
  gamesPlayed: 8,
  wins: 5,
  goals: 3,
  assists: 2,
  mvpCount: 1,
  division: 'SILVER',
  experiencePoints: 900,
  canReceiveInvites: true,
  preferredPosition: 'MEIA',
  midRating: 3.7,
  midRatingSet: true,
  autoMidRating: 4.1,
  autoRatingSamples: 12,
  lookingForGameToday: true,
  hasRecentPresence: true,
};

describe('publicPlayerProjection', () => {
  it('mapeia busca sem inventar ou expor PII', () => {
    const result = toPublicPlayerSearchResult(player);

    expect(result).toEqual({
      id: 'u1',
      name: 'Ana Pública',
      photoUrl: 'https://img.test/ana.jpg',
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
  });

  it('preserva somente os sinais esportivos necessários ao reforço', () => {
    const user = toReinforcementUser(player);

    expect(user).toEqual(expect.objectContaining({
      id: 'u1',
      name: 'Ana Pública',
      preferredPosition: 'MEIA',
      midRating: 3.7,
      autoMidRating: 4.1,
      autoRatingSamples: 12,
      isSearchable: true,
    }));
    expect(user.email).toBe('');
    expect(toReinforcementSignals(player)).toEqual({
      isLookingToday: true,
      hasRecentPresence: true,
    });
  });
});
