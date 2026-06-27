function compareNumberDesc(a: number, b: number): number {
  return b - a;
}

export interface SortableGroupLeagueStanding {
  points: number;
  gamesPlayed: number;
  wins: number;
  goalDifference: number;
  goalsScored: number;
  userName: string;
}

/**
 * Group standings prioritize score, then attendance/activity before sport tie-breakers.
 */
export function compareGroupLeagueStandings(
  a: SortableGroupLeagueStanding,
  b: SortableGroupLeagueStanding
): number {
  return compareNumberDesc(a.points, b.points)
    || compareNumberDesc(a.gamesPlayed, b.gamesPlayed)
    || compareNumberDesc(a.wins, b.wins)
    || compareNumberDesc(a.goalDifference, b.goalDifference)
    || compareNumberDesc(a.goalsScored, b.goalsScored)
    || a.userName.localeCompare(b.userName, undefined, { sensitivity: 'base' });
}
