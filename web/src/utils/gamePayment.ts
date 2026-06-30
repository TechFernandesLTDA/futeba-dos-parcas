import type { Game } from '../types/game';

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

type GamePaymentSource = Pick<Game, 'dailyPrice' | 'totalCost' | 'maxPlayers'>;

export const resolveExpectedPayment = (game?: GamePaymentSource | null) => {
  if (!game) return 0;
  if (Number.isFinite(game.dailyPrice) && game.dailyPrice > 0) {
    return roundCurrency(game.dailyPrice);
  }
  if (Number.isFinite(game.totalCost) && game.totalCost > 0 && game.maxPlayers > 0) {
    return roundCurrency(game.totalCost / game.maxPlayers);
  }
  return 0;
};

export const toPaymentCents = (value: number) => Math.round(roundCurrency(value) * 100);
