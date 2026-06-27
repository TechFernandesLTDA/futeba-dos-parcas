import { describe, expect, it } from 'vitest';
import type { GameConfirmation } from '../types/game';
import {
  buildPostGameHighlights,
  formatPostGameHighlightsShareText,
} from './postGameHighlights';

const confirmation = (overrides: Partial<GameConfirmation>): GameConfirmation => ({
  id: overrides.id ?? `${overrides.userId}-confirmation`,
  gameId: 'game-1',
  userId: overrides.userId ?? 'user-1',
  userName: overrides.userName ?? 'Jogador',
  position: overrides.position ?? 'FIELD',
  status: overrides.status ?? 'CONFIRMED',
  paymentStatus: overrides.paymentStatus ?? 'PENDING',
  isCasualPlayer: false,
  goals: overrides.goals ?? 0,
  assists: overrides.assists ?? 0,
  saves: overrides.saves ?? 0,
  yellowCards: 0,
  redCards: 0,
  xpEarned: 0,
  isMvp: overrides.isMvp ?? false,
  isBestGk: false,
  isWorstPlayer: false,
  partialPayment: 0,
  wasPresent: true,
  isOnTheWay: false,
  checkedIn: false,
  isGuest: false,
  confirmationOrder: 1,
  ...overrides,
});

describe('postGameHighlights', () => {
  it('uses official MVP and ranks the best duo by match contribution', () => {
    const highlights = buildPostGameHighlights(
      { mvpId: 'u2' },
      [
        confirmation({ userId: 'u1', userName: 'Ana', goals: 1, assists: 1 }),
        confirmation({ userId: 'u2', userName: 'Bia', goals: 2 }),
        confirmation({ userId: 'u3', userName: 'Caio', saves: 4 }),
      ],
    );

    expect(highlights.mvp?.userName).toBe('Bia');
    expect(highlights.bestDuo.map((player) => player.userName)).toEqual(['Bia', 'Ana']);
    expect(highlights.moment).toMatchObject({ kind: 'goal', value: 2 });
  });

  it('falls back to confirmed players when no live stats were captured', () => {
    const highlights = buildPostGameHighlights(
      {},
      [
        confirmation({ userId: 'u1', userName: 'Ana' }),
        confirmation({ userId: 'u2', userName: 'Bia' }),
      ],
    );

    expect(highlights.bestDuo.map((player) => player.userName)).toEqual(['Ana', 'Bia']);
    expect(highlights.moment).toEqual({ kind: 'presence', value: 2 });
    expect(highlights.hasHighlights).toBe(true);
  });

  it('ignores players that were not confirmed', () => {
    const highlights = buildPostGameHighlights(
      { mvpId: 'u2' },
      [
        confirmation({ userId: 'u1', userName: 'Ana', goals: 3, status: 'WAITLIST' }),
        confirmation({ userId: 'u2', userName: 'Bia', goals: 1 }),
      ],
    );

    expect(highlights.confirmedCount).toBe(1);
    expect(highlights.bestDuo.map((player) => player.userName)).toEqual(['Bia']);
  });

  it('formats a compact share card text', () => {
    const highlights = buildPostGameHighlights(
      { mvpId: 'u1' },
      [
        confirmation({ userId: 'u1', userName: 'Ana', goals: 1 }),
        confirmation({ userId: 'u2', userName: 'Bia', assists: 2 }),
      ],
    );

    expect(formatPostGameHighlightsShareText({
      locationName: 'Arena Central',
      team1Name: 'Azul',
      team2Name: 'Verde',
      team1Score: 3,
      team2Score: 2,
    }, highlights)).toContain('Melhor dupla: Bia + Ana');
  });
});
