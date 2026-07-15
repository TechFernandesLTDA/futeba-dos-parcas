import { describe, expect, it } from 'vitest';
import type { User } from '../types/user';
import {
  buildReinforcementCandidates,
  getConfirmationPositionForNeed,
  hasRecentPresence,
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

  it('prioriza e filtra jogadores com presenca recente', () => {
    const now = new Date('2026-06-27T12:00:00Z');
    const recent = makeUser({ id: 'recent', preferredPosition: 'MEIA', midRating: 3, lastGameDate: new Date('2026-06-20T12:00:00Z') });
    const old = makeUser({ id: 'old', preferredPosition: 'MEIA', midRating: 5, lastGameDate: new Date('2026-04-01T12:00:00Z') });

    const candidates = buildReinforcementCandidates(
      [old, recent],
      'MIDFIELDER',
      new Set(),
      { now },
    );
    expect(candidates.map((candidate) => candidate.user.id)).toEqual(['recent', 'old']);
    expect(candidates[0].hasRecentPresence).toBe(true);

    const recentOnly = buildReinforcementCandidates(
      [old, recent],
      'MIDFIELDER',
      new Set(),
      { now, recentPresenceOnly: true },
    );
    expect(recentOnly.map((candidate) => candidate.user.id)).toEqual(['recent']);
  });

  it('usa sinais sanitizados da projeção pública sem timestamps de atividade', () => {
    const candidate = makeUser({
      id: 'public-candidate',
      preferredPosition: 'MEIA',
      midRating: 3,
    });
    const signalsByUserId = new Map([
      ['public-candidate', { isLookingToday: true, hasRecentPresence: true }],
    ]);

    const candidates = buildReinforcementCandidates(
      [candidate],
      'MIDFIELDER',
      new Set(),
      { recentPresenceOnly: true, signalsByUserId },
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual(expect.objectContaining({
      isLookingToday: true,
      hasRecentPresence: true,
    }));
  });

  it('considera presenca recente apenas dentro da janela de 30 dias', () => {
    const now = new Date('2026-06-27T12:00:00Z');
    expect(hasRecentPresence(makeUser({ lastGameDate: new Date('2026-06-01T12:00:00Z') }), now)).toBe(true);
    expect(hasRecentPresence(makeUser({ lastGameDate: new Date('2026-05-01T12:00:00Z') }), now)).toBe(false);
  });

  it('mapeia necessidade para posicao de confirmacao existente', () => {
    expect(getConfirmationPositionForNeed('GOALKEEPER')).toBe('GOALKEEPER');
    expect(getConfirmationPositionForNeed('DEFENDER')).toBe('FIELD');
    expect(getConfirmationPositionForNeed('ANY_FIELD')).toBe('FIELD');
  });
});
