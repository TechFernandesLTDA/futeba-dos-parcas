import type { HeadToHeadStats } from '../hooks/useHeadToHead';

export interface FriendlyComparisonLabels {
  title: string;
  games: string;
  opponents: string;
  sameTeam: string;
  goals: string;
  assists: string;
  mvp: string;
  directWins: string;
  draws: string;
  together: string;
  balancedHeadline: string;
  winsHeadline: (playerName: string) => string;
  goalsHeadline: (playerName: string) => string;
}

export interface FriendlyComparisonSummary {
  headline: string;
  shareText: string;
  playerOne: {
    name: string;
    wins: number;
    goals: number;
    assists: number;
    mvp: number;
  };
  playerTwo: {
    name: string;
    wins: number;
    goals: number;
    assists: number;
    mvp: number;
  };
}

export function buildFriendlyComparisonSummary(
  playerOneName: string,
  playerTwoName: string,
  stats: HeadToHeadStats,
  labels: FriendlyComparisonLabels
): FriendlyComparisonSummary {
  const headline = getFriendlyHeadline(playerOneName, playerTwoName, stats, labels);

  const rows = [
    labels.title,
    `${playerOneName} x ${playerTwoName}`,
    headline,
    '',
    `${labels.games}: ${stats.totalGames}`,
    `${labels.opponents}: ${stats.gamesAgainst}`,
    `${labels.sameTeam}: ${stats.gamesTogether}`,
    '',
    `${playerOneName}: ${stats.p1WinsAgainst} ${labels.directWins}, ${stats.p1TotalGoals} ${labels.goals}, ${stats.p1TotalAssists} ${labels.assists}, ${stats.p1MvpCount} ${labels.mvp}`,
    `${playerTwoName}: ${stats.p2WinsAgainst} ${labels.directWins}, ${stats.p2TotalGoals} ${labels.goals}, ${stats.p2TotalAssists} ${labels.assists}, ${stats.p2MvpCount} ${labels.mvp}`,
    `${labels.draws}: ${stats.drawsAgainst}`,
    `${labels.together}: ${stats.gamesTogether}`,
  ];

  return {
    headline,
    shareText: rows.join('\n'),
    playerOne: {
      name: playerOneName,
      wins: stats.p1WinsAgainst,
      goals: stats.p1TotalGoals,
      assists: stats.p1TotalAssists,
      mvp: stats.p1MvpCount,
    },
    playerTwo: {
      name: playerTwoName,
      wins: stats.p2WinsAgainst,
      goals: stats.p2TotalGoals,
      assists: stats.p2TotalAssists,
      mvp: stats.p2MvpCount,
    },
  };
}

function getFriendlyHeadline(
  playerOneName: string,
  playerTwoName: string,
  stats: HeadToHeadStats,
  labels: FriendlyComparisonLabels
): string {
  if (stats.p1WinsAgainst > stats.p2WinsAgainst) {
    return labels.winsHeadline(playerOneName);
  }

  if (stats.p2WinsAgainst > stats.p1WinsAgainst) {
    return labels.winsHeadline(playerTwoName);
  }

  if (stats.p1TotalGoals > stats.p2TotalGoals) {
    return labels.goalsHeadline(playerOneName);
  }

  if (stats.p2TotalGoals > stats.p1TotalGoals) {
    return labels.goalsHeadline(playerTwoName);
  }

  return labels.balancedHeadline;
}
