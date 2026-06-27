import type { Game, GameConfirmation } from '../types/game';

export interface HighlightPlayer {
  userId: string;
  userName: string;
  userPhoto?: string;
  goals: number;
  assists: number;
  saves: number;
  score: number;
}

export type HighlightMomentKind = 'goal' | 'assist' | 'save' | 'mvp' | 'presence';

export interface HighlightMoment {
  kind: HighlightMomentKind;
  player?: HighlightPlayer;
  value?: number;
}

export interface PostGameHighlights {
  mvp?: HighlightPlayer;
  bestDuo: HighlightPlayer[];
  moment?: HighlightMoment;
  confirmedCount: number;
  hasHighlights: boolean;
}

const toSafeNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const toPlayer = (confirmation: GameConfirmation): HighlightPlayer => {
  const goals = toSafeNumber(confirmation.goals);
  const assists = toSafeNumber(confirmation.assists);
  const saves = toSafeNumber(confirmation.saves);

  return {
    userId: confirmation.userId,
    userName: confirmation.userName,
    userPhoto: confirmation.userPhoto,
    goals,
    assists,
    saves,
    score: goals * 3 + assists * 2 + saves,
  };
};

const byScoreThenName = (a: HighlightPlayer, b: HighlightPlayer): number => {
  if (b.score !== a.score) return b.score - a.score;
  if (b.goals !== a.goals) return b.goals - a.goals;
  if (b.assists !== a.assists) return b.assists - a.assists;
  if (b.saves !== a.saves) return b.saves - a.saves;
  return a.userName.localeCompare(b.userName);
};

const byStatThenScore = (
  stat: keyof Pick<HighlightPlayer, 'goals' | 'assists' | 'saves'>,
) => (a: HighlightPlayer, b: HighlightPlayer): number => {
  if (b[stat] !== a[stat]) return b[stat] - a[stat];
  return byScoreThenName(a, b);
};

export function buildPostGameHighlights(
  game: Pick<Game, 'mvpId'>,
  confirmations: GameConfirmation[],
): PostGameHighlights {
  const players = confirmations
    .filter((confirmation) => confirmation.status === 'CONFIRMED')
    .map(toPlayer);

  const playersById = new Map(players.map((player) => [player.userId, player]));
  const mvp = (game.mvpId ? playersById.get(game.mvpId) : undefined)
    ?? players.find((player) => confirmations.some((confirmation) =>
      confirmation.userId === player.userId && confirmation.isMvp
    ));

  const ranked = [...players].sort(byScoreThenName);
  const bestDuo = ranked.filter((player) => player.score > 0).slice(0, 2);
  const fallbackDuo = bestDuo.length >= 2 ? bestDuo : ranked.slice(0, 2);

  const topScorer = [...players].sort(byStatThenScore('goals'))[0];
  const topAssistant = [...players].sort(byStatThenScore('assists'))[0];
  const topKeeper = [...players].sort(byStatThenScore('saves'))[0];

  let moment: HighlightMoment | undefined;
  if (topScorer?.goals > 0) {
    moment = { kind: 'goal', player: topScorer, value: topScorer.goals };
  } else if (topAssistant?.assists > 0) {
    moment = { kind: 'assist', player: topAssistant, value: topAssistant.assists };
  } else if (topKeeper?.saves > 0) {
    moment = { kind: 'save', player: topKeeper, value: topKeeper.saves };
  } else if (mvp) {
    moment = { kind: 'mvp', player: mvp };
  } else if (players.length > 0) {
    moment = { kind: 'presence', value: players.length };
  }

  return {
    mvp,
    bestDuo: fallbackDuo,
    moment,
    confirmedCount: players.length,
    hasHighlights: !!mvp || fallbackDuo.length > 0 || !!moment,
  };
}

export function formatPostGameHighlightsShareText(
  game: Pick<Game, 'locationName' | 'team1Name' | 'team2Name' | 'team1Score' | 'team2Score'>,
  highlights: PostGameHighlights,
): string {
  const scoreLine = `${game.team1Name || 'Time A'} ${toSafeNumber(game.team1Score)} x ${toSafeNumber(game.team2Score)} ${game.team2Name || 'Time B'}`;
  const lines = [
    'Futeba dos Parças - Destaques pós-jogo',
    game.locationName,
    scoreLine,
    highlights.mvp ? `MVP: ${highlights.mvp.userName}` : '',
    highlights.bestDuo.length >= 2
      ? `Melhor dupla: ${highlights.bestDuo[0].userName} + ${highlights.bestDuo[1].userName}`
      : '',
  ];

  return lines.filter(Boolean).join('\n');
}
