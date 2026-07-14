import type { Game } from '../../types/game';

type WaitlistEligibleGame = Pick<Game, 'status' | 'playersCount' | 'maxPlayers'>;

export function isGameWaitlistEligible(
  game: WaitlistEligibleGame | null | undefined,
  isConfirmed: boolean,
): boolean {
  return !!game
    && (game.status === 'SCHEDULED' || game.status === 'CONFIRMED')
    && game.maxPlayers > 0
    && game.playersCount >= game.maxPlayers
    && !isConfirmed;
}
